import { connectToDatabase } from '@/lib/database';
import { 
  PaymentMethod, 
  CreatePaymentMethodInput, 
  UpdatePaymentMethodInput,
  PaymentMethodValidation,
  PaymentMethodStats,
  PaymentMethodType
} from '@/models/PaymentMethod';
import { ObjectId } from 'mongodb';

import { Db } from 'mongodb';

export class PaymentMethodService {
  private db: Db | null = null;

  private async initDatabase() {
    if (!this.db) {
      this.db = await connectToDatabase();
    }
    return this.db!;
  }

  // Create a new payment method
  async createPaymentMethod(
    input: CreatePaymentMethodInput,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    // Validate the payment method
    const validation = this.validatePaymentMethod(input);
    if (!validation.isValid) {
      throw new Error(`Invalid payment method: ${validation.errors.join(', ')}`);
    }

    // If this is a default method, unset other defaults of the same type
    if (input.isDefault) {
      await this.unsetDefaultMethods(input.type, organizationId, userId);
    }

    const paymentMethod: PaymentMethod = {
      name: input.name,
      type: input.type,
      isDefault: input.isDefault || false,
      isActive: true,
      description: input.description,
      tags: input.tags || [],
      organizationId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(input.type === 'fiat' && input.fiatDetails && { fiatDetails: input.fiatDetails }),
      ...(input.type === 'crypto' && input.cryptoDetails && { cryptoDetails: input.cryptoDetails })
    };

    const result = await collection.insertOne(paymentMethod);
    return { ...paymentMethod, _id: result.insertedId };
  }

  // Get payment methods for an organization or user
  async getPaymentMethods(
    organizationId?: ObjectId,
    userId?: ObjectId,
    type?: PaymentMethodType,
    activeOnly: boolean = true,
    includeSafeWallets: boolean = true
  ): Promise<PaymentMethod[]> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const filter: Record<string, unknown> = {};
    
    if (organizationId) {
      filter.organizationId = organizationId;
    } else if (userId) {
      filter.userId = userId;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (activeOnly) {
      filter.isActive = true;
    }

    const results = await collection.find(filter).sort({ isDefault: -1, createdAt: -1 }).toArray();
    return results as PaymentMethod[];
  }

  // Get Safe wallets specifically
  async getSafeWallets(
    organizationId?: ObjectId,
    userId?: ObjectId,
    activeOnly: boolean = true
  ): Promise<PaymentMethod[]> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const filter: Record<string, unknown> = {
      type: 'crypto',
      'cryptoDetails.safeDetails': { $exists: true },
    };
    
    if (organizationId) {
      filter.organizationId = organizationId;
    } else if (userId) {
      filter.userId = userId;
    }
    
    if (activeOnly) {
      filter.isActive = true;
    }

