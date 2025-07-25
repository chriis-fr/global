import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import { UserService } from '@/lib/services/userService';
import { OrganizationMember } from '@/models';

// GET /api/organization/members - Get organization members
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
    
    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get member details
    const membersWithDetails = await Promise.all(
      organization.members.map(async (member) => {
        const memberUser = await UserService.getUserById(member.userId.toString());
        return {
          userId: member.userId.toString(),
          role: member.role,
          name: memberUser?.name || 'Unknown User',
          email: memberUser?.email || 'unknown@email.com',
          profilePicture: memberUser?.profilePicture || memberUser?.avatar
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        members: membersWithDetails,
        userRole: organization.members.find(m => m.userId.toString() === user._id!.toString())?.role || 'member'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch organization members',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/organization/members - Add a new member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(user.organizationId.toString(), user._id!.toString());
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can add members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'member' } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const newMember = await UserService.getUserByEmail(email);
    if (!newMember) {
      return NextResponse.json(
        { success: false, message: 'User not found with this email' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
    if (organization?.members.some(m => m.userId.toString() === newMember._id!.toString())) {
      return NextResponse.json(
        { success: false, message: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    // Add member to organization
    const memberData: OrganizationMember = {
      userId: newMember._id!,
      role
    };

    const updatedOrganization = await OrganizationService.addMember(user.organizationId.toString(), memberData);

    if (!updatedOrganization) {
      return NextResponse.json(
        { success: false, message: 'Failed to add member to organization' },
        { status: 500 }
      );
    }

    // Update user's organizationId and userType
    await UserService.updateUser(newMember._id!.toString(), {
      organizationId: user.organizationId,
      userType: 'business'
    });

    return NextResponse.json({
      success: true,
      data: {
        member: {
          userId: newMember._id!.toString(),
          role,
          name: newMember.name,
          email: newMember.email,
          profilePicture: newMember.profilePicture || newMember.avatar
        }
      },
      message: 'Member added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding organization member:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to add member to organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/organization/members - Update member role
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(user.organizationId.toString(), user._id!.toString());
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can update member roles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, message: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Prevent changing owner role
    if (role === 'owner') {
      return NextResponse.json(
        { success: false, message: 'Cannot change user to owner role' },
        { status: 400 }
      );
    }

    const updatedOrganization = await OrganizationService.updateMemberRole(
      user.organizationId.toString(),
      userId,
      role
    );

    if (!updatedOrganization) {
      return NextResponse.json(
        { success: false, message: 'Failed to update member role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update member role',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/organization/members - Remove a member
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner
    const isAdmin = await OrganizationService.isUserAdmin(user.organizationId.toString(), user._id!.toString());
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only organization admins can remove members' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent removing owner
    const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
    const memberToRemove = organization?.members.find(m => m.userId.toString() === userId);
    
    if (memberToRemove?.role === 'owner') {
      return NextResponse.json(
        { success: false, message: 'Cannot remove organization owner' },
        { status: 400 }
      );
    }

    const updatedOrganization = await OrganizationService.removeMember(
      user.organizationId.toString(),
      userId
    );

    if (!updatedOrganization) {
      return NextResponse.json(
        { success: false, message: 'Failed to remove member from organization' },
        { status: 500 }
      );
    }

    // Update user's organizationId and userType
    await UserService.updateUser(userId, {
      organizationId: undefined,
      userType: 'individual'
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing organization member:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to remove member from organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 