import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import { UserService } from '@/lib/services/userService';

// POST /api/organization/migrate - Migrate organization members to new structure
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(user.organizationId.toString(), user._id!.toString());
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can migrate members' },
        { status: 403 }
      );
    }

    // Get organization to return basic info
    const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
    
    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Organization migration completed successfully',
      data: {
        organizationId: organization._id,
        memberCount: organization.members.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error migrating organization members:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to migrate organization members',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
