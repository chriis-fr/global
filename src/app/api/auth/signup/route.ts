import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { CreateUserInput } from '@/models';
import { createDefaultServices } from '@/lib/services/serviceManager';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  console.log('🚀 [SIGNUP] Starting signup process...');
  try {
    const body = await request.json();
    console.log('📥 [SIGNUP] Received request body:', { 
      email: body.email, 
      name: body.name, 
      userType: body.userType,
      hasPassword: !!body.password,
      hasAddress: !!body.address
    });
    
    const { email, password, name, userType, phone, industry, address, taxId } = body;

    // Basic validation
    console.log('🔍 [SIGNUP] Validating required fields...');
    console.log('📋 [SIGNUP] Field validation:', {
      hasEmail: !!email,
      hasPassword: !!password,
      hasName: !!name,
      hasUserType: !!userType,
      hasAddress: !!address,
      hasIndustry: !!industry
    });
    
    if (!email || !password || !name || !userType || !address) {
      console.log('❌ [SIGNUP] Validation failed - missing required fields');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Email, password, name, userType, and address are required' 
        },
        { status: 400 }
      );
    }
    console.log('✅ [SIGNUP] Basic validation passed');

    // Check if user already exists
    console.log('🔍 [SIGNUP] Checking for existing user with email:', email);
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      console.log('❌ [SIGNUP] User already exists with email:', email);
      return NextResponse.json(
        { 
          success: false, 
          message: 'User with this email already exists' 
        },
        { status: 409 }
      );
    }
    console.log('✅ [SIGNUP] No existing user found - email available');

    // Hash password
    console.log('🔐 [SIGNUP] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ [SIGNUP] Password hashed successfully');

    // Create user data
    console.log('📝 [SIGNUP] Creating user data object...');
    const userData: CreateUserInput = {
      email,
      password: hashedPassword,
      name,
      role: userType === 'business' ? 'admin' : 'user',
      userType,
      phone,
      industry,
      address,
      taxId,
      walletAddresses: [],
      settings: {
        currencyPreference: 'USD',
        notifications: {
          email: true,
          sms: false
        }
      },
      services: createDefaultServices(),
      onboarding: {
        completed: false,
        currentStep: 1,
        completedSteps: ['signup'],
        serviceOnboarding: {}
      }
    };
    console.log('📋 [SIGNUP] User data prepared:', {
      email: userData.email,
      name: userData.name,
      userType: userData.userType,
      role: userData.role,
      hasAddress: !!userData.address,
      hasServices: !!userData.services,
      hasOnboarding: !!userData.onboarding
    });

    console.log('💾 [SIGNUP] Calling UserService.createUser...');
    const newUser = await UserService.createUser(userData);
    console.log('✅ [SIGNUP] User created successfully with ID:', newUser._id);
    
    // Remove password from response - extract password to exclude it from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: removedPassword, ...userWithoutPassword } = newUser;
    
    console.log('📤 [SIGNUP] Sending success response with auto-login data...');
    return NextResponse.json({
      success: true,
      data: userWithoutPassword,
      message: 'User created successfully',
      autoLogin: {
        email: email,
        password: password // Send back for automatic login
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('❌ [SIGNUP] Error creating user:', error);
    console.error('🔍 [SIGNUP] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create user',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 