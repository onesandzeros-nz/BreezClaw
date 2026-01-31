import { Type } from '@sinclair/typebox';
import * as wallet from './wallet.js';
// Cached prepare response for two-step send flow
let lastPrepareResponse = null;
function textResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}
function errorResult(error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
        isError: true
    };
}
export function register(api) {
    // Initialize API key from config if provided
    if (api.config.breezApiKey) {
        wallet.setApiKey(api.config.breezApiKey);
    }
    // Register background service for cleanup
    api.registerService({
        id: 'bitcoin-wallet-service',
        start: () => {
            api.logger.info('Bitcoin wallet plugin ready');
        },
        stop: async () => {
            await wallet.disconnectWallet();
            api.logger.info('Bitcoin wallet disconnected');
        }
    });
    // wallet_status - Check wallet state (no connection required)
    api.registerTool({
        name: 'wallet_status',
        description: 'Check if Bitcoin wallet exists and is connected. Does not require active connection.',
        parameters: Type.Object({}),
        async execute(_id, _params) {
            try {
                const status = wallet.getWalletStatus();
                return textResult({
                    connected: status.connected,
                    walletExists: status.hasWallet,
                    message: status.connected
                        ? 'Wallet is connected and ready'
                        : status.hasWallet
                            ? 'Wallet exists but not connected. Use wallet_connect to connect.'
                            : 'No wallet found. Use wallet_connect with a mnemonic to create or restore a wallet.'
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_connect - Initialize/connect wallet
    api.registerTool({
        name: 'wallet_connect',
        description: 'Connect to the Bitcoin/Lightning wallet. Requires a 12 or 24 word mnemonic to create or restore a wallet.',
        parameters: Type.Object({
            mnemonic: Type.Optional(Type.String({
                description: '12 or 24 word mnemonic seed phrase to create/restore wallet'
            }))
        }),
        async execute(_id, params) {
            try {
                const mnemonic = params.mnemonic;
                const result = await wallet.connectWallet(mnemonic);
                let message = result.message;
                if (result.isNew) {
                    message += '\n\nIMPORTANT: A new wallet has been created. Use wallet_backup to save your recovery phrase securely.';
                }
                return textResult({
                    success: result.success,
                    message,
                    isNewWallet: result.isNew
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_balance - Get current balance
    api.registerTool({
        name: 'wallet_balance',
        description: 'Get the current Bitcoin wallet balance in satoshis and BTC.',
        parameters: Type.Object({}),
        async execute(_id, _params) {
            try {
                const balance = await wallet.getBalance();
                return textResult({
                    balanceSats: balance.balanceSats,
                    balanceBtc: wallet.formatSatsToBtc(balance.balanceSats)
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_receive - Generate payment request
    api.registerTool({
        name: 'wallet_receive',
        description: 'Generate a payment request to receive Bitcoin. Can generate Spark address, Spark invoice, Lightning invoice, or on-chain Bitcoin address.',
        parameters: Type.Object({
            method: Type.Optional(Type.Union([
                Type.Literal('spark'),
                Type.Literal('spark_invoice'),
                Type.Literal('lightning'),
                Type.Literal('bitcoin')
            ], {
                description: 'Payment method: spark (default, reusable), spark_invoice, lightning, or bitcoin'
            })),
            amount_sats: Type.Optional(Type.Number({
                description: 'Amount in satoshis (required for invoices, optional for addresses)'
            })),
            description: Type.Optional(Type.String({
                description: 'Description/memo for the payment request'
            }))
        }),
        async execute(_id, params) {
            try {
                const method = params.method || 'spark';
                const amountSats = params.amount_sats;
                const description = params.description;
                const response = await wallet.receivePayment(method, amountSats, description);
                return textResult({
                    method,
                    paymentRequest: response.paymentRequest,
                    feeSats: Number(response.fee),
                    amountSats: amountSats ?? 'any amount'
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_prepare_send - Prepare payment with fee estimate
    api.registerTool({
        name: 'wallet_prepare_send',
        description: 'Prepare a Bitcoin payment and get fee estimate. ALWAYS use this before wallet_send to show fees to user for confirmation.',
        parameters: Type.Object({
            payment_request: Type.String({
                description: 'Payment destination: Spark address, Spark invoice, Lightning invoice, LNURL, Lightning address, or Bitcoin address'
            }),
            amount_sats: Type.Optional(Type.Number({
                description: 'Amount in satoshis (required for addresses, optional for invoices with amount)'
            }))
        }),
        async execute(_id, params) {
            try {
                const paymentRequest = params.payment_request;
                const amountSats = params.amount_sats;
                if (!paymentRequest) {
                    throw new Error('payment_request is required');
                }
                const prepareResponse = await wallet.prepareSend(paymentRequest, amountSats);
                lastPrepareResponse = prepareResponse;
                const amount = Number(prepareResponse.amount);
                return textResult({
                    paymentMethod: prepareResponse.paymentMethod,
                    amountSats: amount,
                    amountBtc: wallet.formatSatsToBtc(amount),
                    message: 'Review the amount above. If the user confirms, use wallet_send with confirmed: true to execute the payment.'
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_send - Execute prepared payment
    api.registerTool({
        name: 'wallet_send',
        description: 'Execute a prepared Bitcoin payment. MUST call wallet_prepare_send first and get user confirmation before calling this.',
        parameters: Type.Object({
            confirmed: Type.Boolean({
                description: 'Must be true to confirm user has approved the payment'
            })
        }),
        async execute(_id, params) {
            try {
                const confirmed = params.confirmed;
                if (!confirmed) {
                    return textResult({
                        error: 'User confirmation required',
                        message: 'Set confirmed: true only after the user has explicitly approved the payment amount and fees.'
                    });
                }
                if (!lastPrepareResponse) {
                    throw new Error('No prepared payment found. Use wallet_prepare_send first.');
                }
                const result = await wallet.sendPayment(lastPrepareResponse);
                lastPrepareResponse = null;
                return textResult({
                    success: true,
                    payment: wallet.formatPayment(result.payment)
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_transactions - List transaction history
    api.registerTool({
        name: 'wallet_transactions',
        description: 'List Bitcoin wallet transaction history.',
        parameters: Type.Object({
            limit: Type.Optional(Type.Number({
                description: 'Maximum number of transactions to return (default: 10)'
            })),
            offset: Type.Optional(Type.Number({
                description: 'Number of transactions to skip for pagination'
            }))
        }),
        async execute(_id, params) {
            try {
                const limit = params.limit || 10;
                const offset = params.offset;
                const result = await wallet.listTransactions(limit, offset);
                return textResult({
                    transactions: result.payments.map(p => wallet.formatPayment(p)),
                    count: result.payments.length
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_info - Get detailed wallet info
    api.registerTool({
        name: 'wallet_info',
        description: 'Get detailed Bitcoin wallet information including balance and network status.',
        parameters: Type.Object({}),
        async execute(_id, _params) {
            try {
                const info = await wallet.getWalletInfo();
                const balance = await wallet.getBalance();
                return textResult({
                    balance: {
                        balanceSats: balance.balanceSats,
                        balanceBtc: wallet.formatSatsToBtc(balance.balanceSats)
                    },
                    tokenBalances: info.tokenBalances,
                    network: 'mainnet'
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_backup - Get mnemonic (sensitive!)
    api.registerTool({
        name: 'wallet_backup',
        description: 'Retrieve wallet mnemonic seed phrase for backup. WARNING: Exposes sensitive data. Only use when explicitly requested by user.',
        parameters: Type.Object({
            confirm: Type.Boolean({
                description: 'Must be true to confirm user wants to see the mnemonic'
            })
        }),
        async execute(_id, params) {
            try {
                const confirm = params.confirm;
                if (!confirm) {
                    return textResult({
                        error: 'Confirmation required',
                        message: 'Set confirm: true to retrieve the mnemonic. This will expose your wallet recovery phrase.'
                    });
                }
                const mnemonic = wallet.getMnemonic();
                if (!mnemonic) {
                    throw new Error('No wallet found. Connect to a wallet first.');
                }
                return textResult({
                    warning: 'KEEP THIS SAFE! Anyone with this phrase can access your funds.',
                    mnemonic: mnemonic,
                    wordCount: mnemonic.split(' ').length
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
    // wallet_disconnect - Clean disconnect
    api.registerTool({
        name: 'wallet_disconnect',
        description: 'Disconnect from the Bitcoin wallet cleanly.',
        parameters: Type.Object({}),
        async execute(_id, _params) {
            try {
                await wallet.disconnectWallet();
                return textResult({
                    success: true,
                    message: 'Wallet disconnected'
                });
            }
            catch (error) {
                return errorResult(error);
            }
        }
    });
}
// Alias for OpenClaw compatibility
export const activate = register;
//# sourceMappingURL=index.js.map