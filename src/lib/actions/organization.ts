'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { 
  Organization, 
  OrganizationMember, 
  PermissionSet,
  CreateOrganizationInput,
  UpdateOrganizationInput
} from '@/models/Organization';
import { UserService } from '@/lib/services/userService';
import { getRolePermissions } from '@/lib/utils/roles';

// Get organization data for current user
export async function getOrganizationData(): Promise<{
  success: boolean;
  data?: {
    userType: string;
    hasOrganization: boolean;
    organization?: Organization;
    userRole?: string;
    userPermissions?: PermissionSet;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // If user has an organization, get its data
    if (user.organizationId) {
      const db = await getDatabase();
      const organization = await db.collection<Organization>('organizations').findOne({
        _id: new ObjectId(user.organizationId.toString())
      });
      
      if (organization) {
        // Find user's role in the organization
        const userMember = organization.members.find(m => 
          m.userId.toString() === user._id!.toString()
        );
        
        const userRole = userMember?.role || 'member';
        const userPermissions = userMember?.permissions || getRolePermissions('approver');
        
        // Calculate actual company size based on member count
        const memberCount = organization.members.length;
        let actualCompanySize: '1-10' | '11-50' | '51-200' | '200+';
        
        if (memberCount <= 10) {
          actualCompanySize = '1-10';
        } else if (memberCount <= 50) {
          actualCompanySize = '11-50';
        } else if (memberCount <= 200) {
          actualCompanySize = '51-200';
        } else {
          actualCompanySize = '200+';
        }

        // Convert organization data to plain objects for client components
        const organizationData = {
          _id: organization._id?.toString(),
          name: organization.name,
          billingEmail: organization.billingEmail,
          industry: organization.industry,
          companySize: actualCompanySize, // Use calculated size
          memberCount, // Add member count for display
          businessType: organization.businessType,
          phone: organization.phone,
          website: organization.website,
          address: organization.address,
          taxId: organization.taxId,
          registrationNumber: organization.registrationNumber,
          primaryContact: organization.primaryContact,
          services: organization.services,
          onboarding: organization.onboarding,
          status: organization.status,
          verified: organization.verified,
          createdAt: organization.createdAt.toISOString(),
          updatedAt: organization.updatedAt.toISOString(),
          members: organization.members.map(member => ({
            userId: member.userId.toString(),
            email: member.email,
            name: member.name,
            role: member.role,
            permissions: member.permissions,
            status: member.status,
            _id: member._id?.toString(),
            invitedBy: member.invitedBy?.toString(),
            joinedAt: member.joinedAt?.toISOString(),
            lastActiveAt: member.lastActiveAt?.toISOString()
          }))
        };

        return {
          success: true,
          data: {
            userType: user.userType,
            hasOrganization: true,
            organization: organizationData,
            userRole,
            userPermissions
          }
        };
      }
    }

    // User doesn't have an organization
    return {
      success: true,
      data: {
        userType: user.userType,
        hasOrganization: false,
        organization: undefined,
        userRole: undefined,
        userPermissions: undefined
      }
    };
  } catch (error) {
    console.error('Error fetching organization data:', error);
    return { 
      success: false, 
      error: 'Failed to fetch organization data' 
    };
  }
}

// Create a new organization
export async function createOrganization(orgData: CreateOrganizationInput): Promise<{
  success: boolean;
  data?: Organization;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if user already has an organization
    if (user.organizationId) {
      return { success: false, error: 'User already belongs to an organization' };
    }

    // Validate required fields
    if (!orgData.name || !orgData.billingEmail || !orgData.industry) {
      return { success: false, error: 'Name, billing email, and industry are required' };
    }

    // Check if organization name already exists
    const db = await getDatabase();
    const existingOrg = await db.collection<Organization>('organizations').findOne({
      name: orgData.name
    });
    
    if (existingOrg) {
      return { success: false, error: 'Organization name already exists' };
    }

    // Create organization with current user as owner
    const now = new Date();
    const ownerMember: OrganizationMember = {
      _id: new ObjectId(),
      userId: user._id!,
      email: user.email,
      name: user.name || user.email,
      role: 'owner',
      permissions: getRolePermissions('owner'),
      status: 'active',
      invitedBy: user._id!, // Self-invited as owner
      joinedAt: now,
      lastActiveAt: now
    };

    const newOrganization: Organization = {
      ...orgData,
      members: [ownerMember],
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

    const result = await db.collection<Organization>('organizations').insertOne(newOrganization);
    const createdOrg = { ...newOrganization, _id: result.insertedId };

    // Update user to link to the new organization
    await UserService.updateUser(user._id!.toString(), {
      organizationId: createdOrg._id,
      userType: 'business'
    });

    return {
      success: true,
      data: createdOrg
    };
  } catch (error) {
    console.error('Error creating organization:', error);
    return { 
      success: false, 
      error: 'Failed to create organization' 
    };
  }
}

// Update organization (Admin/Owner only)
export async function updateOrganization(updateData: UpdateOrganizationInput): Promise<{
  success: boolean;
  data?: Organization;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.organizationId) {
      return { success: false, error: 'User does not belong to an organization' };
    }

    // Check if user is admin/owner
    const db = await getDatabase();
    const organization = await db.collection<Organization>('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    const userMember = organization.members.find(m => 
      m.userId.toString() === user._id!.toString()
    );

    if (!userMember || (userMember.role !== 'owner' && userMember.role !== 'admin')) {
      return { success: false, error: 'Only organization admins can update organization settings' };
    }

    // Update organization
    const updatedOrg = await db.collection<Organization>('organizations').findOneAndUpdate(
      { _id: new ObjectId(user.organizationId.toString()) },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedOrg) {
      return { success: false, error: 'Failed to update organization' };
    }

    return {
      success: true,
      data: updatedOrg
    };
  } catch (error) {
    console.error('Error updating organization:', error);
    return { 
      success: false, 
      error: 'Failed to update organization' 
    };
  }
}

// Get organization members
export async function getOrganizationMembers(): Promise<{
  success: boolean;
  data?: OrganizationMember[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, error: 'User does not belong to an organization' };
    }

    const db = await getDatabase();
    const organization = await db.collection<Organization>('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Serialize members data for client components
    const serializedMembers = organization.members.map(member => ({
      userId: member.userId.toString(),
      email: member.email,
      name: member.name,
      role: member.role,
      permissions: member.permissions,
      status: member.status,
      _id: member._id?.toString(),
      invitedBy: member.invitedBy?.toString(),
      joinedAt: member.joinedAt?.toISOString(),
      lastActiveAt: member.lastActiveAt?.toISOString()
    }));

    return {
      success: true,
      data: serializedMembers
    };
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return { 
      success: false, 
      error: 'Failed to fetch organization members' 
    };
  }
}

// Check if user has specific permission
export async function checkUserPermission(permission: keyof PermissionSet): Promise<{
  success: boolean;
  hasPermission: boolean;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, hasPermission: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, hasPermission: false, error: 'User does not belong to an organization' };
    }

    const db = await getDatabase();
    const organization = await db.collection<Organization>('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, hasPermission: false, error: 'Organization not found' };
    }

    const userMember = organization.members.find(m => 
      m.userId.toString() === user._id!.toString()
    );

    if (!userMember) {
      return { success: false, hasPermission: false, error: 'User not found in organization' };
    }

    const hasPermission = userMember.permissions[permission] === true;

    return {
      success: true,
      hasPermission
    };
  } catch (error) {
    console.error('Error checking user permission:', error);
    return { 
      success: false, 
      hasPermission: false, 
      error: 'Failed to check permission' 
    };
  }
}
