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
            userType: user.organizationId ? 'business' : 'individual',
            hasOrganization: true,
            organization: organizationData as unknown as Organization,
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
        userType: user.organizationId ? 'business' : 'individual',
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

    // Validate required fields (industry is optional)
    if (!orgData.name?.trim() || !orgData.billingEmail?.trim()) {
      return { success: false, error: 'Name and billing email are required' };
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
      ({ 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      } as unknown as import('mongodb').UpdateFilter<Organization>),
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
      data: serializedMembers as unknown as OrganizationMember[]
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

// Get seat limit information for organization
export async function getOrganizationSeatInfo(): Promise<{
  success: boolean;
  data?: {
    paidSeats: number;
    currentMembers: number;
    pendingInvitations: number;
    availableSeats: number;
    planName?: string;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, error: 'User not found or no organization' };
    }

    const db = await getDatabase();
    const organization = await db.collection<Organization>('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Find owner member
    const ownerMember = organization.members.find(m => m.role === 'owner');
    if (!ownerMember) {
      return { success: false, error: 'Organization owner not found' };
    }

    const ownerUserId = ownerMember.userId;
    const ownerUserDoc = await db.collection('users').findOne({ _id: ownerUserId });
    
    if (!ownerUserDoc?.subscription) {
      return { 
        success: true, 
        data: {
          paidSeats: 1,
          currentMembers: organization.members.length,
          pendingInvitations: 0,
          availableSeats: 1 - organization.members.length
        }
      };
    }

    const subscription = ownerUserDoc.subscription;
    const planId = subscription.planId;
    
    // Get plan details
    const { BILLING_PLANS } = await import('@/data/billingPlans');
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    
    let paidSeats = 1;
    const planName = plan?.name || 'Free Plan';
    
    if (plan?.dynamicPricing) {
      // Get seats from subscription (stored when they paid) or default to included seats
      // Handle both number and string types (MongoDB might store as string)
      let subscriptionSeats: number | null = null;
      
      // Convert subscription.seats to number if it exists (handles both number and string)
      if (subscription.seats !== null && subscription.seats !== undefined) {
        if (typeof subscription.seats === 'number' && subscription.seats > 0) {
          subscriptionSeats = subscription.seats;
        } else if (typeof subscription.seats === 'string') {
          const parsed = parseInt(subscription.seats, 10);
          if (!isNaN(parsed) && parsed > 0) {
            subscriptionSeats = parsed;
            // Auto-fix: Update database to store as number instead of string
            await db.collection('users').updateOne(
              { _id: ownerUserId },
              { $set: { 'subscription.seats': parsed } }
            );
            console.log('✅ [getOrganizationSeatInfo] Converted string seats to number:', parsed);
          }
        }
      }
      
      // If seats are missing or invalid, try to extract from Paystack plan code/name
      if ((!subscriptionSeats || subscriptionSeats <= 0) && subscription.paystackPlanCode) {
        const planCodeStr = String(subscription.paystackPlanCode);
        const seatsMatch = planCodeStr.match(/(\d+)\s*seat/i);
        if (seatsMatch) {
          subscriptionSeats = parseInt(seatsMatch[1], 10);
          console.log('📊 [getOrganizationSeatInfo] Extracted seats from plan code:', subscriptionSeats);
        }
      }
      
      // If still no seats, try to get from Paystack API (if we have subscription code)
      if ((!subscriptionSeats || subscriptionSeats <= 0) && subscription.paystackSubscriptionCode) {
        try {
          const { PaystackService } = await import('@/lib/services/paystackService');
          const paystackSub = await PaystackService.getSubscription(subscription.paystackSubscriptionCode);
          const subMeta = paystackSub?.metadata as { seats?: number } | undefined;
          // Check metadata first (most reliable)
          if (subMeta?.seats) {
            const metadataSeats = typeof subMeta.seats === 'number' 
              ? subMeta.seats 
              : parseInt(String(subMeta.seats), 10);
            if (!isNaN(metadataSeats) && metadataSeats > 0) {
              subscriptionSeats = metadataSeats;
              console.log('📊 [getOrganizationSeatInfo] Found seats in Paystack metadata:', subscriptionSeats);
            }
          }
          // Check plan name as fallback
          else if ((paystackSub?.plan as { name?: string } | undefined)?.name) {
            const planNameStr = String((paystackSub?.plan as { name?: string })?.name ?? '');
            const planNameSeats = planNameStr.match(/(\d+)\s*seat/i);
            if (planNameSeats) {
              subscriptionSeats = parseInt(planNameSeats[1], 10);
              console.log('📊 [getOrganizationSeatInfo] Extracted seats from Paystack plan name:', subscriptionSeats);
            }
          }
          
          // If we found seats, update the database
          if (subscriptionSeats && subscriptionSeats > 0) {
            await db.collection('users').updateOne(
              { _id: ownerUserId },
              { $set: { 'subscription.seats': subscriptionSeats } }
            );
            console.log('✅ [getOrganizationSeatInfo] Updated subscription with seats from Paystack:', subscriptionSeats);
          }
        } catch (error) {
          console.error('⚠️ [getOrganizationSeatInfo] Could not fetch Paystack subscription:', error);
        }
      }
      
      // Use found seats or fallback to minimum
      if (subscriptionSeats && subscriptionSeats > 0) {
        paidSeats = subscriptionSeats;
      } else {
        // Fallback to included seats from plan (but Growth has 0, so use 1 as minimum)
        paidSeats = Math.max(1, plan.dynamicPricing.includedSeats || 1);
      }
      
      console.log('📊 [getOrganizationSeatInfo] Seat calculation:', {
        rawSubscriptionSeats: subscription.seats,
        subscriptionSeatsType: typeof subscription.seats,
        finalSubscriptionSeats: subscriptionSeats,
        planIncludedSeats: plan.dynamicPricing.includedSeats,
        finalPaidSeats: paidSeats,
        planId,
        planName
      });
    }
    
    // Count current members (including owner)
    const currentMemberCount = organization.members.length;
    
    // Count pending invitations
    const pendingInvitations = await db.collection('invitation_tokens').countDocuments({
      organizationId: new ObjectId(user.organizationId.toString()),
      expiresAt: { $gt: new Date() }
    });
    
    const availableSeats = Math.max(0, paidSeats - currentMemberCount - pendingInvitations);

    return {
      success: true,
      data: {
        paidSeats,
        currentMembers: currentMemberCount,
        pendingInvitations,
        availableSeats,
        planName
      }
    };
  } catch (error) {
    console.error('Error getting organization seat info:', error);
    return { 
      success: false, 
      error: 'Failed to get seat information' 
    };
  }
}

