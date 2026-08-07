const { wrapFetchWithPaymentFromConfig } = require("@x402/fetch");
const { ExactAvmScheme } = require("@x402/avm/exact/client");
const { toClientAvmSigner } = require("@x402/avm");
const algosdk = require("algosdk");
require("dotenv").config();

const ALGORAND_TESTNET_CAIP2 = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

async function main() {
  console.log("==========================================");
  console.log("🛡️ AgentGuard E2E Payment Test Client");
  console.log("==========================================\n");

  const payerMnemonic = process.env.PAYER_MNEMONIC;
  if (!payerMnemonic) {
    console.error("❌ Error: PAYER_MNEMONIC environment variable is not set.");
    console.error("Please run: $env:PAYER_MNEMONIC=\"your mnemonic here\" before running this script.");
    process.exit(1);
  }

  // 1. Recover account from mnemonic and get private key base64
  console.log("Recovering payer account...");
  const payerAccount = algosdk.mnemonicToSecretKey(payerMnemonic);
  const payerKeyBase64 = Buffer.from(payerAccount.sk).toString("base64");
  
  console.log(`Payer address: ${payerAccount.addr}`);

  // 2. Initialize signer
  const signer = toClientAvmSigner(payerKeyBase64);

  // 3. Configure x402 Client using Config-Based wrapper
  const config = {
    schemes: [
      {
        network: ALGORAND_TESTNET_CAIP2,
        client: new ExactAvmScheme(signer),
      },
    ],
  };

  // 4. Wrap fetch
  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, config);

  // 5. Build request payload (the merchant trust query we want to make)
  const targetMerchant = process.argv[2] || "api.algometrics.org"; // target endpoint or address
  const claimedAmt = process.argv[3] || "10000"; // 0.01 USDC
  
  const payload = {
    merchantAddress: targetMerchant,
    claimedPrice: { amount: claimedAmt, asset: "USDC" },
    callerSpendPolicy: { maxPerCall: "50000", maxDailyRemaining: "200000" }
  };

  const url = process.env.SERVER_URL || "http://localhost:8787/api/check";

  console.log(`\n📡 Sending POST request to AgentGuard: ${url}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));
  console.log("x402-fetch wrapper will automatically intercept the 402, pay $0.01 USDC via the facilitator, and retry...");

  try {
    const res = await fetchWithPay(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log(`\n📥 Response Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Response Body:\n", JSON.stringify(data, null, 2));

    if (res.status === 200) {
      console.log("\n🎉 E2E Payment Flow Success!");
      console.log(`Verdict: ${data.trust.verdict.toUpperCase()}`);
      console.log(`Tx ID: ${data.settlement.txId}`);
    } else {
      console.log("\n❌ Request failed. See response details above.");
    }
  } catch (err) {
    console.error("\n❌ E2E Execution failed:", err.message || err);
  }
}

main().catch(console.error);
