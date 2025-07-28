import { getDatabase } from '../database';
import { Organization, CreateOrganizationInput, UpdateOrganizationInput, OrganizationMember } from '@/models';
import { ObjectId } from 'mongodb';

export class OrganizationService {
  private static async getCollection() {
    const db = await getDatabase();
    return db.collection<Organization>('organizations');
  }

  // Create a new organization
  static async createOrganization(orgData: CreateOrganizationInput): Promise<Organization> {
    const collection = await this.getCollection();
    
    const now = new Date();
    const newOrganization: Organization = {
      ...orgData,
      members: orgData.members || [],
      services: {
        smartInvoicing: orgData.services?.smartInvoicing ?? false,
        accountsReceivable: orgData.services?.accountsReceivable ?? false,
        accountsPayable: orgData.services?.accountsPayable ?? false,
        expenses: orgData.services?.expenses ?? false,
        payroll: orgData.services?.payroll ?? false,
        immutableRecords: orgData.services?.immutableRecords ?? false,
        auditTrail: orgData.services?.auditTrail ?? false,
        smartPayments: orgData.services?.smartPayments ?? false,
        enhancedSecurity: orgData.services?.enhancedSecurity ?? false,
        accounting: orgData.services?.accounting ?? false,
        accountsPayableReceivableAPI: orgData.services?.accountsPayableReceivableAPI ?? false,
        cryptoToFiat: orgData.services?.cryptoToFiat ?? false,
        offrampAPI: orgData.services?.offrampAPI ?? false,
      },
      onboarding: {
        completed: orgData.onboarding?.completed ?? false,
        currentStep: orgData.onboarding?.currentStep ?? 1,
        completedSteps: orgData.onboarding?.completedSteps ?? ['creation'],
        serviceOnboarding: orgData.onboarding?.serviceOnboarding ?? {}
      },
      status: 'pending',
      verified: false,
      createdAt: now,
      updatedAt: now
    };

    const result = await collection.insertOne(newOrganization);
    return { ...newOrganization, _id: result.insertedId };
  }

  // Get organization by ID
  static async getOrganizationById(id: string): Promise<Organization | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: new ObjectId(id) });
  }

  // Get organization by name
  static async getOrganizationByName(name: string): Promise<Organization | null> {
    const collection = await this.getCollection();
    return collection.findOne({ name });
  }

  // Get all organizations
  static async getAllOrganizations(): Promise<Organization[]> {
    const collection = await this.getCollection();
    return collection.find().toArray();
  }

  // Update organization
  static async updateOrganization(id: string, updateData: UpdateOrganizationInput): Promise<Organization | null> {
    const collection = await this.getCollection();
    
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

  // Delete organization
  static async deleteOrganization(id: string): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Add member to organization
  static async addMember(organizationId: string, member: OrganizationMember): Promise<Organization | null> {
    const collection = await this.getCollection();
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(organizationId) },
      { 
        $push: { members: member },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Remove member from organization
  static async removeMember(organizationId: string, userId: string): Promise<Organization | null> {
    const collection = await this.getCollection();
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(organizationId) },
      { 
        $pull: { members: { userId: new ObjectId(userId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Update member role
  static async updateMemberRole(organizationId: string, userId: string, newRole: string): Promise<Organization | null> {
    const collection = await this.getCollection();
    
    const result = await collection.findOneAndUpdate(
      { 
        _id: new ObjectId(organizationId),
        'members.userId': new ObjectId(userId)
      },
      { 
        $set: { 
          'members.$.role': newRole,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // Get organizations by member
  static async getOrganizationsByMember(userId: string): Promise<Organization[]> {
    const collection = await this.getCollection();
    return collection.find({ 'members.userId': new ObjectId(userId) }).toArray();
  }

  // Check if user is organization admin/owner
  static async isUserAdmin(organizationId: string, userId: string): Promise<boolean> {
    const organization = await this.getOrganizationById(organizationId);
    if (!organization) return false;
    
    const member = organization.members.find(m => m.userId.toString() === userId);
    return member?.role === 'owner' || member?.role === 'admin';
  }

  // Get organization count
  static async getOrganizationCount(): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments();
  }
} 