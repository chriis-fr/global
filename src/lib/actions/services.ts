'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { UserService } from '@/lib/services/userService';
import { 
  SERVICE_DEFINITIONS, 
  ServiceKey, 
  enableService, 
  disableService, 
  createDefaultServices,
  canAccessServiceWithSubscription,
  getRecommendedPlan
} from '@/lib/services/serviceManager';
import { BILLING_PLANS } from '@/data/billingPlans';
import { clearSubscriptionCache } from './subscription';

export interface ServiceData {
  services: typeof SERVICE_DEFINITIONS;
  categories: string[];
}

export interface UserServiceData {
  _id: string;
  email: string;
  name: string;
  services: Record<string, boolean>;
  subscription: {
    planId: string;
    status: string;
  };
}

export interface ToggleServiceResult {
  success: boolean;
  error?: string;
  user?: UserServiceData;
  requiresUpgrade?: {
    serviceKey: string;
    serviceTitle: string;
    requiredPlans: string[];
    recommendedPlan: string;
  };
}

/**
 * Get all available services and categories
 */
export async function getServices(): Promise<{ success: boolean; data?: ServiceData; error?: string }> {
  try {
    const categories = [...new Set(Object.values(SERVICE_DEFINITIONS).map(def => def.category))];
    
    return {
      success: true,
      data: {
        services: SERVICE_DEFINITIONS,
        categories
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch services'
    };
  }
}

/**
 * Get current user's service data
 */
export async function getUserServiceData(): Promise<{ success: boolean; data?: UserServiceData; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    return {
      success: true,
      data: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        services: (user.services ? { ...createDefaultServices(), ...user.services } : createDefaultServices()) as unknown as Record<string, boolean>,
        subscription: {
          planId: user.subscription?.planId || 'receivables-free',
          status: user.subscription?.status || 'active'
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user data'
    };
  }
}

/**
 * Toggle a service (enable/disable)
 * If service requires upgrade, returns upgrade information instead of toggling
 */
export async function toggleService(
  serviceKey: string,
  action: 'enable' | 'disable'
): Promise<ToggleServiceResult> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Validate service key
    if (!Object.keys(SERVICE_DEFINITIONS).includes(serviceKey)) {
      return {
        success: false,
        error: 'Invalid service key'
      };
    }

    // Get current user
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const currentPlanId = user.subscription?.planId || 'receivables-free';
    const service = SERVICE_DEFINITIONS[serviceKey as ServiceKey];

    // If enabling, check if user has access with current plan
    if (action === 'enable') {
      const accessCheck = canAccessServiceWithSubscription(
        serviceKey as ServiceKey,
        currentPlanId
      );

      if (!accessCheck.canAccess) {
        // User needs to upgrade
        const recommendedPlan = getRecommendedPlan([serviceKey as ServiceKey]) || 
          (accessCheck.requiredPlans.length > 0 ? accessCheck.requiredPlans[0] : null);

        return {
          success: false,
          requiresUpgrade: {
            serviceKey,
            serviceTitle: service.title,
            requiredPlans: accessCheck.requiredPlans,
            recommendedPlan: recommendedPlan || ''
          }
        };
      }
    }

    // Update services
    const currentServices = user.services 
      ? { ...createDefaultServices(), ...user.services } 
      : createDefaultServices();
    
    const updatedServices = action === 'enable'
      ? enableService(currentServices, serviceKey as ServiceKey)
      : disableService(currentServices, serviceKey as ServiceKey);

    // Update user in database
    if (!user._id) {
      return {
        success: false,
        error: 'User ID not found'
      };
    }

    const updatedUser = await UserService.updateUser(user._id.toString(), { 
      services: updatedServices 
    });
    
    if (!updatedUser) {
      return {
        success: false,
        error: 'Failed to update user services'
      };
    }

    // Clear subscription cache to refresh permissions
    clearSubscriptionCache(user._id.toString());

    return {
      success: true,
      user: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        services: (updatedUser.services
          ? { ...createDefaultServices(), ...updatedUser.services }
          : createDefaultServices()) as unknown as Record<string, boolean>,
        subscription: {
          planId: updatedUser.subscription?.planId || 'receivables-free',
          status: updatedUser.subscription?.status || 'active'
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update services'
    };
  }
}

/**
 * Update user's subscription plan (without Stripe checkout)
 * This directly updates the database as Stripe is not working
 */
export async function updateUserPlan(
  planId: string,
  billingPeriod: 'monthly' | 'yearly' = 'monthly'
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Validate plan exists
    const plan = BILLING_PLANS.find(p => p.planId === planId);
    if (!plan) {
      return {
        success: false,
        error: 'Invalid plan ID'
      };
    }

    // Get current user
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user || !user._id) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const db = await getDatabase();
    const userObjectId = new ObjectId(user._id.toString());
    const now = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    // Update user's subscription in database
    await db.collection('users').updateOne(
      { _id: userObjectId },
      {
        $set: {
          'subscription.planId': planId,
          'subscription.status': 'active',
          'subscription.currentPeriodStart': now,
          'subscription.currentPeriodEnd': currentPeriodEnd,
          'subscription.billingPeriod': billingPeriod,
          'subscription.updatedAt': now
        }
      }
    );

    // Clear subscription cache
    clearSubscriptionCache(user._id.toString());

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update plan'
    };
  }
}

