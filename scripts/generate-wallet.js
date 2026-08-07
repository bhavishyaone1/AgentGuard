const algosdk = require('algosdk');
const readline = require('readline');

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = '';
const ALGOD_TOKEN = '';
const USDC_ASA_ID = 10458941;

const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function checkBalance(address) {
  try {
    const accountInfo = await client.accountInformation(address).do();
    const algoBalance = accountInfo.amount / 1_000_000;
    let usdcBalance = 0;
    let isOptedIn = false;

    for (const asset of accountInfo['assets'] || []) {
      if (asset['asset-id'] === USDC_ASA_ID) {
        usdcBalance = asset['amount'] / 1_000_000; // USDC has 6 decimals
        isOptedIn = true;
        break;
      }
    }
    return { algoBalance, usdcBalance, isOptedIn };
  } catch (err) {
    return { algoBalance: 0, usdcBalance: 0, isOptedIn: false };
  }
}

async function performOptIn(account, name) {
  console.log(`\n⏳ Performing USDC Opt-In for ${name} (${account.addr})...`);
  try {
    const params = await client.getTransactionParams().do();
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: account.addr,
      to: account.addr,
      assetIndex: USDC_ASA_ID,
      amount: 0,
      suggestedParams: params,
    });

    const signedTxn = txn.signTxn(account.sk);
    const sendTx = await client.sendRawTransaction(signedTxn).do();
    console.log(`✅ Opt-in transaction sent! Tx ID: ${sendTx.txId}`);
    
    // Wait for confirmation
    console.log("⏳ Waiting for transaction confirmation (usually ~3 seconds)...");
    let confirmed = false;
    for (let i = 0; i < 10; i++) {
      const status = await client.pendingTransactionInformation(sendTx.txId).do();
      if (status['confirmed-round']) {
        confirmed = true;
        console.log(`🎉 Confirmed in round ${status['confirmed-round']}!`);
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!confirmed) {
      console.log("⚠️ Transaction is still pending, but it was submitted successfully.");
    }
  } catch (err) {
    console.error(`❌ Failed to opt-in ${name}:`, err.message || err);
  }
}

async function main() {
  console.log("==========================================");
  console.log("🛡️ AgentGuard Algorand Testnet Wallet Setup");
  console.log("==========================================\n");

  console.log("Generating fresh wallets...");
  
  const payer = algosdk.generateAccount();
  const merchant = algosdk.generateAccount();

  console.log("\n👤 PAYER ACCOUNT (Your AI Agent client):");
  console.log(`   Address:   ${payer.addr}`);
  console.log(`   Mnemonic:  ${algosdk.secretKeyToMnemonic(payer.sk)}`);
  
  console.log("\n🏪 MERCHANT ACCOUNT (AgentGuard payTo fee receiver):");
  console.log(`   Address:   ${merchant.addr}`);
  console.log(`   Mnemonic:  ${algosdk.secretKeyToMnemonic(merchant.sk)}`);

  console.log("\n------------------------------------------");
  console.log("👉 ACTION REQUIRED: Funding and Opt-In");
  console.log("------------------------------------------");
  console.log("1. Open the Testnet dispenser: https://bank.testnet.algorand.network/");
  console.log(`2. Fund the PAYER account (${payer.addr}) with ALGO.`);
  console.log(`3. Fund the MERCHANT account (${merchant.addr}) with ALGO.`);
  console.log("\n4. Opting into USDC requires at least 0.11 ALGO in each account.");
  console.log("5. (Optional but recommended) For testing the paid flow, your client needs test USDC.");
  console.log("   You can swap ALGO for USDC on Testnet using a test DEX or get USDC from a testnet faucet.");
  console.log("   Alternatively, the dispenser may allow USDC funding, or you can check Lora: https://lora.algokit.io/testnet/fund");
  
  console.log("\nOnce you have funded BOTH wallets with at least ~0.5-1 ALGO each, press Enter to continue...");
  await askQuestion("");

  console.log("\nChecking account balances on testnet...");
  let payerStatus = await checkBalance(payer.addr);
  let merchantStatus = await checkBalance(merchant.addr);

  console.log(`   Payer ALGO Balance: ${payerStatus.algoBalance} ALGO`);
  console.log(`   Merchant ALGO Balance: ${merchantStatus.algoBalance} ALGO`);

  if (payerStatus.algoBalance < 0.11 || merchantStatus.algoBalance < 0.11) {
    console.log("\n❌ Error: One or both accounts have insufficient ALGO to perform opt-in.");
    console.log("Please fund them and run this script again or manually opt-in.");
    process.exit(1);
  }

  // Perform Opt-ins
  if (!payerStatus.isOptedIn) {
    await performOptIn(payer, "PAYER");
  } else {
    console.log("\n✅ PAYER is already opted into USDC.");
  }

  if (!merchantStatus.isOptedIn) {
    await performOptIn(merchant, "MERCHANT");
  } else {
    console.log("✅ MERCHANT is already opted into USDC.");
  }

  console.log("\n------------------------------------------");
  console.log("📋 WALLET DETAILS FOR CONFIGURATION");
  console.log("------------------------------------------");
  console.log("To configure your Hono server, save this merchant address as MERCHANT_ADDRESS in wrangler.toml or .env:");
  console.log(`MERCHANT_ADDRESS="${merchant.addr}"`);
  console.log("\nTo configure your E2E test client, use these mnemonics:");
  console.log(`PAYER_MNEMONIC="${algosdk.secretKeyToMnemonic(payer.sk)}"`);
  console.log(`MERCHANT_MNEMONIC="${algosdk.secretKeyToMnemonic(merchant.sk)}"`);
  console.log("------------------------------------------\n");
}

main().catch(console.error);
