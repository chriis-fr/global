import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { CreateUserInput } from '@/models';

// GET /api/users - Get all users
export async function GET() {
  try {
    const users = await UserService.getAllUsers();
    const count = await UserService.getUserCount();
    
    return NextResponse.json({
      success: true,
      data: users,
      count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body: CreateUserInput = await request.json();
    
    // Basic validation
    if (!body.email || !body.name || !body.role) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Email, name, and role are required' 
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await UserService.getUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User with this email already exists' 
        },
        { status: 409 }
      );
    }

    const newUser = await UserService.createUser(body);
    
    return NextResponse.json({
      success: true,
      data: newUser,
      message: 'User created successfully',
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
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