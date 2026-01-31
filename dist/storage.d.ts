export interface WalletData {
    mnemonic: string;
    createdAt: string;
    network: string;
}
export declare function encrypt(data: string): string;
export declare function decrypt(encryptedString: string): string;
export declare function ensureWalletDir(): void;
export declare function saveWalletData(walletData: WalletData): void;
export declare function loadWalletData(): WalletData | null;
export declare function walletExists(): boolean;
export declare function deleteWalletData(): void;
export declare function getWalletDir(): string;
//# sourceMappingURL=storage.d.ts.map