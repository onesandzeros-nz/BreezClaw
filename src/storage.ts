import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const WALLET_DIR = path.join(os.homedir(), '.breez-wallet');
const WALLET_FILE = path.join(WALLET_DIR, 'wallet.enc');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

interface EncryptedData {
  salt: string;
  iv: string;
  authTag: string;
  data: string;
}

export interface WalletData {
  mnemonic: string;
  createdAt: string;
  network: string;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function getEncryptionPassword(): string {
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.createHash('sha256').update(machineId).digest('hex');
}

export function encrypt(data: string): string {
  const password = getEncryptionPassword();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const encryptedData: EncryptedData = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted
  };

  return JSON.stringify(encryptedData);
}

export function decrypt(encryptedString: string): string {
  const password = getEncryptionPassword();
  const encryptedData: EncryptedData = JSON.parse(encryptedString);

  const salt = Buffer.from(encryptedData.salt, 'hex');
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function ensureWalletDir(): void {
  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { mode: 0o700 });
  }
}

export function saveWalletData(walletData: WalletData): void {
  ensureWalletDir();
  const encrypted = encrypt(JSON.stringify(walletData));
  fs.writeFileSync(WALLET_FILE, encrypted, { mode: 0o600 });
}

export function loadWalletData(): WalletData | null {
  if (!fs.existsSync(WALLET_FILE)) {
    return null;
  }

  try {
    const encrypted = fs.readFileSync(WALLET_FILE, 'utf8');
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted) as WalletData;
  } catch (error) {
    console.error('Failed to load wallet data:', error);
    return null;
  }
}

export function walletExists(): boolean {
  return fs.existsSync(WALLET_FILE);
}

export function deleteWalletData(): void {
  if (fs.existsSync(WALLET_FILE)) {
    fs.unlinkSync(WALLET_FILE);
  }
}

export function getWalletDir(): string {
  return WALLET_DIR;
}
