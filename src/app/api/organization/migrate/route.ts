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

    // Migrate organization members
    const migratedOrganization = await OrganizationService.migrateOrganizationMembers(user.organizationId.toString());
    
    if (!migratedOrganization) {
      return NextResponse.json(
        { success: false, message: 'Failed to migrate organization members' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Organization members migrated successfully',
      data: {
        organizationId: migratedOrganization._id,
        memberCount: migratedOrganization.members.length
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
