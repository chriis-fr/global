import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/database';
import { 
  createDefaultServices, 
  enableService, 
  canAccessServiceWithSubscription,
  ServiceKey,
  SERVICE_DEFINITIONS
} from '@/lib/services/serviceManager';

/**
 * Paystack-specific subscription service methods
 * These methods handle Paystack subscription operations
 */
export class SubscriptionServicePaystack {
  /**
   * Automatically enable services based on subscription plan
   * This ensures users see only the services they've paid for
   */
  static async enableServicesForPlan(userId: ObjectId, planId: string): Promise<void> {
    console.log('🔧 [SubscriptionServicePaystack] Enabling services for plan:', { userId: userId.toString(), planId });

    const db = await getDatabase();
    const user = await db.collection('users').findOne({ _id: userId });
    
    if (!user) {
      console.error('❌ [SubscriptionServicePaystack] User not found for service activation');
      return;
    }

    // Get current services or create default
    const currentServices = user.services 
      ? { ...createDefaultServices(), ...user.services }
      : createDefaultServices();

    // Determine which services to enable based on plan type
    const servicesToEnable: ServiceKey[] = [];

    // Check each service definition to see if it's allowed by this plan
    Object.entries(SERVICE_DEFINITIONS).forEach(([key, service]) => {
      const accessCheck = canAccessServiceWithSubscription(key as ServiceKey, planId);
      
      if (accessCheck.canAccess && service.ready) {
        servicesToEnable.push(key as ServiceKey);
        console.log(`✅ [SubscriptionServicePaystack] Plan ${planId} allows service: ${key}`);
      } else {
        console.log(`❌ [SubscriptionServicePaystack] Plan ${planId} does NOT allow service: ${key}`);
      }
    });

    // Enable all allowed services
    let updatedServices = { ...currentServices };
    servicesToEnable.forEach(serviceKey => {
      updatedServices = enableService(updatedServices, serviceKey);
    });

    // Disable services that are NOT allowed by this plan
    Object.keys(SERVICE_DEFINITIONS).forEach((key) => {
      const serviceKey = key as ServiceKey;
      const accessCheck = canAccessServiceWithSubscription(serviceKey, planId);
      
      if (!accessCheck.canAccess) {
        updatedServices[serviceKey] = false;
      }
    });

    // Update user services in database
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { services: updatedServices } }
    );

    console.log('✅ [SubscriptionServicePaystack] Services updated for plan:', {
      planId,
      enabledServices: servicesToEnable,
      totalServices: Object.keys(updatedServices).length
    });
  }

  // Subscribe user to a plan with Paystack (called by webhook or after payment verification)
  static async subscribeToPlan(
    userId: ObjectId, 
    planId: string, 
    billingPeriod: 'monthly' | 'yearly',
    paystackSubscriptionCode: string,
    paystackPlanCode: string,
    options?: { seats?: number }
  ): Promise<void> {
    console.log('🔄 [SubscriptionServicePaystack] Subscribing user to plan:', {
      userId: userId.toString(),
      planId,
      billingPeriod,
      paystackSubscriptionCode,
      paystackPlanCode
    });

    const db = await getDatabase();
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingPeriod === 'yearly' ? 12 : 1));

    // IMPORTANT: Only update Paystack-specific fields
    // This preserves existing Stripe subscription data for backward compatibility
    const updateData: Record<string, unknown> = {
      'subscription.planId': planId,
      'subscription.status': 'active',
      'subscription.currentPeriodStart': currentPeriodStart,
      'subscription.currentPeriodEnd': currentPeriodEnd,
      'subscription.billingPeriod': billingPeriod,
      'subscription.paystackSubscriptionCode': paystackSubscriptionCode,
      'subscription.paystackPlanCode': paystackPlanCode,
      'subscription.updatedAt': new Date(),
      ...(options?.seats ? { 'subscription.seats': options.seats } : {})
    };
    // Clear payment-failed state and trial fields when they pay (user is now a paying customer)
    const unsetData: Record<string, 1> = { 
      'subscription.paymentFailedAt': 1,
      'subscription.trialStartDate': 1,
      'subscription.trialEndDate': 1,
      'subscription.trialActivatedAt': 1
    };

    console.log('💾 [SubscriptionServicePaystack] Updating database with:', JSON.stringify(updateData, null, 2));

    const userBefore = await db.collection('users').findOne({ _id: userId });
    console.log('📋 [SubscriptionServicePaystack] Current subscription before update:', {
      planId: userBefore?.subscription?.planId,
      status: userBefore?.subscription?.status,
      paystackSubscriptionCode: userBefore?.subscription?.paystackSubscriptionCode
    });

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData, $unset: unsetData }
    );

    console.log('📊 [SubscriptionServicePaystack] Database update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });

    // Verify the update worked by fetching the user again
    const userAfter = await db.collection('users').findOne({ _id: userId });
    console.log('✅ [SubscriptionServicePaystack] Verified subscription after update:', {
      planId: userAfter?.subscription?.planId,
      status: userAfter?.subscription?.status,
      billingPeriod: userAfter?.subscription?.billingPeriod,
      paystackSubscriptionCode: userAfter?.subscription?.paystackSubscriptionCode
    });

    if (result.modifiedCount === 1 || result.matchedCount === 1) {
      console.log('✅ [SubscriptionServicePaystack] User subscription updated successfully:', userId.toString());
      
      // CRITICAL: Automatically enable services based on plan type
      // This ensures users see only what they've paid for
      await this.enableServicesForPlan(userId, planId);
    } else {
      console.log('⚠️ [SubscriptionServicePaystack] Update may not have modified the document:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        note: 'This might be okay if the subscription was already up to date'
      });
      
      // Still enable services even if document wasn't modified (might already be correct)
      await this.enableServicesForPlan(userId, planId);
    }
  }
}
