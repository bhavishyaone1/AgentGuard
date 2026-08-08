import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddlewareFromConfig } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { 
  ALGORAND_TESTNET_CAIP2, 
  getTransactionId,
  isValidAlgorandAddress
} from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/server";

// Custom helper to retrieve environment variables cross-platform
const getEnvVal = (c: any, key: string, fallback: string): string => {
  if (c.env && c.env[key]) return c.env[key];
  if (typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.env && (globalThis as any).process.env[key]) {
    return (globalThis as any).process.env[key];
  }
  return fallback;
};

const app = new Hono();

// Enable CORS for frontend dashboard access and expose x402 headers to browser clients
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "payment-signature", "x-payment"],
    exposeHeaders: [
      "payment-required",
      "x-payment-required",
      "payment-verified",
      "x-payment-verified",
      "x-payment-error"
    ]
  })
);

// Root discovery route
app.get("/", (c) => {
  return c.json({
    name: "AgentGuard API Gateway",
    version: "1.0.0",
    status: "active",
    network: "algorand-testnet",
    endpoints: {
      health: "/api/health",
      check: "POST /api/check"
    }
  });
});

// Health Check route
app.get("/api/health", (c) => {
  return c.json({ status: "healthy", service: "AgentGuard", time: new Date().toISOString() });
});

// Configure x402 payment requirements middleware
// We create a middleware wrapper so that we can resolve env variables dynamically on each request
app.use("/api/check", async (c, next) => {
  const merchantAddress = getEnvVal(c, "MERCHANT_ADDRESS", "GDOR5JNJX6K4T2F76NZB7UOW2P5HVDMTGNDV6L6L437435KJZ4Z6U37E"); // Fallback fallback address
  const facilitatorUrl = getEnvVal(c, "FACILITATOR_URL", "https://facilitator.goplausible.xyz");

  const routes = {
    "POST /api/check": {
      accepts: {
        scheme: "exact",
        network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=" as const,
        payTo: merchantAddress,
        price: "$0.01", // $0.01 USDC check fee
      },
      description: "AgentGuard Pre-payment trust and spend policy check",
    },
  };

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
  });

  const schemes = [
    {
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=" as const,
      server: new ExactAvmScheme(),
    },
  ];

  const middleware = paymentMiddlewareFromConfig(routes, facilitatorClient, schemes);
  return middleware(c, next);
});

