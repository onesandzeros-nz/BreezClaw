import { connect, defaultConfig } from '@breeztech/breez-sdk-spark/nodejs';
import * as path from 'path';
import { saveWalletData, loadWalletData, walletExists, getWalletDir, deleteWalletData } from './storage.js';
let sdk = null;
let currentApiKey = null;
export function getWalletStatus() {
    return {
        connected: sdk !== null,
        hasWallet: walletExists()
    };
}
export function setApiKey(apiKey) {
    currentApiKey = apiKey;
}
export async function connectWallet(mnemonic) {
    if (sdk) {
        return { success: true, message: 'Wallet already connected', isNew: false };
    }
    const apiKey = currentApiKey || process.env.BREEZ_API_KEY;
    if (!apiKey) {
        throw new Error('Breez API key not configured. Set it in plugin config or BREEZ_API_KEY environment variable.');
    }
    let walletMnemonic;
    let isNew = false;
    if (mnemonic) {
        walletMnemonic = mnemonic;
    }
    else {
        const existingWallet = loadWalletData();
        if (existingWallet) {
            walletMnemonic = existingWallet.mnemonic;
        }
        else {
            throw new Error('No existing wallet found. Please provide a 12 or 24 word mnemonic to create/restore a wallet.');
        }
    }
    const storageDir = path.join(getWalletDir(), 'spark-data');
    const config = defaultConfig('mainnet');
    config.apiKey = apiKey;
    const seed = {
        type: 'mnemonic',
        mnemonic: walletMnemonic
    };
    const connectRequest = {
        config,
        seed,
        storageDir
    };
    sdk = await connect(connectRequest);
    if (mnemonic) {
        isNew = !walletExists();
        saveWalletData({
            mnemonic: walletMnemonic,
            createdAt: new Date().toISOString(),
            network: 'mainnet'
        });
    }
    return {
        success: true,
        message: isNew ? 'Wallet created and connected' : 'Wallet connected',
        isNew
    };
}
export async function disconnectWallet() {
    if (sdk) {
        await sdk.disconnect();
        sdk = null;
    }
}
function ensureConnected() {
    if (!sdk) {
        throw new Error('Wallet not connected. Use wallet_connect first.');
    }
    return sdk;
}
export async function getBalance() {
    const wallet = ensureConnected();
    const info = await wallet.getInfo({});
    return {
        balanceSats: info.balanceSats
    };
}
export async function getWalletInfo() {
    const wallet = ensureConnected();
    return await wallet.getInfo({});
}
export async function receivePayment(method = 'spark', amountSats, description) {
    const wallet = ensureConnected();
    let paymentMethod;
    switch (method) {
        case 'spark':
            paymentMethod = { type: 'sparkAddress' };
            break;
        case 'spark_invoice':
            paymentMethod = {
                type: 'sparkInvoice',
                amount: amountSats?.toString(),
                description
            };
            break;
        case 'lightning':
            paymentMethod = {
                type: 'bolt11Invoice',
                description: description ?? '',
                amountSats,
                expirySecs: 3600
            };
            break;
        case 'bitcoin':
            paymentMethod = { type: 'bitcoinAddress' };
            break;
        default:
            paymentMethod = { type: 'sparkAddress' };
    }
    const request = {
        paymentMethod
    };
    return await wallet.receivePayment(request);
}
export async function prepareSend(paymentRequest, amountSats) {
    const wallet = ensureConnected();
    const request = {
        paymentRequest,
        amount: amountSats !== undefined ? BigInt(amountSats) : undefined
    };
    return await wallet.prepareSendPayment(request);
}
export async function sendPayment(prepareResponse) {
    const wallet = ensureConnected();
    return await wallet.sendPayment({ prepareResponse });
}
export async function listTransactions(limit, offset) {
    const wallet = ensureConnected();
    const request = {
        limit,
        offset
    };
    return await wallet.listPayments(request);
}
export function getMnemonic() {
    const walletData = loadWalletData();
    return walletData?.mnemonic ?? null;
}
export function formatSatsToBtc(sats) {
    return (sats / 100_000_000).toFixed(8);
}
export function formatPayment(payment) {
    return {
        id: payment.id,
        type: payment.paymentType,
        status: payment.status,
        amountSats: Number(payment.amount),
        feesSats: Number(payment.fees),
        timestamp: payment.timestamp ? new Date(payment.timestamp * 1000).toISOString() : null,
        method: payment.method,
        details: payment.details
    };
}
export { deleteWalletData };
//# sourceMappingURL=wallet.js.map