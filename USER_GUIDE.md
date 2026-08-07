# AgentGuard: Developer Integration & User Guide

Welcome to the **AgentGuard** Developer Guide. This document explains the codebase verification, detailing how organizations and developers integrate AgentGuard to protect their autonomous AI agents from payment fraud.

---

## ⚡ 1. How Organizations Use AgentGuard

Organizations run AgentGuard as a **Pre-Payment Security Gateway**. 

Whenever an autonomous AI agent needs to query a third-party paid API, database, or resource, the agent does not call the merchant directly. Instead, it wraps its request using the AgentGuard client-side SDK.

### The Integration Flow:
1.  **AI Script**: The organization's AI agent initiates a resource request.
2.  **Firewall Auditing**: AgentGuard intercepts the request to verify the merchant's on-chain registration and check if the claimed price complies with the organization's preset spend policies.
3.  **Audited Gate Settlement**: If the checks pass, the transaction is signed, a minor query fee ($0.01 USDC) settles on the Algorand blockchain, and the merchant resource is safely released.

---

## 📡 2. Input and Output Structure

### A. How to Provide Input (The Request)
To check a target merchant, your AI agent submits a `POST` request to the AgentGuard `/api/check` gateway endpoint:

*   **Endpoint**: `/api/check`
*   **Headers**: `Content-Type: application/json`
*   **Request Body**:
```json
{
  "merchantAddress": "api.algometrics.org",
  "claimedPrice": {
    "amount": "10000",
    "asset": "USDC"
  },
  "callerSpendPolicy": {
    "maxPerCall": "50000",
    "maxDailyRemaining": "200000"
  }
}
```

#### Input Fields:
| Parameter | Type | Description |
| :--- | :---: | :--- |
| **`merchantAddress`** | `string` | The target merchant's API endpoint hostname or on-chain Algorand address. |
| **`claimedPrice.amount`** | `string` | The price claimed by the merchant (in base units: `10000` base = 0.01 USDC). |
| **`claimedPrice.asset`** | `string` | The on-chain asset class (currently `USDC`). |
| **`callerSpendPolicy.maxPerCall`** | `string` | The max USDC base amount permitted for a single transaction. |
| **`callerSpendPolicy.maxDailyRemaining`** | `string` | The remaining aggregated budget for the day. |

---

### B. How the Output is Received (The Response)
If the on-chain query payment settles successfully, the gateway returns a `200 OK` response with a detailed auditing report:

```json
{
  "trust": {
    "verdict": "trusted",
    "registered": true,
    "hasSettlementHistory": true,
    "priceMatchesDeclared": false,
    "reputationScore": 85,
    "riskLevel": "low",
    "recommendation": "proceed",
    "reasons": [
      "Input resolved to a merchant endpoint/URL",
      "Merchant found in facilitator discovery registry: \"Unnamed Merchant\"",
      "Active settlement history observed (0 verifications, 90 settles)",
      "Warning: Claimed price does not match any registered price schema in the bazaar catalog"
    ],
    "timestamp": "2026-08-07T16:20:07.116Z"
  },
  "spendPolicy": {
    "decision": "allow",
    "reason": "Within per-call and daily limits"
  },
  "settlement": {
    "txId": "5PLD2G7TYEXNHAE36W4C445JSXPURWOVSW2Z5QGS4LPC77O2URRA",
    "network": "algorand-testnet",
    "amountCharged": "0.01 USDC"
  }
}
```

#### Enriched Output Fields:
*   **`reputationScore`** (`number`): A trust score from 0 to 100 based on registration standing and settlement history.
*   **`riskLevel`** (`low` | `medium` | `high`): The security risk classification.
*   **`recommendation`** (`proceed` | `proceed_with_caution` | `abort`): Definitive suggested action for the AI.
*   **`spendPolicy.decision`** (`allow` | `deny`): Decides if the transaction breaches local budget gates.
*   **`settlement.txId`** (`string`): The Algorand TestNet transaction ID confirming the audit fee payment.

---

## 💻 3. SDK Code Integration Example

Organizations integrate AgentGuard directly into their Python or TypeScript AI agent scripts by wrapping the standard `fetch` call with the `@x402/fetch` wrapper.

### TypeScript / Node.js Implementation:
```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner } from "@x402/avm";

// 1. Recover your agent's private keys (using process environment)
const signer = toClientAvmSigner(process.env.AGENT_PRIVATE_KEY_BASE64);

// 2. Configure the x402 payment scheme parameters
const config = {
  schemes: [
    {
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      client: new ExactAvmScheme(signer),
    },
  ],
};

// 3. Wrap the native fetch client
const auditedFetch = wrapFetchWithPaymentFromConfig(fetch, config);

// 4. Query the secure resource
const response = await auditedFetch("http://localhost:8787/api/check", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    merchantAddress: "api.algometrics.org",
    claimedPrice: { amount: "10000", asset: "USDC" },
    callerSpendPolicy: { maxPerCall: "50000", maxDailyRemaining: "200000" }
  })
});

const data = await response.json();
console.log(`Verdict: ${data.trust.verdict.toUpperCase()}`);
// Proceed with primary purchase only if verdict is TRUSTED
```
