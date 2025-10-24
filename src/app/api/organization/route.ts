import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { CreateOrganizationInput, UpdateOrganizationInput } from '@/models';
import { getOrganizationData, createOrganization, updateOrganization } from '@/lib/actions/organization';

// GET /api/organization - Get user's organization data
export async function GET() {
  try {
    const result = await getOrganizationData();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Failed to fetch organization data' 
        },
        { status: 400 }
      );
    }
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
    const body = await request.json();
    const orgData: CreateOrganizationInput = body;

    const result = await createOrganization(orgData);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Organization created successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Failed to create organization' 
        },
        { status: 400 }
      );
    }
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
    const body = await request.json();
    const updateData: UpdateOrganizationInput = body;

    const result = await updateOrganization(updateData);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data,
        message: 'Organization updated successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Failed to update organization' 
        },
        { status: 400 }
      );
    }
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