import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrganizationService } from '@/lib/services/organizationService';
import { UserService } from '@/lib/services/userService';
import { CreateOrganizationInput, UpdateOrganizationInput } from '@/models';

// GET /api/organization - Get user's organization data
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

    // If user has an organization, get its data
    if (user.organizationId) {
      const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
      
      if (organization) {
        return NextResponse.json({
          success: true,
          data: {
            userType: user.userType,
            hasOrganization: true,
            organization,
            userRole: organization.members.find(m => m.userId.toString() === user._id!.toString())?.role || 'member'
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // User doesn't have an organization
    return NextResponse.json({
      success: true,
      data: {
        userType: user.userType,
        hasOrganization: false,
        organization: null,
        userRole: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching organization data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch organization data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/organization - Create a new organization
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

    // Check if user already has an organization
    if (user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User already belongs to an organization' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const orgData: CreateOrganizationInput = body;

    // Validate required fields
    if (!orgData.name || !orgData.billingEmail || !orgData.industry) {
      return NextResponse.json(
        { success: false, message: 'Name, billing email, and industry are required' },
        { status: 400 }
      );
    }

    // Check if organization name already exists
    const existingOrg = await OrganizationService.getOrganizationByName(orgData.name);
    if (existingOrg) {
      return NextResponse.json(
        { success: false, message: 'Organization name already exists' },
        { status: 400 }
      );
    }

    // Create organization with current user as owner
    const newOrganization = await OrganizationService.createOrganization({
      ...orgData,
      members: [{
        userId: user._id!,
        role: 'owner'
      }]
    });

    // Update user to link to the new organization
    await UserService.updateUser(user._id!.toString(), {
      organizationId: newOrganization._id,
      userType: 'business'
    });

    return NextResponse.json({
      success: true,
      data: newOrganization,
      message: 'Organization created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/organization - Update organization
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
        { success: false, message: 'Only organization admins can update organization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: UpdateOrganizationInput = body;

    const updatedOrganization = await OrganizationService.updateOrganization(
      user.organizationId.toString(),
      updateData
    );

    if (!updatedOrganization) {
      return NextResponse.json(
        { success: false, message: 'Failed to update organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedOrganization,
      message: 'Organization updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 