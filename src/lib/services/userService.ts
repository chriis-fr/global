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
    console.log('🔧 [UserService] Starting user creation...');
    console.log('📋 [UserService] User data received:', {
      email: userData.email,
      name: userData.name,
      userType: userData.userType,
      hasPassword: !!userData.password,
      hasAddress: !!userData.address
    });
    
    const collection = await this.getCollection();
    console.log('📊 [UserService] Got database collection');
    
    const now = new Date();
    const newUser: User = {
      ...userData,
      walletAddresses: userData.walletAddresses || [],
      settings: {
        currencyPreference: userData.settings?.currencyPreference || 'USD',
        notifications: {
          email: userData.settings?.notifications?.email ?? true,
          sms: userData.settings?.notifications?.sms ?? false
        }
      },
      services: userData.services ? { ...createDefaultServices(), ...userData.services } : createDefaultServices(),
      onboarding: {
        completed: userData.onboarding?.completed ?? false,
        currentStep: userData.onboarding?.currentStep ?? 1,
        completedSteps: userData.onboarding?.completedSteps ?? ['signup'],
        serviceOnboarding: userData.onboarding?.serviceOnboarding ?? {}
      },
      status: 'pending',
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    };

    console.log('💾 [UserService] Inserting user into database...');
    const result = await collection.insertOne(newUser);
    console.log('✅ [UserService] User inserted successfully with ID:', result.insertedId);
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