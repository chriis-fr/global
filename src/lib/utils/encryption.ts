import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;

export class EncryptionUtil {
  // Generate a key from password using bcrypt
  static async generateKeyFromPassword(password: string, salt?: string): Promise<{ key: Buffer; salt: string }> {
    const usedSalt = salt || await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, usedSalt);
    
    // Use the hash to generate a consistent encryption key
    const key = crypto.scryptSync(hash, usedSalt, ENCRYPTION_KEY_LENGTH);
    
    return { key, salt: usedSalt };
  }

  // Encrypt data
  static async encrypt(data: string, password: string): Promise<string> {
    const { key, salt } = await this.generateKeyFromPassword(password);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Use createCipheriv instead of deprecated createCipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return salt:iv:encryptedData
    return `${salt}:${iv.toString('hex')}:${encrypted}`;
  }

  // Decrypt data
  static async decrypt(encryptedData: string, password: string): Promise<string> {
    const [salt, ivHex, encrypted] = encryptedData.split(':');
    
    if (!salt || !ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const { key } = await this.generateKeyFromPassword(password, salt);
    const iv = Buffer.from(ivHex, 'hex');
    
    // Use createDecipheriv instead of deprecated createDecipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
