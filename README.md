# 🛡️ AgentGuard

> **Autonomous AI Micropayment trust check and spend-policy firewall, secured on Algorand.**

AgentGuard is a security and governance gateway built to protect autonomous AI agents executing machine-to-machine transactions. 

Before calling a machine-payable API endpoint, an agent automatically queries AgentGuard (paying a minor $0.01 USDC gate audit fee). AgentGuard queries the GoPlausible Bazaar registry (verifying domain registrations, active transaction history, and matching price schemas) and filters the check request against the agent's internal spend policy rules (e.g. per-call limit and remaining daily budget) before signing the primary transaction.

---

## 🛠️ Architecture and Safety Features
*   **Exposed CORS Headers**: Explicitly exposes `payment-required`, `x-payment-required`, and `payment-verified` headers to allow cross-origin browser dashboards to read challenge requirements without browser sandbox blockage.
*   **Client-Side Buffer Polyfill**: Pre-configured at the React application entry point (`client/src/main.tsx`) to support binary-to-base64 transaction hashing in web browser runtimes without requiring heavy Node globals.
*   **Enriched Decision Output**: The API returns detailed JSON metrics to help calling agents decide whether to proceed, audit, or abort payments:
    - `reputationScore`: A numerical rating out of 100 representing targets' trust levels.
    - `riskLevel`: Categorical evaluation (`low` | `medium` | `high`).
    - `recommendation`: Action recommendation (`proceed` | `proceed_with_caution` | `abort`).
    - `timestamp`: Precise ISO execution record of the security verification.

---

## 🚀 Quick Start Guide

### Step 1: Wallet Setup & Faucet Funding
Algorand requires accounts to explicitly opt-in to hold any Asset (such as USDC).

1. Generate your Testnet wallets:
   ```bash
   node scripts/generate-wallet.js
   ```
2. Copy the generated **Payer** address (your AI client) and **Merchant** address.
3. Fund both addresses with at least **1.5 ALGO** each using the official faucet:
   - [Algorand TestNet Dispenser](https://bank.testnet.algorand.network/)
4. Scroll to the bottom of the faucet page to the **USDC** section and fund your **Payer** address with USDC.
5. Return to the terminal and **press Enter** to let the script automatically submit the USDC opt-in transactions.

### Step 2: Configure the Gateway Server
1. Open [`server/wrangler.toml`](file:///c:/Users/bhavishya/Downloads/web-pages/x402/server/wrangler.toml) in your editor.
2. Replace `MERCHANT_ADDRESS` with your generated Merchant address:
   ```toml
   [vars]
   MERCHANT_ADDRESS = "YOUR_GENERATED_MERCHANT_ADDRESS_HERE"
   ```

### Step 3: Launch Dev Servers
1. Start the Hono backend (running locally on port `8787`):
   ```bash
   cd server
   npm run dev
   ```
2. Start the React dashboard frontend (running on port `5173`):
   ```bash
   cd client
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser. Copy the generated Payer Wallet Mnemonic from Step 1 and paste it in the settings panel to connect your wallet.

---

## 🌐 Deploying to Production

### 1. Backend (Cloudflare Workers)
Deploy the Hono gateway API publicly to Cloudflare Workers:
```bash
cd server
npx wrangler deploy
```
This returns a public `*.workers.dev` HTTPS endpoint.

### 2. Frontend (Cloudflare Pages or Vercel)
Vite generates production-ready static assets in `client/dist`:
```bash
cd client
npm run build
```
Upload the compiled `client/dist` directory to your static hosting provider (Vercel, Netlify, or Wrangler Pages). Configure your environment variable backend endpoints to point to your deployed Cloudflare Worker HTTPS address.

---

## ⛓️ Mainnet Migration

Updating the gateway to Algorand Mainnet is straightforward. Adjust the settings in your environment variables or [`server/wrangler.toml`](file:///c:/Users/bhavishya/Downloads/web-pages/x402/server/wrangler.toml):

| Configuration | Testnet | Mainnet |
|---|---|---|
| **CAIP-2 Chain ID** | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` |
| **USDC ASA ID** | `10458941` | `31566704` |
| **Algod Server URL** | `https://testnet-api.algonode.cloud` | `https://mainnet-api.algonode.cloud` |