// Debug function to check and fix seat data for a user
export async function debugSeatInfo(userEmail: string): Promise<{
  success: boolean;
  data?: {
    userId: string;
    subscription: {
      planId?: string;
      seats?: number;
      status?: string;
    };
    organization?: {
      id: string;
      memberCount: number;
    };
    recommendations?: string[];
  };
  error?: string;
}> {
  try {
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ email: userEmail });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const recommendations: string[] = [];
    const subscription = user.subscription || {};
    
    // Check if user has organization
    let organization = null;
    if (user.organizationId) {
      organization = await db.collection('organizations').findOne({
        _id: user.organizationId
      });
    }

    // Check subscription seats
    if (!subscription.seats && subscription.planId) {
      const { BILLING_PLANS } = await import('@/data/billingPlans');
      const plan = BILLING_PLANS.find(p => p.planId === subscription.planId);
      if (plan?.dynamicPricing) {
        recommendations.push(`Subscription missing seats field. Plan ${subscription.planId} supports dynamic pricing. Should have ${plan.dynamicPricing.includedSeats || 1} seats minimum.`);
      }
    }

    return {
      success: true,
      data: {
        userId: user._id.toString(),
        subscription: {
          planId: subscription.planId,
          seats: subscription.seats,
          status: subscription.status
        },
        organization: organization ? {
          id: organization._id.toString(),
          memberCount: organization.members?.length || 0
        } : undefined,
        recommendations
      }
    };
  } catch (error) {
    console.error('Error debugging seat info:', error);
    return { 
      success: false, 
      error: 'Failed to debug seat information' 
    };
  }
}

// Manually sync seats from Paystack (useful if seats are missing)
export async function syncSeatsFromPaystack(): Promise<{
  success: boolean;
  data?: {
    seats?: number;
    message?: string;
  };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, error: 'User not found or no organization' };
    }

    const db = await getDatabase();
    const organization = await db.collection<Organization>('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Find owner member
    const ownerMember = organization.members.find(m => m.role === 'owner');
    if (!ownerMember) {
      return { success: false, error: 'Organization owner not found' };
    }

    const ownerUserId = ownerMember.userId;
    const ownerUserDoc = await db.collection('users').findOne({ _id: ownerUserId });
    
    if (!ownerUserDoc?.subscription) {
      return { success: false, error: 'Owner has no subscription' };
    }

    const subscription = ownerUserDoc.subscription;
    
    // If seats already exist and are valid, no need to sync
    if (subscription.seats && typeof subscription.seats === 'number' && subscription.seats > 0) {
      return {
        success: true,
        data: {
          seats: subscription.seats,
          message: `Seats already synced: ${subscription.seats}`
        }
      };
    }

    // Try to get from Paystack
    if (!subscription.paystackSubscriptionCode) {
      return { success: false, error: 'No Paystack subscription code found' };
    }

    try {
      const { PaystackService } = await import('@/lib/services/paystackService');
      const paystackSub = await PaystackService.getSubscription(subscription.paystackSubscriptionCode);
      const subMeta2 = paystackSub?.metadata as { seats?: number } | undefined;
      const subPlan = paystackSub?.plan as { name?: string } | undefined;
      let foundSeats: number | null = null;
      
      // Check metadata first
      if (subMeta2?.seats) {
        foundSeats = typeof subMeta2.seats === 'number' 
          ? subMeta2.seats 
          : parseInt(String(subMeta2.seats), 10);
      }
      // Check plan name
      else if (subPlan?.name) {
        const planNameStr = String(subPlan.name);
        const planNameSeats = planNameStr.match(/(\d+)\s*seat/i);
        if (planNameSeats) {
          foundSeats = parseInt(planNameSeats[1], 10);
        }
      }
      
      if (foundSeats && foundSeats > 0) {
        // Update database
        await db.collection('users').updateOne(
          { _id: ownerUserId },
          { $set: { 'subscription.seats': foundSeats } }
        );
        
        // Clear cache
        const { clearSubscriptionCache } = await import('@/lib/actions/subscription');
        await clearSubscriptionCache(ownerUserId.toString());
        
        return {
          success: true,
          data: {
            seats: foundSeats,
            message: `Successfully synced ${foundSeats} seats from Paystack`
          }
        };
      } else {
        return {
          success: false,
          error: 'Could not find seat information in Paystack subscription'
        };
      }
    } catch (error) {
      console.error('Error syncing seats from Paystack:', error);
      return {
        success: false,
        error: `Failed to fetch Paystack subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    console.error('Error syncing seats:', error);
    return { 
      success: false, 
      error: 'Failed to sync seat information' 
    };
  }
}
