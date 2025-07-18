import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/userService'

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
      hasPhone: !!body.phone,
      hasIndustry: !!body.industry,
      hasAddress: !!body.address
    })

    // Prepare update data
    const updateData: {
      name?: string;
      phone?: string;
      industry?: string;
      address?: {
        street: string;
        city: string;
        country: string;
        postalCode: string;
      };
    } = {}
    
    if (body.name) updateData.name = body.name
    if (body.phone) updateData.phone = body.phone
    if (body.industry) updateData.industry = body.industry
    if (body.address) updateData.address = body.address

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
        phone: updatedUser.phone,
        industry: updatedUser.industry,
        address: updatedUser.address,
        profilePicture: updatedUser.profilePicture,
        avatar: updatedUser.avatar
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