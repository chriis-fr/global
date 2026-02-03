import { getDatabase } from '../database';
import { Organization, CreateOrganizationInput, UpdateOrganizationInput, OrganizationMember } from '@/models';
import { ObjectId } from 'mongodb';

// Use the existing PermissionSet from Organization model
import { PermissionSet } from '@/models/Organization';

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
        emailService: orgData.services?.emailService ?? false,
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

  // Get organization by billing email (used to avoid duplicate org signups)
  static async getOrganizationByBillingEmail(billingEmail: string): Promise<Organization | null> {
    const collection = await this.getCollection();
    return collection.findOne({ billingEmail });
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

  // Check if user has specific permission
  static async hasUserPermission(organizationId: string, userId: string, permission: string): Promise<boolean> {
    const organization = await this.getOrganizationById(organizationId);
    if (!organization) return false;
    
    const member = organization.members.find(m => m.userId.toString() === userId);
    if (!member) return false;
    
    return member.permissions[permission as keyof typeof member.permissions] === true;
  }

  // Get user role in organization
  static async getUserRole(organizationId: string, userId: string): Promise<string | null> {
    const organization = await this.getOrganizationById(organizationId);
    if (!organization) return null;
    
    const member = organization.members.find(m => m.userId.toString() === userId);
    return member?.role || null;
  }

  // Get user permissions in organization
  static async getUserPermissions(organizationId: string, userId: string): Promise<PermissionSet | null> {
    const organization = await this.getOrganizationById(organizationId);
    if (!organization) return null;
    
    const member = organization.members.find(m => m.userId.toString() === userId);
    return member?.permissions || null;
  }

  // Get organization count
  static async getOrganizationCount(): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments();
  }

  // MIGRATION CODE - COMMENTED OUT (No longer needed for new users)
  // All existing organizations have been migrated, new organizations use proper structure
  
  // Migrate existing organization members to new structure
  // static async migrateOrganizationMembers(organizationId: string): Promise<Organization | null> {
  //   const collection = await this.getCollection();
  //   const organization = await this.getOrganizationById(organizationId);
  //   
  //   if (!organization) {
  //     return null;
  //   }

  //   // Check if members need migration (old structure)
  //   const needsMigration = organization.members.some(member => 
  //     !member.email || !member.name || !member.joinedAt || !member.permissions
  //   );

  //     organizationId,
  //     needsMigration,
  //     memberCount: organization.members.length,
  //     members: organization.members.map(m => ({
  //       hasEmail: !!m.email,
  //       hasName: !!m.name,
  //       hasJoinedAt: !!m.joinedAt,
  //       hasPermissions: !!m.permissions,
  //       userId: m.userId.toString(),
  //       role: m.role
  //     }))
  //   });

  //   if (!needsMigration) {
  //     return organization; // Already migrated
  //   }


  //   // Update members with new structure
  //   const updatedMembers = await Promise.all(
  //     organization.members.map(async (member) => {
  //       try {
  //         // Get user data to fill missing fields
  //         const user = await UserService.getUserById(member.userId.toString());
  //         
  //           userId: member.userId.toString(),
  //           role: member.role,
  //           hasEmail: !!member.email,
  //           hasName: !!member.name,
  //           hasJoinedAt: !!member.joinedAt,
  //           hasPermissions: !!member.permissions,
  //           userData: user ? { name: user.name, email: user.email } : null
  //         });
  //         
  //         return {
  //           _id: member._id,
  //           userId: member.userId.toString(), // Convert ObjectId to string
  //           email: member.email || user?.email || 'unknown@email.com',
  //           name: member.name || user?.name || 'Unknown User',
  //           role: member.role,
  //           joinedAt: member.joinedAt || organization.createdAt || new Date(),
  //           lastActiveAt: member.lastActiveAt || new Date(),
  //           status: member.status || 'active',
  //           invitedBy: member.invitedBy ? member.invitedBy.toString() : undefined, // Convert ObjectId to string
  //           permissions: member.permissions || this.getDefaultPermissionsForRole(member.role)
  //         };
  //       } catch (error) {
  //         // Return member with fallback data
  //         return {
  //           _id: member._id,
  //           userId: member.userId.toString(),
  //           email: member.email || 'unknown@email.com',
  //           name: member.name || 'Unknown User',
  //           role: member.role,
  //           joinedAt: member.joinedAt || organization.createdAt || new Date(),
  //           lastActiveAt: member.lastActiveAt || new Date(),
  //           status: member.status || 'active',
  //           invitedBy: member.invitedBy ? member.invitedBy.toString() : undefined,
  //           permissions: member.permissions || this.getDefaultPermissionsForRole(member.role)
  //         };
  //       }
  //     })
  //   );

  //   // Update organization with migrated members
  //   const result = await collection.findOneAndUpdate(
  //     { _id: new ObjectId(organizationId) },
  //     { 
  //       $set: { 
  //         members: updatedMembers,
  //         updatedAt: new Date()
  //       }
  //     },
  //     { returnDocument: 'after' }
  //   );

  //   return result;
  // }

  // Get default permissions for a role (fallback)
  // private static getDefaultPermissionsForRole(role: string): any {
  //   // This is a fallback - in practice, roles should have proper permissions
  //   return {
  //     canAddPaymentMethods: role === 'owner' || role === 'admin',
  //     canModifyPaymentMethods: role === 'owner' || role === 'admin',
  //     canManageTreasury: role === 'owner' || role === 'admin',
  //     canManageTeam: role === 'owner' || role === 'admin',
  //     canInviteMembers: role === 'owner' || role === 'admin',
  //     canRemoveMembers: role === 'owner' || role === 'admin',
  //     canManageCompanyInfo: role === 'owner' || role === 'admin',
  //     canManageSettings: role === 'owner' || role === 'admin',
  //     canCreateInvoices: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canSendInvoices: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canManageInvoices: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canCreateBills: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canApproveBills: role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'approver',
  //     canExecutePayments: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canManagePayables: role === 'owner' || role === 'admin' || role === 'financeManager',
  //     canViewAllData: true,
  //     canExportData: role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'accountant',
  //     canReconcileTransactions: role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'accountant',
  //     canManageAccounting: role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'accountant',
  //     canApproveDocuments: role === 'owner' || role === 'admin' || role === 'financeManager' || role === 'approver',
  //     canManageApprovalPolicies: role === 'owner' || role === 'admin' || role === 'financeManager'
  //   };
  // }
} 