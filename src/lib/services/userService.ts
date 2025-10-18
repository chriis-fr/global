import { getDatabase } from '../database';
import { User, CreateUserInput, UpdateUserInput } from '@/models';
import { ObjectId } from 'mongodb';

interface UserServicesInput {
  smartInvoicing?: boolean;
  payables?: boolean;
}

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
      services: {
        smartInvoicing: (userData.services as UserServicesInput)?.smartInvoicing ?? true,
        payables: (userData.services as UserServicesInput)?.payables ?? true
      },
      onboarding: {
        isCompleted: userData.onboarding?.completed ?? false,
        currentStep: userData.onboarding?.currentStep ?? 1,
        completedSteps: userData.onboarding?.completedSteps ?? ['signup'],
        data: userData.onboarding?.serviceOnboarding ?? {}
      },
      subscription: {
        planId: 'receivables-free',
        status: 'trial',
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

  // Delete user
  static async deleteUser(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Get user count
  static async getUserCount(): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments();
  }
} 