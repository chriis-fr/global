import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';

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
        services: user.services
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