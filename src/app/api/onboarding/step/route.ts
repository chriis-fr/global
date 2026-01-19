import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, step, stepData, completedSteps } = body;

    if (!userId || !step) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID and step are required' 
        },
        { status: 400 }
      );
    }

    // Try to get user by email first (more reliable), then by ID
    let user = await UserService.getUserByEmail(userId);
    if (!user) {
      // If userId is not an email, try to get user by ID
      try {
        user = await UserService.getUserById(userId);
      } catch {
      }
    }
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User not found' 
        },
        { status: 404 }
      );
    }

    // Log current onboarding structure for debugging
    console.log('📊 [OnboardingStep] Current user onboarding structure:', JSON.stringify({
      userId: user._id?.toString(),
      email: user.email,
      onboardingDataCompleted: (user.onboarding?.data as { completed?: boolean })?.completed,
      onboardingCurrentStep: user.onboarding?.currentStep
    }, null, 2));

    // Update onboarding progress
    // Handle both old structure (data.serviceOnboarding) and new structure (serviceOnboarding)
    const onboardingData = user.onboarding.data as { serviceOnboarding?: Record<string, unknown>; completed?: boolean } | undefined;
    const onboardingDirect = user.onboarding as { serviceOnboarding?: Record<string, unknown> } | undefined;
    const currentServiceOnboarding = 
      onboardingDirect?.serviceOnboarding || 
      onboardingData?.serviceOnboarding || 
      {};
    
    // Mark as completed if step is 4 (final step)
    const shouldMarkCompleted = step === 4;
    
    // Build the updated onboarding object
    // Note: User model has isCompleted, but UpdateUserInput uses completed
    // We'll set both to ensure compatibility
    const updatedOnboarding: {
      isCompleted?: boolean;
      currentStep: number;
      completedSteps: string[];
      data: Record<string, unknown>;
    } = {
      currentStep: step,
      completedSteps: completedSteps || [...(user.onboarding.completedSteps || []), step.toString()],
      data: {
        ...((user.onboarding.data as Record<string, unknown>) || {}),
        ...(shouldMarkCompleted ? { completed: true } : {}),
        serviceOnboarding: {
          ...currentServiceOnboarding,
          ...stepData
        }
      }
    };

    // Set isCompleted flag when step 4 is completed
    if (shouldMarkCompleted) {
      updatedOnboarding.isCompleted = true;
    }

    console.log('✅ [OnboardingStep] Updating onboarding:', {
      step,
      shouldMarkCompleted,
      isCompleted: updatedOnboarding.isCompleted,
      currentStep: updatedOnboarding.currentStep,
      completedSteps: updatedOnboarding.completedSteps.length
    });


    if (!user._id) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID not found' 
        },
        { status: 500 }
      );
    }

    const updatedUser = await UserService.updateUser(user._id.toString(), {
      onboarding: updatedOnboarding
    });

    if (!updatedUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to update onboarding progress' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        onboarding: updatedUser.onboarding,
        services: updatedUser.services
      },
      message: 'Onboarding step completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update onboarding step',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 