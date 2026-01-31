import { PrepareSendPaymentResponse, ReceivePaymentResponse, GetInfoResponse, Payment, SendPaymentResponse, ListPaymentsResponse } from '@breeztech/breez-sdk-spark/nodejs';
import { deleteWalletData } from './storage.js';
export interface WalletStatus {
    connected: boolean;
    hasWallet: boolean;
}
export declare function getWalletStatus(): WalletStatus;
export declare function setApiKey(apiKey: string): void;
export declare function connectWallet(mnemonic?: string): Promise<{
    success: boolean;
    message: string;
    isNew: boolean;
}>;
export declare function disconnectWallet(): Promise<void>;
export declare function getBalance(): Promise<{
    balanceSats: number;
}>;
export declare function getWalletInfo(): Promise<GetInfoResponse>;
export type ReceiveMethod = 'spark' | 'spark_invoice' | 'lightning' | 'bitcoin';
export declare function receivePayment(method?: ReceiveMethod, amountSats?: number, description?: string): Promise<ReceivePaymentResponse>;
export declare function prepareSend(paymentRequest: string, amountSats?: number): Promise<PrepareSendPaymentResponse>;
export declare function sendPayment(prepareResponse: PrepareSendPaymentResponse): Promise<SendPaymentResponse>;
export declare function listTransactions(limit?: number, offset?: number): Promise<ListPaymentsResponse>;
export declare function getMnemonic(): string | null;
export declare function formatSatsToBtc(sats: number): string;
export declare function formatPayment(payment: Payment): object;
export { deleteWalletData };
export type { PrepareSendPaymentResponse as PrepareSendResponseType };
//# sourceMappingURL=wallet.d.ts.map