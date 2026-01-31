---
name: breezclaw
description: "Self-custodial Bitcoin and Lightning wallet for AI agents. Send and receive sats via Lightning Network, Spark, or on-chain Bitcoin. Use when: checking bitcoin balance, sending/receiving payments, generating Lightning invoices, managing wallet operations. Requires the BreezClaw plugin and a Breez API key."
version: 1.0.0
author: OpenClaw
keywords: bitcoin, lightning, wallet, breez, spark, sats, payments, self-custodial, breezclaw
---

# BreezClaw

Self-custodial Bitcoin and Lightning wallet powered by Breez SDK Spark.

## Setup

### 1. Install the Plugin

```bash
# Clone the plugin repository
cd ~/.openclaw/extensions
git clone https://github.com/onesandzeros-nz/BreezClaw.git bitcoin-wallet

# Install dependencies and build
cd bitcoin-wallet
npm install
npm run build
```

### 2. Get a Breez API Key

1. Go to https://breez.technology/sdk/
2. Sign up for API access
3. Copy your API key

### 3. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "breezclaw": {
        "enabled": true,
        "config": {
          "breezApiKey": "YOUR_BREEZ_API_KEY",
          "network": "mainnet"
        }
      }
    }
  }
}
```

### 4. Restart Gateway

```bash
openclaw gateway restart
```

## Tools

| Tool | Description |
|------|-------------|
| `wallet_status` | Check if wallet exists and connection state |
| `wallet_connect` | Connect or create wallet from mnemonic |
| `wallet_balance` | Get balance in sats and BTC |
| `wallet_receive` | Generate payment request (Spark/Lightning/Bitcoin) |
| `wallet_prepare_send` | Prepare payment with fee estimate |
| `wallet_send` | Execute confirmed payment |
| `wallet_transactions` | List transaction history |
| `wallet_info` | Detailed wallet information |
| `wallet_backup` | Retrieve mnemonic (sensitive!) |
| `wallet_disconnect` | Clean disconnect |

## Receive Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| `spark` | Reusable Spark address | Default, any amount |
| `spark_invoice` | Spark invoice | Specific amount |
| `lightning` | BOLT11 invoice | Standard Lightning |
| `bitcoin` | On-chain address | Larger amounts |

## Payment Flow

**Always use two-step send:**

1. `wallet_prepare_send` → Show fees to user
2. User confirms → `wallet_send` with `confirmed: true`

## Security

- Never expose mnemonics unless explicitly requested
- Always show fees before sending
- Require explicit user confirmation for sends
- Wallet data stored in `~/.openclaw/breezclaw/`

## Examples

**Check balance:**
```
"What's my Bitcoin balance?"
→ wallet_balance
```

**Receive Lightning:**
```
"Generate invoice for 1000 sats"
→ wallet_receive(method="lightning", amount_sats=1000)
```

**Send to Lightning address:**
```
"Send 500 sats to user@wallet.com"
→ Resolve LNURL → wallet_prepare_send → confirm → wallet_send
```

**QR codes:**
Generate with `qrcode` npm package for invoices.
