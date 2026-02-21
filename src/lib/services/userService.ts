import { getDatabase } from '../database';
import { User, CreateUserInput, UpdateUserInput } from '@/models';
import { ObjectId } from 'mongodb';
import { createDefaultServices } from './serviceManager';

export class UserService {
  private static async getCollection() {
    const db = await getDatabase();
    return db.collection<User>('users');
  }

  // Create a new user
  static async createUser(userData: CreateUserInput): Promise<User> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newUser: User = {
      _id: new ObjectId(),
      ...userData,
      role: userData.role as 'user' | 'admin',
      preferences: {
        currency: userData.settings?.currencyPreference || 'USD',
        timezone: 'UTC',
        notifications: {
          email: userData.settings?.notifications?.email ?? true,
          push: userData.settings?.notifications?.push ?? false,
          invoiceReminders: userData.settings?.notifications?.reminders ?? true,
          paymentNotifications: userData.settings?.notifications?.paymentReceived ?? true
        }
      },
      // Services are disabled by default - will be enabled during onboarding
      // Merge userData.services (if provided) with default services
      services: userData.services ? { ...createDefaultServices(), ...userData.services } : createDefaultServices(),
      onboarding: {
        isCompleted: userData.onboarding?.completed ?? false,
        currentStep: userData.onboarding?.currentStep ?? 1,
        completedSteps: userData.onboarding?.completedSteps ?? ['signup'],
        data: userData.onboarding?.serviceOnboarding ?? {}
      },
      subscription: {
        planId: 'trial-premium',
        status: 'trial',
        trialStartDate: now,
        trialEndDate: new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)), // 15 days from sign up
        hasUsedTrial: true,
        trialActivatedAt: now,
        billingPeriod: 'monthly',
        createdAt: now,
        updatedAt: now
      },
      usage: {
        invoicesThisMonth: 0,
        monthlyVolume: 0,
        lastResetDate: now
      },
      isEmailVerified: false,
      createdAt: now,
      updatedAt: now
    };

    const result = await collection.insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  }

  // Get user by ID
  static async getUserById(id: string): Promise<User | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: new ObjectId(id) });
  }

  // Get user by email
  static async getUserByEmail(email: string): Promise<User | null> {
    const collection = await this.getCollection();
    return collection.findOne({ email });
  }

  // Get all users
  static async getAllUsers(): Promise<User[]> {
    const collection = await this.getCollection();
    return collection.find().toArray();
  }

  // Get users by organization
  static async getUsersByOrganization(organizationId: string): Promise<User[]> {
    const collection = await this.getCollection();
    return collection.find({ organizationId: new ObjectId(organizationId) }).toArray();
  }

  // Update user
  static async updateUser(id: string, updateData: UpdateUserInput): Promise<User | null> {
    const collection = await this.getCollection();
    
    // Filter out undefined values and handle partial settings update
    const cleanUpdateData: Record<string, unknown> = {};
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanUpdateData[key] = value;
      }
    });
    
    const updateDoc = {
      ...cleanUpdateData,
      updatedAt: new Date()
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Delete user and all related data (invoices, drafts, payables, bills, payment methods, invitation tokens)
  static async deleteUser(id: string): Promise<boolean> {
    const db = await getDatabase();
    const userId = new ObjectId(id);

    // 1. Invoice access tokens: find invoices by issuerId, then delete tokens for those invoices
    const invoiceIds = await db.collection('invoices').find({ issuerId: userId }).project({ _id: 1 }).toArray();
    const ids = invoiceIds.map((doc) => doc._id);
    if (ids.length > 0) {
      await db.collection('invoice_access_tokens').deleteMany({ invoiceId: { $in: ids } });
    }

    // 2. Invoices issued by this user
    await db.collection('invoices').deleteMany({ issuerId: userId });

    // 3. Invoice drafts owned by this user
    await db.collection('invoiceDrafts').deleteMany({ userId: userId });

    // 4. Payables issued by this user (issuerId or userId when stored as ObjectId/string)
    await db.collection('payables').deleteMany({ issuerId: userId });
    await db.collection('payables').deleteMany({ userId: id }); // some schemas use string userId (email)

    // 5. Bills created by this user (createdBy is string)
    await db.collection('bills').deleteMany({ createdBy: id });

    // 6. Invitation tokens sent by this user
    await db.collection('invitation_tokens').deleteMany({ invitedBy: userId });

    // 7. Payment methods owned by this user (individual, not org)
    await db.collection('paymentMethods').deleteMany({ userId: userId });

    // 8. Delete the user
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: userId });
    return result.deletedCount > 0;
  }

  // Get user count
  static async getUserCount(): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments();
  }
} 