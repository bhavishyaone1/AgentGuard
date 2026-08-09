# 🛡️ AgentGuard

> **Autonomous AI Micropayment Security & Pre-Payment Trust Firewall on Algorand.**

[![Live Web App](https://img.shields.io/badge/Live_App-Vercel-000000?style=for-the-badge&logo=vercel)](https://agent-guard-two.vercel.app)
[![API Gateway](https://img.shields.io/badge/API_Gateway-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare)](https://agentguard.bakshibhavi.workers.dev)
[![Blockchain](https://img.shields.io/badge/Blockchain-Algorand_Testnet-000000?style=for-the-badge&logo=algorand)](https://testnet.algoexplorer.io)
[![Standard](https://img.shields.io/badge/Micropayment-x402_AVM_Standard-8B5CF6?style=for-the-badge)](https://facilitator.goplausible.xyz)

---

## 📌 Overview

As autonomous AI agents evolve from read-only assistants into economic actors capable of executing tool calls, they face a critical vulnerability: **blind pre-payment**. Script-based agents blindly sign transactions for paid APIs and services, making them prime targets for:

* **Drainage Loops & Overcharging**: Malicious APIs inflating prices beyond authorized budgets.
* **Rug-Pulls & Zero-History Vendors**: Unregistered endpoints vanishing after receiving payments.
* **Cross-Chain Traps**: Sending Algorand USDC to foreign EVM addresses, resulting in permanent token burning.

**AgentGuard** acts as an **on-chain pre-payment firewall**. Before an AI agent releases payment to a merchant, AgentGuard intercepts the request, audits the merchant against the **GoPlausible Bazaar registry**, enforces local **spend policies**, and assigns a deterministic **Reputation Trust Score (0–100)** on Algorand before any primary funds transfer.

---

## 🏛️ Protocol Architecture Pipeline

```
[ AI Agent / Payer Wallet ]
            │
            ▼
   1. Requests Paid API Resource
            │
            ▼
[ HTTP 402 Payment Required ] ──► (Triggered via x402 AVM Standard)
            │
            ▼
[ AgentGuard Security Firewall ]
   ├── 🔍 GoPlausible Bazaar Registry Audit (On-Chain Settlement History)
   ├── 🛡️ Spend Policy Rule Engine (Max Per-Call & Daily Remaining Limits)
   └── ⚡ Zero-Trust Chain Detection (Flags Foreign EVM / Unregistered Traps)
            │
            ▼
[ AVM Atomic Settlement ] ──► ($0.01 USDC Audit Fee Settled via Facilitator)
            │
            ▼
[ Real-Time Security Verdict ]
   ├── Score: 85-100 ──► ✅ PROCEED (Safe to Pay)
   ├── Score: 50     ──► ⚠️ CAUTION (Unverified Provider)
   └── Score: 15     ──► 🛑 ABORT   (Scam / Foreign Chain Blocked)
```

---

## 📊 Algorithmic Scoring Matrix (0–100)

AgentGuard calculates reputation scores deterministically on the Algorand ledger:

| Tier | Reputation Score | Criteria | Firewall Action |
| :--- | :---: | :--- | :---: |
| **Verified Elite** | **`100 / 100`** | Registered in GoPlausible Bazaar + active settlements + claimed price strictly matches declared catalog schema. | **`PROCEED`** ✅ |
| **Trusted Vendor** | **`85 / 100`** | Registered in Bazaar with proven on-chain transaction history (e.g. 90+ verified settles on Algorand). | **`PROCEED`** ✅ |
| **Unverified New** | **`50 / 100`** | Valid Algorand public key in network index, but has 0 historical transactions (brand-new provider). | **`CAUTION`** ⚠️ |
| **High Risk / Scam** | **`15 / 100`** | Unregistered target, fake mock address, or foreign EVM address (`0x...`). Firewall aborts payment to prevent loss. | **`ABORT`** 🛑 |

---

## 💻 Multi-Framework SDK Drop-In

Integrating AgentGuard into autonomous AI frameworks requires only 3 lines of code:

### 1. TypeScript / Node.js
```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner } from "@x402/avm";

// 1. Recover your agent's private key
const signer = toClientAvmSigner(process.env.AGENT_SECRET_KEY);
const config = { 
  schemes: [{ 
    network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", 
    client: new ExactAvmScheme(signer) 
  }] 
};

// 2. Wrap native fetch with x402 pre-payment firewall
const auditedFetch = wrapFetchWithPaymentFromConfig(fetch, config);

// 3. Pre-payment audit executes on-chain before primary funds move
const res = await auditedFetch("https://agentguard.bakshibhavi.workers.dev/api/check", {
  method: "POST",
  body: JSON.stringify({ 
    merchantAddress: "api.algometrics.org", 
    claimedPrice: { amount: "10000", asset: "USDC" },
    callerSpendPolicy: { maxPerCall: "50000", maxDailyRemaining: "200000" }
  })
});

const verdict = await res.json();
if (verdict.trust.recommendation === "proceed") {
  console.log("Safe to pay merchant! Releasing primary payment...");
}
```

### 2. Python (Native)
```python
import requests
from x402 import wrap_session

session = wrap_session(private_key=os.environ["AGENT_PRIVATE_KEY"])

response = session.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
    "merchantAddress": "api.algometrics.org",
    "claimedPrice": {"amount": "10000", "asset": "USDC"},
    "callerSpendPolicy": {"maxPerCall": "50000", "maxDailyRemaining": "200000"}
})

verdict = response.json()
if verdict["trust"]["recommendation"] == "proceed":
    print("Safe to pay merchant! Releasing primary payment...")
```

### 3. LangChain Agents
```python
from langchain.tools import tool
import requests

@tool
def agentguard_pre_payment_check(merchant_url: str, amount_usdc: str) -> str:
    """Audits a merchant endpoint on Algorand before releasing payment."""
    res = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
        "merchantAddress": merchant_url,
        "claimedPrice": {"amount": amount_usdc, "asset": "USDC"}
    })
    verdict = res.json()
    if verdict["trust"]["recommendation"] != "proceed":
        raise Exception(f"Security Alert: High-risk merchant blocked! ({verdict['trust']['reputationScore']}/100)")
    return "VERIFIED SAFE: Proceed with purchase."
```

### 4. CrewAI Teams
```python
from crewai_tools import tool
import requests

@tool("AgentGuard Security Gate")
def audit_merchant(merchant_address: str, price_base: str) -> str:
    """Audits merchant trust and spend limits on Algorand before paying."""
    r = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
        "merchantAddress": merchant_address,
        "claimedPrice": {"amount": price_base, "asset": "USDC"}
    })
    data = r.json()
    return f"Verdict: {data['trust']['verdict'].upper()} (Score: {data['trust']['reputationScore']}/100)"
```

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | React 19, Vite, TypeScript, TailwindCSS | High-contrast dark dashboard with continuous storytelling layout. |
| **Animations & Motion** | Framer Motion | Scroll-spy navbar tracking, spring physics, and top progress bar. |
| **Backend API Gateway** | Cloudflare Workers, Hono | Global low-latency edge proxy executing policy rules and x402 headers. |
| **x402 Micropayment SDK** | `@x402/fetch`, `@x402/hono`, `@x402/avm` | Standardized HTTP 402 negotiation on the Algorand Virtual Machine (AVM). |
| **Blockchain Settlement** | Algorand Testnet (AVM) | Instant ~3.3s block finality with gasless fee delegation via facilitator. |
| **Merchant Registry** | GoPlausible Bazaar | On-chain decentralized provider discovery and schema validation. |

---

## ⚡ Quick Start Guide (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/bhavishyaone1/AgentGuard.git
cd AgentGuard

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../client && npm install
```

### 2. Launch Local Dev Servers
```bash
# Terminal 1: Start Hono API Backend (Port 8787)
cd server && npm run dev

# Terminal 2: Start React Frontend (Port 5173)
cd client && npm run dev
```

Open [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## 🌐 Production Deployment

### 1. Backend (Cloudflare Workers)
```bash
cd server
npx wrangler deploy
```

### 2. Frontend (Vercel)
```bash
cd client
npm run build
```
Deploy the `client/` directory directly to Vercel via Git integration or `vercel deploy`.

---

## ⛓️ Mainnet Transition Reference

To transition AgentGuard to Algorand Mainnet, update your configuration parameters:

| Parameter | Algorand Testnet | Algorand Mainnet |
| :--- | :--- | :--- |
| **CAIP-2 Chain ID** | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` |
| **USDC ASA ID** | `10458941` | `31566704` |
| **Algod Node URL** | `https://testnet-api.algonode.cloud` | `https://mainnet-api.algonode.cloud` |
| **Facilitator Gateway** | `https://facilitator.goplausible.xyz` | `https://facilitator.goplausible.xyz` |

---

## 📄 License & Attribution

Distributed under the MIT License. Built for the autonomous AI economy, secured on Algorand.
