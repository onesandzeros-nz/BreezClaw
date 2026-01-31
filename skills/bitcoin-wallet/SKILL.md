---
name: bitcoin-wallet
description: Self-custodial Bitcoin and Lightning wallet for sending and receiving sats
user-invocable: true
triggers: ["bitcoin", "btc", "sats", "satoshis", "lightning", "wallet", "balance", "send bitcoin", "receive bitcoin", "payment"]
metadata: {"requires": {"env": ["BREEZ_API_KEY"]}}
---

# Bitcoin Wallet Skill

This skill provides a self-custodial Bitcoin and Lightning wallet powered by Breez SDK Spark. It allows AI agents to check balances, send payments, receive payments, and manage wallet operations.

## Available Tools

### wallet_status
Check if a wallet exists and whether it's connected. Does not require an active connection.

### wallet_connect
Connect to an existing wallet or create/restore a wallet from a mnemonic seed phrase.

### wallet_balance
Get the current wallet balance in satoshis and BTC.

### wallet_receive
Generate payment requests to receive funds:
- `spark` - Reusable Spark address (default)
- `spark_invoice` - Spark invoice with specific amount
- `lightning` - BOLT11 Lightning invoice
- `bitcoin` - On-chain Bitcoin address

### wallet_prepare_send
Prepare a payment and get fee estimate. **Always use this before wallet_send** to show the user the amount and fees for confirmation.

### wallet_send
Execute a prepared payment after user confirmation.

### wallet_transactions
List transaction history with optional pagination.

### wallet_info
Get detailed wallet information including balance and network status.

### wallet_backup
Retrieve the wallet mnemonic seed phrase. **Only use when explicitly requested** - this exposes sensitive data.

### wallet_disconnect
Cleanly disconnect from the wallet.

## Security Guidelines

1. **Never expose mnemonics** unless the user explicitly requests a backup
2. **Always use wallet_prepare_send** before wallet_send to show fees
3. **Require explicit confirmation** for all send operations
4. **Warn about large amounts** when sending significant sats

## Example Workflows

### Check Balance
```
User: "What's my bitcoin balance?"
Agent: Uses wallet_status, then wallet_connect if needed, then wallet_balance
```

### Receive Payment
```
User: "Generate a Lightning invoice for 10000 sats"
Agent: Uses wallet_receive with method="lightning" and amount_sats=10000
```

### Send Payment
```
User: "Send 5000 sats to lnbc..."
Agent:
1. Uses wallet_prepare_send to get fee estimate
2. Shows user the total amount and fees
3. After user confirms, uses wallet_send with confirmed=true
```