    const results = await collection.find(filter).sort({ isDefault: -1, createdAt: -1 }).toArray();
    return results as PaymentMethod[];
  }

  // Create a Safe wallet payment method
  async createSafePaymentMethod(
    input: {
      name: string;
      safeAddress: string;
      owners: string[];
      threshold: number;
      chainId: number;
      network: string;
      currency: string;
      version?: string;
      modules?: string[];
      nonce?: number;
      connectionMethod?: 'safe_app' | 'wallet_connect' | 'manual' | 'imported';
      isDefault?: boolean;
      description?: string;
      tags?: string[];
    },
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    // If this is a default method, unset other defaults of the same type
    if (input.isDefault) {
      await this.unsetDefaultMethods('crypto', organizationId, userId);
    }

    const paymentMethod: PaymentMethod = {
      name: input.name,
      type: 'crypto',
      isDefault: input.isDefault || false,
      isActive: true,
      description: input.description,
      tags: input.tags || ['safe', 'multisig'],
      organizationId,
      userId,
      cryptoDetails: {
        address: input.safeAddress.toLowerCase(),
        network: input.network,
        currency: input.currency,
        safeDetails: {
          safeAddress: input.safeAddress.toLowerCase(),
          owners: input.owners.map(addr => addr.toLowerCase()),
          threshold: input.threshold,
          version: input.version,
          modules: input.modules,
          nonce: input.nonce,
          connectionMethod: input.connectionMethod || 'imported',
          chainId: input.chainId,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(paymentMethod);
    return { ...paymentMethod, _id: result.insertedId };
  }

  // Get a single payment method by ID
  async getPaymentMethodById(
    methodId: ObjectId,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod | null> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const filter: Record<string, unknown> = { _id: methodId };
    
    if (organizationId) {
      filter.organizationId = organizationId;
    } else if (userId) {
      filter.userId = userId;
    }

    const result = await collection.findOne(filter);
    return result as PaymentMethod | null;
  }

  // Update a payment method
  async updatePaymentMethod(
    methodId: ObjectId,
    input: UpdatePaymentMethodInput,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod | null> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    // Get the current payment method to check type
    const currentMethod = await this.getPaymentMethodById(methodId, organizationId, userId);
    if (!currentMethod) {
      throw new Error('Payment method not found');
    }

    // If setting as default, unset other defaults of the same type
    if (input.isDefault) {
      await this.unsetDefaultMethods(currentMethod.type, organizationId, userId);
    }

    const updateData: Record<string, unknown> = {
      ...input,
      updatedAt: new Date()
    };

    const result = await collection.findOneAndUpdate(
      { _id: methodId, ...(organizationId ? { organizationId } : { userId }) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result?.value as PaymentMethod | null;
  }

  // Delete a payment method
  async deletePaymentMethod(
    methodId: ObjectId,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<boolean> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const result = await collection.deleteOne({
      _id: methodId,
      ...(organizationId ? { organizationId } : { userId })
    });

    return result.deletedCount > 0;
  }

  // Set a payment method as default
  async setDefaultPaymentMethod(
    methodId: ObjectId,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<boolean> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    // Get the payment method to determine its type
    const method = await this.getPaymentMethodById(methodId, organizationId, userId);
    if (!method) {
      throw new Error('Payment method not found');
    }

    // Unset other defaults of the same type
    await this.unsetDefaultMethods(method.type, organizationId, userId);

    // Set this method as default
    const result = await collection.updateOne(
      { _id: methodId },
      { $set: { isDefault: true, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  // Get default payment methods
  async getDefaultPaymentMethods(
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<{ fiat?: PaymentMethod; crypto?: PaymentMethod }> {
    const methods = await this.getPaymentMethods(organizationId, userId);
    
    return {
      fiat: methods.find(m => m.type === 'fiat' && m.isDefault),
      crypto: methods.find(m => m.type === 'crypto' && m.isDefault)
    };
  }

  // Get payment method statistics
  async getPaymentMethodStats(
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethodStats> {
    const methods = await this.getPaymentMethods(organizationId, userId, undefined, false);
    
    const fiatMethods = methods.filter(m => m.type === 'fiat');
    const cryptoMethods = methods.filter(m => m.type === 'crypto');
    const activeMethods = methods.filter(m => m.isActive);
    
    const defaultMethods = await this.getDefaultPaymentMethods(organizationId, userId);
    
    return {
      totalMethods: methods.length,
      fiatMethods: fiatMethods.length,
      cryptoMethods: cryptoMethods.length,
      activeMethods: activeMethods.length,
      defaultMethods: {
        fiat: defaultMethods.fiat?._id,
        crypto: defaultMethods.crypto?._id
      }
    };
  }

  // Validate a payment method
  validatePaymentMethod(input: CreatePaymentMethodInput): PaymentMethodValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!input.name || input.name.trim().length === 0) {
      errors.push('Payment method name is required');
    }

    if (!input.type) {
      errors.push('Payment method type is required');
    }

    // Type-specific validation
    if (input.type === 'fiat') {
      if (!input.fiatDetails) {
        errors.push('Fiat payment details are required');
      } else {
        const fiat = input.fiatDetails;
        if (!fiat.subtype) errors.push('Payment subtype is required');
        if (!fiat.currency) errors.push('Currency is required');
        if (!fiat.country) errors.push('Country is required');
        
        // Validate based on subtype
        if (fiat.subtype === 'bank') {
          if (!fiat.bankName) errors.push('Bank name is required');
          if (!fiat.accountNumber) errors.push('Account number is required');
          if (!fiat.accountType) errors.push('Account type is required');
          
          // Validate account number format
          if (fiat.accountNumber && fiat.accountNumber.length < 8) {
            warnings.push('Account number seems too short');
          }
        } else if (fiat.subtype === 'mpesa_paybill') {
          if (!fiat.paybillNumber) errors.push('Paybill number is required');
          if (!fiat.mpesaAccountNumber) errors.push('Account number is required');
          // Business name is optional for M-Pesa Paybill
          
          // Validate paybill number format (typically 5-7 digits)
          if (fiat.paybillNumber && !/^\d{5,7}$/.test(fiat.paybillNumber)) {
            warnings.push('Paybill number should be 5-7 digits');
          }
          
          // Validate country is Kenya
          if (fiat.country && fiat.country !== 'KE') {
            errors.push('M-Pesa Paybill is only available for Kenya (KE)');
          }
        } else if (fiat.subtype === 'mpesa_till') {
          if (!fiat.tillNumber) errors.push('Till number is required');
          // Business name is optional for M-Pesa Till
          
          // Validate till number format (typically 7 digits)
          if (fiat.tillNumber && !/^\d{7}$/.test(fiat.tillNumber)) {
            warnings.push('Till number should be 7 digits');
          }
          
          // Validate country is Kenya
          if (fiat.country && fiat.country !== 'KE') {
            errors.push('M-Pesa Till is only available for Kenya (KE)');
          }
        }
      }
    }

    if (input.type === 'crypto') {
      if (!input.cryptoDetails) {
        errors.push('Crypto payment details are required');
      } else {
        const crypto = input.cryptoDetails;
        if (!crypto.address) errors.push('Wallet address is required');
        if (!crypto.network) errors.push('Network is required');
        if (!crypto.currency) errors.push('Currency is required');
        
        // Validate wallet address format
        if (crypto.address && crypto.address.length < 26) {
          warnings.push('Wallet address seems too short');
        }
      }
    }


    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private method to unset default methods of a specific type
  private async unsetDefaultMethods(
    type: PaymentMethodType,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<void> {
    const db = await this.initDatabase();
    const collection = db.collection('paymentMethods');
    
    const filter: Record<string, unknown> = {
      type,
      isDefault: true,
      ...(organizationId ? { organizationId } : { userId })
    };

    await collection.updateMany(filter, {
      $set: { isDefault: false, updatedAt: new Date() }
    });
  }

  // Get payment methods suitable for an invoice
  async getPaymentMethodsForInvoice(
    currency: string,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod[]> {
    const methods = await this.getPaymentMethods(organizationId, userId);
    
    // Filter by currency compatibility
    return methods.filter(method => {
      if (method.type === 'fiat') {
        return method.fiatDetails?.currency === currency;
      } else if (method.type === 'crypto') {
        // For crypto, we might want to show all crypto methods or filter by specific currency
        return method.cryptoDetails?.currency === currency || currency === 'crypto';
      }
      return false;
    });
  }
}

// Export singleton instance
export const paymentMethodService = new PaymentMethodService(); 