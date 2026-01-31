# Bitcoin Wallet Plugin for OpenClaw

Self-custodial Bitcoin and Lightning wallet plugin for OpenClaw, powered by [Breez SDK Spark](https://breez.technology/sdk/).

## Features

- Send and receive Bitcoin via Lightning Network
- Spark addresses for instant, low-fee payments
- On-chain Bitcoin support
- Encrypted local wallet storage
- Two-step send flow with fee confirmation

## Requirements

- Node.js v22+
- OpenClaw
- Breez API key (get one at https://breez.technology/sdk/)

## Installation

1. **Clone the plugin:**
   ```bash
   git clone https://github.com/onesandzeros-nz/BreezClaw.git ~/.openclaw/extensions/bitcoin-wallet
   ```

2. **Install dependencies:**
   ```bash
   cd ~/.openclaw/extensions/bitcoin-wallet
   npm install
   npm run build
   ```

3. **Install in OpenClaw:**
   ```bash
   openclaw plugins install ~/.openclaw/extensions/bitcoin-wallet
   ```

4. **Configure the plugin** in `~/.openclaw/openclaw.json`:
   ```json
   {
     "plugins": {
       "entries": {
         "bitcoin-wallet": {
           "enabled": true,
           "config": {
             "breezApiKey": "your-breez-api-key"
           }
         }
       }
     }
   }
   ```

   Or set the environment variable:
   ```bash
   export BREEZ_API_KEY="your-breez-api-key"
   ```

5. **Restart the Gateway:**
   ```bash
   openclaw restart
   ```

## Usage

Once installed, the AI agent can use wallet tools automatically when you ask about Bitcoin:

- "What's my bitcoin balance?"
- "Generate a Lightning invoice for 10000 sats"
- "Send 5000 sats to lnbc1..."
- "Show my transaction history"

### Available Tools

| Tool | Description |
|------|-------------|
| `wallet_status` | Check wallet connection state |
| `wallet_connect` | Connect/create wallet with mnemonic |
| `wallet_balance` | Get current balance |
| `wallet_receive` | Generate payment requests |
| `wallet_prepare_send` | Prepare payment with fee estimate |
| `wallet_send` | Execute prepared payment |
| `wallet_transactions` | List transaction history |
| `wallet_info` | Detailed wallet information |
| `wallet_backup` | Retrieve mnemonic (sensitive) |
| `wallet_disconnect` | Clean disconnect |

## Security

- Wallet mnemonic is encrypted with AES-256-GCM before storage
- Encryption key derived from machine-specific data
- Wallet file stored with restricted permissions (0600)
- API key never stored locally - only in config or environment
- Two-step send requires explicit user confirmation

## Wallet Storage

Wallet data is stored at `~/.breez-wallet/`:
- `wallet.enc` - Encrypted mnemonic
- `spark-data/` - Breez SDK data

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck
```

## License

MIT
