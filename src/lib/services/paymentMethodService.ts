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

export class PaymentMethodService {
  private db: any;

  private async initDatabase() {
    if (!this.db) {
      this.db = await connectToDatabase();
    }
    return this.db;
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
    activeOnly: boolean = true
  ): Promise<PaymentMethod[]> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const filter: any = {};
    
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

    return await collection.find(filter).sort({ isDefault: -1, createdAt: -1 }).toArray();
  }

  // Get a single payment method by ID
  async getPaymentMethodById(
    methodId: ObjectId,
    organizationId?: ObjectId,
    userId?: ObjectId
  ): Promise<PaymentMethod | null> {
    const db = await this.initDatabase();
    
    const collection = db.collection('paymentMethods');
    
    const filter: any = { _id: methodId };
    
    if (organizationId) {
      filter.organizationId = organizationId;
    } else if (userId) {
      filter.userId = userId;
    }

    return await collection.findOne(filter);
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

    const updateData: any = {
      ...input,
      updatedAt: new Date()
    };

    const result = await collection.findOneAndUpdate(
      { _id: methodId, ...(organizationId ? { organizationId } : { userId }) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result.value;
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
        if (!fiat.bankName) errors.push('Bank name is required');
        if (!fiat.accountNumber) errors.push('Account number is required');
        if (!fiat.currency) errors.push('Currency is required');
        if (!fiat.country) errors.push('Country is required');
        if (!fiat.accountType) errors.push('Account type is required');
        
        // Validate account number format
        if (fiat.accountNumber && fiat.accountNumber.length < 8) {
          warnings.push('Account number seems too short');
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
    
    const filter: any = {
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