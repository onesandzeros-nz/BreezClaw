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
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}
function getEncryptionPassword() {
    const machineId = os.hostname() + os.userInfo().username;
    return crypto.createHash('sha256').update(machineId).digest('hex');
}
export function encrypt(data) {
    const password = getEncryptionPassword();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const encryptedData = {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
    };
    return JSON.stringify(encryptedData);
}
export function decrypt(encryptedString) {
    const password = getEncryptionPassword();
    const encryptedData = JSON.parse(encryptedString);
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
export function ensureWalletDir() {
    if (!fs.existsSync(WALLET_DIR)) {
        fs.mkdirSync(WALLET_DIR, { mode: 0o700 });
    }
}
export function saveWalletData(walletData) {
    ensureWalletDir();
    const encrypted = encrypt(JSON.stringify(walletData));
    fs.writeFileSync(WALLET_FILE, encrypted, { mode: 0o600 });
}
export function loadWalletData() {
    if (!fs.existsSync(WALLET_FILE)) {
        return null;
    }
    try {
        const encrypted = fs.readFileSync(WALLET_FILE, 'utf8');
        const decrypted = decrypt(encrypted);
        return JSON.parse(decrypted);
    }
    catch (error) {
        console.error('Failed to load wallet data:', error);
        return null;
    }
}
export function walletExists() {
    return fs.existsSync(WALLET_FILE);
}
export function deleteWalletData() {
    if (fs.existsSync(WALLET_FILE)) {
        fs.unlinkSync(WALLET_FILE);
    }
}
export function getWalletDir() {
    return WALLET_DIR;
}
//# sourceMappingURL=storage.js.map