// Gated route that executes the trust check and spend policy logic
app.post("/api/check", async (c) => {
  const facilitatorUrl = getEnvVal(c, "FACILITATOR_URL", "https://facilitator.goplausible.xyz");
  let body: any;
  try {
    body = await c.req.json();
  } catch (err) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { merchantAddress, claimedPrice, callerSpendPolicy } = body;

  if (!merchantAddress) {
    return c.json({ error: "Missing merchantAddress parameter" }, 400);
  }

  // 1. Spend Policy Check (Pure Logic)
  let policyDecision = "allow";
  let policyReason = "Within per-call and daily limits";

  if (claimedPrice && callerSpendPolicy) {
    const claimedAmt = BigInt(claimedPrice.amount || "0");
    const maxPerCall = BigInt(callerSpendPolicy.maxPerCall || "999999999999");
    const maxDailyRemaining = BigInt(callerSpendPolicy.maxDailyRemaining || "999999999999");

    if (claimedAmt > maxPerCall) {
      policyDecision = "deny";
      policyReason = `Claimed amount (${claimedAmt}) exceeds per-call limit (${maxPerCall})`;
    } else if (claimedAmt > maxDailyRemaining) {
      policyDecision = "deny";
      policyReason = `Claimed amount (${claimedAmt}) exceeds remaining daily limit (${maxDailyRemaining})`;
    }
  }

  // 2. Trust Check (Facilitator Registry Lookup)
  let verdict = "unverified";
  let registered = false;
  let hasSettlementHistory = false;
  let priceMatchesDeclared = false;
  const reasons: string[] = [];

  try {
    let merchantData: any = null;
    let resourceData: any = null;

    // Check if target is a valid Algorand address
    const isAlgoAddr = isValidAlgorandAddress(merchantAddress);

    if (isAlgoAddr) {
      reasons.push("Input resolved to a valid Algorand address");
      // Query merchant details directly
      const merchantRes = await fetch(`${facilitatorUrl}/discovery/merchants/${merchantAddress}`, {
        headers: { "Accept": "application/json" }
      });
      
      if (merchantRes.ok) {
        merchantData = await merchantRes.json();
      }
    } else {
      reasons.push("Input resolved to a merchant endpoint/URL");
      // Search for resource matching the endpoint URL
      const resourceRes = await fetch(`${facilitatorUrl}/discovery/resources?search=${encodeURIComponent(merchantAddress)}`, {
        headers: { "Accept": "application/json" }
      });

      if (resourceRes.ok) {
        const resourcesList: any = await resourceRes.json();
        if (resourcesList.items && resourcesList.items.length > 0) {
          // Find resource that matches merchantAddress
          resourceData = resourcesList.items.find((res: any) => 
            res.resourceUrl?.toLowerCase().includes(merchantAddress.toLowerCase())
          ) || resourcesList.items[0];

          if (resourceData && resourceData.merchantId) {
            // Fetch merchant data by ID
            const merchantRes = await fetch(`${facilitatorUrl}/discovery/merchants/${resourceData.merchantId}`, {
              headers: { "Accept": "application/json" }
            });
            if (merchantRes.ok) {
              merchantData = await merchantRes.json();
            }
          }
        }
      }
    }

    if (merchantData) {
      registered = true;
      reasons.push(`Merchant found in facilitator discovery registry: "${merchantData.name || "Unnamed Merchant"}"`);

      // Check settlement history
      const totalVerifications = merchantData.totalVerifications || 0;
      const settleCount = merchantData.settleCount || 0;
      if (totalVerifications > 0 || settleCount > 0) {
        hasSettlementHistory = true;
        reasons.push(`Active settlement history observed (${totalVerifications} verifications, ${settleCount} settles)`);
      } else {
        reasons.push("No historical settlement activity found for this merchant");
      }

      // Check if price matches declared resources
      let acceptsList: any[] = [];
      if (resourceData && resourceData.accepts) {
        acceptsList = resourceData.accepts;
      } else if (merchantData.resources && merchantData.resources.length > 0) {
        // If we queried the merchant profile, it contains all its resources
        const matchingResource = merchantData.resources.find((r: any) => 
          r.resourceUrl?.toLowerCase().includes(merchantAddress.toLowerCase())
        ) || merchantData.resources[0];
        if (matchingResource && matchingResource.accepts) {
          acceptsList = matchingResource.accepts;
        }
      }

      if (claimedPrice && acceptsList.length > 0) {
        // Look for matching asset price in accepts
        const match = acceptsList.find((acc: any) => {
          // Check asset matching (could be asset ID like 10458941 or ticker symbol like USDC)
          const assetMatches = acc.asset === claimedPrice.asset || 
                               (claimedPrice.asset === "USDC" && acc.asset === "10458941") || 
                               (claimedPrice.asset === "ALGO" && acc.asset === "0"); // 0 for native ALGO or as specified
          
          // Price checking - match amount
          const amountMatches = acc.amount === claimedPrice.amount || acc.maxAmountRequired === claimedPrice.amount;
          return assetMatches && amountMatches;
        });

        if (match) {
          priceMatchesDeclared = true;
          reasons.push("Claimed price matches the merchant's registered price schema");
        } else {
          reasons.push("Warning: Claimed price does not match any registered price schema in the bazaar catalog");
        }
      } else if (claimedPrice) {
        reasons.push("Unable to verify price matching: merchant has no registered price schemas");
      }

      // Derive final verdict based on history and registration
      if (hasSettlementHistory) {
        verdict = "trusted";
      } else {
        verdict = "unverified";
      }

    } else {
      // Not registered
      verdict = "high_risk";
      reasons.push("Target merchant address is unregistered in GoPlausible Bazaar");
      reasons.push("Zero settlement history observed on-chain");
    }

  } catch (err: any) {
    console.error("Facilitator query error:", err);
    reasons.push(`Registry lookup failed: ${err.message || err}`);
  }

  // 3. Extract transaction details from payment-signature header
  const paymentHeader = c.req.header("payment-signature") || c.req.header("x-payment");
  console.log("DEBUG: raw paymentHeader =", paymentHeader ? `${paymentHeader.substring(0, 50)}...` : "undefined");
  let txId = "unknown";

  if (paymentHeader) {
    try {
      const decodedHeader = paymentHeader.startsWith("{") 
        ? paymentHeader 
        : atob(paymentHeader);
      console.log("DEBUG: decodedHeader =", decodedHeader.substring(0, 100));
      
      const rootPayload = JSON.parse(decodedHeader);
      console.log("DEBUG: parsed rootPayload =", JSON.stringify(rootPayload).substring(0, 100));
      
      const payload = rootPayload.payload || rootPayload;
      console.log("DEBUG: parsed inner payload =", JSON.stringify(payload).substring(0, 100));

      if (payload && Array.isArray(payload.paymentGroup) && payload.paymentGroup.length > 0) {
        const index = payload.paymentIndex !== undefined ? payload.paymentIndex : 0;
        const payTxBase64 = payload.paymentGroup[index];
        if (payTxBase64) {
          const binaryString = atob(payTxBase64);
          const txnBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            txnBytes[i] = binaryString.charCodeAt(i);
          }
          txId = getTransactionId(txnBytes);
          console.log("DEBUG: extracted txId =", txId);
        } else {
          console.log("DEBUG: payTxBase64 is empty for index", index);
        }
      } else {
        console.log("DEBUG: payload.paymentGroup is not a valid array or is empty");
      }
    } catch (e: any) {
      console.error("DEBUG: Error parsing payment signature header:", e.message || e);
    }
  }

  // Derive score, risk level, and recommendation
  let reputationScore = 0;
  let riskLevel = "high";
  let recommendation = "abort";

  if (verdict === "trusted") {
    reputationScore = priceMatchesDeclared ? 100 : 85;
    riskLevel = "low";
    recommendation = policyDecision === "allow" ? "proceed" : "abort";
  } else if (verdict === "unverified") {
    reputationScore = 50;
    riskLevel = "medium";
    recommendation = policyDecision === "allow" ? "proceed_with_caution" : "abort";
  } else {
    reputationScore = 15;
    riskLevel = "high";
    recommendation = "abort";
  }

  return c.json({
    trust: {
      verdict,
      registered,
      hasSettlementHistory,
      priceMatchesDeclared,
      reputationScore,
      riskLevel,
      recommendation,
      reasons,
      timestamp: new Date().toISOString()
    },
    spendPolicy: {
      decision: policyDecision,
      reason: policyReason
    },
    settlement: {
      txId,
      network: "algorand-testnet",
      amountCharged: "0.01 USDC"
    }
  });
});

export default app;
