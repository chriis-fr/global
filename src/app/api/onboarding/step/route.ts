import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { ServiceOnboarding } from '@/models/User';

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

    // Update onboarding progress
    const currentServiceOnboarding = (user.onboarding.data as { serviceOnboarding?: Record<string, unknown> })?.serviceOnboarding || {};
    const updatedOnboarding = {
      ...user.onboarding,
      currentStep: step,
      completedSteps: completedSteps || [...user.onboarding.completedSteps, step],
      serviceOnboarding: {
        ...currentServiceOnboarding,
        ...stepData
      } as Partial<ServiceOnboarding>,
      // Mark onboarding as completed when user reaches step 4 (final step)
      completed: step === 4 ? true : user.onboarding.isCompleted
    };

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