import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { getDatabase } from '@/lib/database';
import { createDefaultServices } from '@/lib/services/serviceManager';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User not found' 
        },
        { status: 404 }
      );
    }

    // Org members: use organization's enabled services so response matches what sidebar/services use.
    // When org has none enabled, sync from owner's user.services so members inherit owner's onboarding choices.
    let effectiveServices = user.services;
    if (user.organizationId) {
      try {
        const db = await getDatabase();
        const org = await db.collection('organizations').findOne({ _id: user.organizationId });
        const orgServices = org?.services as Record<string, boolean> | undefined;
        let hasAnyEnabled = orgServices && Object.values(orgServices).some(Boolean);
        if (hasAnyEnabled && orgServices) {
          effectiveServices = { ...createDefaultServices(), ...orgServices } as typeof user.services;
        } else if (org?.members?.length) {
          const ownerMember = (org.members as Array<{ userId: { toString: () => string }; role: string }>).find(
            (m) => m.role === 'owner'
          );
          if (ownerMember) {
            const ownerUser = await UserService.getUserById(ownerMember.userId.toString());
            const ownerServices = ownerUser?.services as Record<string, boolean> | undefined;
            const ownerHasAny = ownerServices && Object.values(ownerServices).some(Boolean);
            if (ownerHasAny && ownerServices) {
              effectiveServices = { ...createDefaultServices(), ...ownerServices } as typeof user.services;
              await OrganizationService.updateOrganization(user.organizationId.toString(), {
                services: effectiveServices
              });
            }
          }
        }
      } catch {
        // Keep user.services on error
      }
    }

    // Convert User model structure to API response structure
    // User model has: currentStep, completedSteps, data (with data.completed)
    // API response should have: completed, currentStep, completedSteps, serviceOnboarding
    // IMPORTANT: Check user's onboarding status, NOT organization status
    // Users must complete their own onboarding even if they belong to an organization
    // Mark as completed if data.completed is true OR currentStep is 4 (final step)
    const dataCompleted = (user.onboarding.data as { completed?: boolean })?.completed
    const isCompleted = dataCompleted === true || user.onboarding.currentStep === 4;
    const onboardingData = {
      completed: isCompleted,
      currentStep: user.onboarding.currentStep || 1,
      completedSteps: user.onboarding.completedSteps || [],
      serviceOnboarding: (user.onboarding.data as { serviceOnboarding?: Record<string, unknown> })?.serviceOnboarding || {}
    };
    
    console.log('📊 [OnboardingStatus] User onboarding:', {
      userId: user._id?.toString(),
      email: user.email,
      hasOrganization: !!user.organizationId,
      isCompleted: onboardingData.completed,
      currentStep: onboardingData.currentStep,
      completedSteps: onboardingData.completedSteps.length
    });

    return NextResponse.json({
      success: true,
      data: {
        onboarding: onboardingData,
        services: effectiveServices
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch onboarding status',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 