import {
  connect,
  defaultConfig,
  BreezSdk,
  PrepareSendPaymentResponse,
  ReceivePaymentResponse,
  GetInfoResponse,
  Payment,
  SendPaymentResponse,
  ReceivePaymentRequest,
  PrepareSendPaymentRequest,
  ConnectRequest,
  ListPaymentsRequest,
  ListPaymentsResponse,
  Network,
  Seed,
  ReceivePaymentMethod
} from '@breeztech/breez-sdk-spark/nodejs';
import * as path from 'path';
import { saveWalletData, loadWalletData, walletExists, getWalletDir, deleteWalletData } from './storage.js';

let sdk: BreezSdk | null = null;
let currentApiKey: string | null = null;

export interface WalletStatus {
  connected: boolean;
  hasWallet: boolean;
}

export function getWalletStatus(): WalletStatus {
  return {
    connected: sdk !== null,
    hasWallet: walletExists()
  };
}

export function setApiKey(apiKey: string): void {
  currentApiKey = apiKey;
}

export async function connectWallet(mnemonic?: string): Promise<{ success: boolean; message: string; isNew: boolean }> {
  if (sdk) {
    return { success: true, message: 'Wallet already connected', isNew: false };
  }

  const apiKey = currentApiKey || process.env.BREEZ_API_KEY;
  if (!apiKey) {
    throw new Error('Breez API key not configured. Set it in plugin config or BREEZ_API_KEY environment variable.');
  }

  let walletMnemonic: string;
  let isNew = false;

  if (mnemonic) {
    walletMnemonic = mnemonic;
  } else {
    const existingWallet = loadWalletData();
    if (existingWallet) {
      walletMnemonic = existingWallet.mnemonic;
    } else {
      throw new Error('No existing wallet found. Please provide a 12 or 24 word mnemonic to create/restore a wallet.');
    }
  }

  const storageDir = path.join(getWalletDir(), 'spark-data');

  const config = defaultConfig('mainnet' as Network);
  config.apiKey = apiKey;

  const seed: Seed = {
    type: 'mnemonic',
    mnemonic: walletMnemonic
  };

  const connectRequest: ConnectRequest = {
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

export async function disconnectWallet(): Promise<void> {
  if (sdk) {
    await sdk.disconnect();
    sdk = null;
  }
}

function ensureConnected(): BreezSdk {
  if (!sdk) {
    throw new Error('Wallet not connected. Use wallet_connect first.');
  }
  return sdk;
}

export async function getBalance(): Promise<{ balanceSats: number }> {
  const wallet = ensureConnected();
  const info = await wallet.getInfo({});
  return {
    balanceSats: info.balanceSats
  };
}

export async function getWalletInfo(): Promise<GetInfoResponse> {
  const wallet = ensureConnected();
  return await wallet.getInfo({});
}

export type ReceiveMethod = 'spark' | 'spark_invoice' | 'lightning' | 'bitcoin';

export async function receivePayment(
  method: ReceiveMethod = 'spark',
  amountSats?: number,
  description?: string
): Promise<ReceivePaymentResponse> {
  const wallet = ensureConnected();

  let paymentMethod: ReceivePaymentMethod;

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

  const request: ReceivePaymentRequest = {
    paymentMethod
  };

  return await wallet.receivePayment(request);
}

export async function prepareSend(paymentRequest: string, amountSats?: number): Promise<PrepareSendPaymentResponse> {
  const wallet = ensureConnected();

  const request: PrepareSendPaymentRequest = {
    paymentRequest,
    amount: amountSats !== undefined ? BigInt(amountSats) : undefined
  };

  return await wallet.prepareSendPayment(request);
}

export async function sendPayment(prepareResponse: PrepareSendPaymentResponse): Promise<SendPaymentResponse> {
  const wallet = ensureConnected();
  return await wallet.sendPayment({ prepareResponse });
}

export async function listTransactions(limit?: number, offset?: number): Promise<ListPaymentsResponse> {
  const wallet = ensureConnected();
  const request: ListPaymentsRequest = {
    limit,
    offset
  };
  return await wallet.listPayments(request);
}

export function getMnemonic(): string | null {
  const walletData = loadWalletData();
  return walletData?.mnemonic ?? null;
}

export function formatSatsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

export function formatPayment(payment: Payment): object {
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
export type { PrepareSendPaymentResponse as PrepareSendResponseType };
