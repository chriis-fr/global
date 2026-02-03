import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { enableService, createDefaultServices } from '@/lib/services/serviceManager';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceKey } = await request.json();
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service key is required' }, { status: 400 });
    }

    // Get current user
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Enable the service
    const currentServices = user.services ? { ...createDefaultServices(), ...user.services } : createDefaultServices();
    const updatedServices = enableService(currentServices, serviceKey);

    // Update user in database
    await UserService.updateUser(user._id!.toString(), {
      services: updatedServices
    });

    // Sync to organization when user belongs to one
    if (user.organizationId) {
      try {
        await OrganizationService.updateOrganization(user.organizationId.toString(), { services: updatedServices });
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({
      success: true,
      services: updatedServices,
      message: `Service ${serviceKey} enabled successfully`
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 