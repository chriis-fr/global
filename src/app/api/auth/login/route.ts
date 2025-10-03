import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Email and password are required' 
        },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await UserService.getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid email or password' 
        },
        { status: 401 }
      );
    }

    // Check if user has a password (OAuth users might not have passwords)
    if (!user.password) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'This account was created with Google. Please use "Continue with Google" to sign in.' 
        },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid email or password' 
        },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.subscription?.status !== 'active' && user.subscription?.status !== 'trial') {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Account is not active. Please contact support.' 
        },
        { status: 403 }
      );
    }

    // Update last login
    await UserService.updateUser(user._id!.toString(), {
      lastLoginAt: new Date()
    });

    // Remove password from response
    const { password: removedPassword, ...userWithoutPassword } = user;
    void removedPassword; // Suppress unused variable warning
    
    return NextResponse.json({
      success: true,
      data: userWithoutPassword,
      message: 'Login successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to login',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 