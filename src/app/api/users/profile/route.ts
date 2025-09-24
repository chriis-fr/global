import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/userService'

// GET /api/users/profile - Get user profile
export async function GET() {
  try {
    console.log('🔧 [Profile API] Getting user profile...')
    
    // Get session
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.log('❌ [Profile API] No session found')
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [Profile API] Session found for:', session.user.email)
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email)
    if (!user) {
      console.log('❌ [Profile API] User not found in database')
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    console.log('✅ [Profile API] User found:', user._id)
    console.log('🔍 [Profile API] User services:', user.services)
    
    return NextResponse.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        organizationId: user.organizationId,
        services: user.services, // This is the key field we need
        preferences: user.preferences,
        onboarding: user.onboarding,
        subscription: user.subscription,
        usage: user.usage
      }
    })

  } catch (error) {
    console.error('❌ [Profile API] Error getting profile:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('🔧 [Profile API] Starting profile update...')
    
    // Get session
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      console.log('❌ [Profile API] No session found')
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [Profile API] Session found for:', session.user.email)
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email)
    if (!user) {
      console.log('❌ [Profile API] User not found in database')
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    console.log('✅ [Profile API] User found:', user._id)
    
    // Get request body
    const body = await request.json()
    console.log('📋 [Profile API] Update data received:', {
      name: body.name,
      hasPreferences: !!body.preferences
    })

    // Prepare update data - only include fields that exist in the User model
    const updateData: {
      name?: string;
      preferences?: {
        currency?: string;
        timezone?: string;
        notifications?: {
          email?: boolean;
          push?: boolean;
          invoiceReminders?: boolean;
          paymentNotifications?: boolean;
        };
      };
    } = {}
    
    if (body.name) updateData.name = body.name
    if (body.preferences) updateData.preferences = body.preferences

    console.log('💾 [Profile API] Updating user with data:', updateData)
    
    // Update user
    const updatedUser = await UserService.updateUser(user._id!.toString(), updateData)
    
    if (!updatedUser) {
      console.log('❌ [Profile API] Failed to update user')
      return NextResponse.json(
        { success: false, message: 'Failed to update profile' },
        { status: 500 }
      )
    }

    console.log('✅ [Profile API] User updated successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        preferences: updatedUser.preferences
      }
    })

  } catch (error) {
    console.error('❌ [Profile API] Error updating profile:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 