import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';
import { SERVICE_DEFINITIONS, ServiceKey, enableService, disableService, getEnabledServices, createDefaultServices } from '@/lib/services/serviceManager';

// GET /api/services - Get all available services
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        services: SERVICE_DEFINITIONS,
        categories: Object.values(SERVICE_DEFINITIONS).map(def => def.category).filter((value, index, self) => self.indexOf(value) === index)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch services',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/services - Enable/disable services for a user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { serviceKey, action } = body;

    // Basic validation
    if (!serviceKey || !action) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'serviceKey and action are required' 
        },
        { status: 400 }
      );
    }

    if (!Object.keys(SERVICE_DEFINITIONS).includes(serviceKey)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid service key' 
        },
        { status: 400 }
      );
    }

    if (!['enable', 'disable'].includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Action must be either "enable" or "disable"' 
        },
        { status: 400 }
      );
    }

    // Get current user by email (from session)
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User not found' 
        },
        { status: 404 }
      );
    }

    // Update services
    const currentServices = user.services ? { ...createDefaultServices(), ...user.services } : createDefaultServices();
    const updatedServices = action === 'enable' 
      ? enableService(currentServices, serviceKey as ServiceKey)
      : disableService(currentServices, serviceKey as ServiceKey);

    // Update user
    if (!user._id) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID not found' 
        },
        { status: 500 }
      );
    }

    const updatedUser = await UserService.updateUser(user._id.toString(), { services: updatedServices });

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to update user services'
        },
        { status: 500 }
      );
    }

    // [Services→Dashboard] Step 1: User document updated with services (dashboard reads from session, which gets this via JWT refresh)
    console.log('[Services→Dashboard] POST /api/services: user updated', {
      userId: user._id?.toString(),
      organizationId: user.organizationId?.toString() ?? null,
      serviceKey,
      action,
      updatedServices: updatedUser.services,
      enabled: Object.entries(updatedUser.services || {}).filter(([, v]) => v).map(([k]) => k),
    });

    // When user belongs to an organization, also update the organization's services so
    // session/JWT (which reads org.services for org members) and all members see the same.
    if (user.organizationId) {
      try {
        await OrganizationService.updateOrganization(user.organizationId.toString(), {
          services: updatedServices
        });
        console.log('[Services→Dashboard] POST /api/services: organization updated', {
          organizationId: user.organizationId.toString(),
          services: updatedServices,
        });
      } catch (err) {
        console.error('[Services→Dashboard] POST /api/services: org sync failed', { organizationId: user.organizationId?.toString(), error: err });
        // Continue; user services were updated; org sync is best-effort
      }
    } else {
      console.log('[Services→Dashboard] POST /api/services: no organizationId (individual user); session will use user.services on next refresh');
    }

    const enabledServices = getEnabledServices(updatedUser.services ? { ...createDefaultServices(), ...updatedUser.services } : createDefaultServices());
    
    return NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        enabledServices,
        action,
        serviceKey
      },
      message: `Service ${action}d successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update services',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 