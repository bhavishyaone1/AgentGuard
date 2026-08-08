const { wrapFetchWithPaymentFromConfig } = require("@x402/fetch");
const { ExactAvmScheme } = require("@x402/avm/exact/client");
const { toClientAvmSigner } = require("@x402/avm");
const algosdk = require("algosdk");

const mnemonic = "sun sign term dash tube control method lumber elephant cause illegal arch pioneer soccer juice search isolate chimney thunder course liquid alarm element able catalog";
const serverUrl = "https://agentguard.bakshibhavi.workers.dev/api/check";
const ALGORAND_TESTNET_CAIP2 = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

const targetsToTest = [
  {
    name: "ALGOMetrics (Live Merchant Endpoint)",
    address: "api.algometrics.org",
    price: "10000",
    maxPerCall: "50000",
    maxDaily: "200000"
  },
  {
    name: "GoPlausible (Registered Bazaar Address)",
    address: "GDOR5JNJX6K4T2F76NZB7UOW2P5HVDMTGNDV6L6L437435KJZ4Z6U37E",
    price: "15000",
    maxPerCall: "50000",
    maxDaily: "200000"
  },
  {
    name: "Policy Limit Breach Test (Price > Limit)",
    address: "api.algometrics.org",
    price: "80000", // 0.08 USDC (Exceeds 0.05 limit)
    maxPerCall: "50000", // 0.05 USDC limit
    maxDaily: "200000"
  },
  {
    name: "Unregistered Scammer Address Simulation",
    address: "7Y4TGDJSHS5J4LHGKSLK5HJSKL44JLJDFSLDJKDFSD45FDGDFGDFGDG2",
    price: "10000",
    maxPerCall: "50000",
    maxDaily: "200000"
  }
];

async function runBatchTests() {
  console.log("==================================================");
  console.log("🧪 BATCH AUDIT: TESTING MULTIPLE ALGORAND TARGETS");
  console.log("==================================================");

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const signer = toClientAvmSigner(Buffer.from(account.sk).toString("base64"));
  
  const config = {
    schemes: [
      {
        network: ALGORAND_TESTNET_CAIP2,
        client: new ExactAvmScheme(signer),
      },
    ],
  };

  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, config);

  for (let i = 0; i < targetsToTest.length; i++) {
    const t = targetsToTest[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[Test ${i + 1}/${targetsToTest.length}] Target: ${t.name}`);
    console.log(`Address/Host: ${t.address}`);
    console.log(`Claimed Price: ${(Number(t.price)/1000000).toFixed(4)} USDC | Limit: ${(Number(t.maxPerCall)/1000000).toFixed(4)} USDC`);
    
    try {
      const res = await fetchWithPay(serverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantAddress: t.address,
          claimedPrice: { amount: t.price, asset: "USDC" },
          callerSpendPolicy: { maxPerCall: t.maxPerCall, maxDailyRemaining: t.maxDaily }
        })
      });

      const data = await res.json();
      console.log(`📥 Status: ${res.status} ${res.statusText}`);
      console.log(`📊 Verdict: ${data.trust?.verdict?.toUpperCase()}`);
      console.log(`⭐ Reputation Score: ${data.trust?.reputationScore}/100`);
      console.log(`⚠️ Risk Level: ${data.trust?.riskLevel?.toUpperCase()}`);
      console.log(`🎯 Action Recommendation: ${data.trust?.recommendation?.toUpperCase()}`);
      console.log(`🛡️ Spend Policy Decision: ${data.spendPolicy?.decision?.toUpperCase()} (${data.spendPolicy?.reason})`);
      if (data.settlement?.txId) {
        console.log(`⛓️ On-Chain Tx ID: ${data.settlement.txId}`);
      }
    } catch (err) {
      console.error(`❌ Test failed:`, err.message || err);
    }
  }

  console.log("\n==================================================");
  console.log("🎉 ALL BATCH TESTS COMPLETED!");
  console.log("==================================================");
}

runBatchTests();
