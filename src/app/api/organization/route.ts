import { NextResponse } from 'next/server';

// This route has been deprecated - use server actions instead
// GET /api/organization - Use getOrganizationData() server action
// POST /api/organization - Use createOrganization() server action  
// PUT /api/organization - Use updateOrganization() server action

export async function GET() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'This API route has been deprecated. Please use getOrganizationData() server action instead.',
      deprecated: true
    },
    { status: 410 } // 410 Gone - resource is permanently removed
  );
}

export async function POST() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'This API route has been deprecated. Please use createOrganization() server action instead.',
      deprecated: true
    },
    { status: 410 } // 410 Gone - resource is permanently removed
  );
}

export async function PUT() {
  return NextResponse.json(
    { 
      success: false, 
      error: 'This API route has been deprecated. Please use updateOrganization() server action instead.',
      deprecated: true
    },
    { status: 410 } // 410 Gone - resource is permanently removed
  );
}
