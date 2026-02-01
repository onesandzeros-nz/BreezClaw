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
import { saveWalletData, loadWalletData, walletExists, getWalletDir, deleteWalletData } from './storage';

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

// Check if a string looks like a Lightning address (user@domain)
function isLightningAddress(input: string): boolean {
  const lightningAddressRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lightningAddressRegex.test(input) && !input.startsWith('lnbc') && !input.startsWith('lnurl');
}

// Resolve a Lightning address to a BOLT11 invoice via LNURL-pay
async function resolveLightningAddress(address: string, amountSats: number): Promise<string> {
  const [username, domain] = address.split('@');
  
  // Step 1: Fetch LNURL-pay metadata
  const lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
  
  const metadataResponse = await fetch(lnurlEndpoint);
  if (!metadataResponse.ok) {
    throw new Error(`Failed to fetch Lightning address metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
  }
  
  const metadata = await metadataResponse.json() as {
    callback: string;
    minSendable: number;
    maxSendable: number;
    tag: string;
    status?: string;
    reason?: string;
  };
  
  if (metadata.status === 'ERROR') {
    throw new Error(`Lightning address error: ${metadata.reason || 'Unknown error'}`);
  }
  
  if (metadata.tag !== 'payRequest') {
    throw new Error(`Invalid LNURL response: expected payRequest, got ${metadata.tag}`);
  }
  
  // LNURL amounts are in millisatoshis
  const amountMsats = amountSats * 1000;
  
  if (amountMsats < metadata.minSendable) {
    throw new Error(`Amount too small. Minimum: ${Math.ceil(metadata.minSendable / 1000)} sats`);
  }
  
  if (amountMsats > metadata.maxSendable) {
    throw new Error(`Amount too large. Maximum: ${Math.floor(metadata.maxSendable / 1000)} sats`);
  }
  
  // Step 2: Request invoice from callback
  const callbackUrl = new URL(metadata.callback);
  callbackUrl.searchParams.set('amount', amountMsats.toString());
  
  const invoiceResponse = await fetch(callbackUrl.toString());
  if (!invoiceResponse.ok) {
    throw new Error(`Failed to get invoice from Lightning address: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
  }
  
  const invoiceData = await invoiceResponse.json() as {
    pr: string;
    status?: string;
    reason?: string;
  };
  
  if (invoiceData.status === 'ERROR') {
    throw new Error(`Invoice request error: ${invoiceData.reason || 'Unknown error'}`);
  }
  
  if (!invoiceData.pr) {
    throw new Error('No invoice returned from Lightning address');
  }
  
  return invoiceData.pr;
}

export async function prepareSend(paymentRequest: string, amountSats?: number): Promise<PrepareSendPaymentResponse> {
  const wallet = ensureConnected();

  let finalPaymentRequest = paymentRequest;
  
  // If it's a Lightning address, resolve it to a BOLT11 invoice first
  if (isLightningAddress(paymentRequest)) {
    if (amountSats === undefined) {
      throw new Error('Amount is required when paying to a Lightning address');
    }
    finalPaymentRequest = await resolveLightningAddress(paymentRequest, amountSats);
  }

  const request: PrepareSendPaymentRequest = {
    paymentRequest: finalPaymentRequest,
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

// Lightning Address functions
export async function checkLightningAddressAvailable(username: string): Promise<boolean> {
  const wallet = ensureConnected();
  return await wallet.checkLightningAddressAvailable({ username });
}

export async function registerLightningAddress(username: string, description?: string): Promise<{
  lightningAddress: string;
  username: string;
  lnurl: string;
}> {
  const wallet = ensureConnected();
  const result = await wallet.registerLightningAddress({ 
    username, 
    description: description ?? `Pay to ${username}`
  });
  return {
    lightningAddress: result.lightningAddress,
    username: result.username,
    lnurl: result.lnurl
  };
}

export async function getLightningAddress(): Promise<{
  lightningAddress: string;
  username: string;
  lnurl: string;
} | null> {
  const wallet = ensureConnected();
  const result = await wallet.getLightningAddress();
  if (!result) return null;
  return {
    lightningAddress: result.lightningAddress,
    username: result.username,
    lnurl: result.lnurl
  };
}

export async function deleteLightningAddress(): Promise<void> {
  const wallet = ensureConnected();
  await wallet.deleteLightningAddress();
}

export { deleteWalletData };
export type { PrepareSendPaymentResponse as PrepareSendResponseType };
