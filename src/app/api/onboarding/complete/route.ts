import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID is required' 
        },
        { status: 400 }
      );
    }

    const user = await UserService.getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User not found' 
        },
        { status: 404 }
      );
    }

    // Mark onboarding as completed
    const updatedOnboarding = {
      ...user.onboarding,
      completed: true,
      currentStep: 4,
      completedSteps: ['1', '2', '3', '4']
    };

    const updatedUser = await UserService.updateUser(userId, {
      onboarding: updatedOnboarding
    });

    if (!updatedUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to complete onboarding' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        onboarding: updatedUser.onboarding,
        message: 'Onboarding completed successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to complete onboarding',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 