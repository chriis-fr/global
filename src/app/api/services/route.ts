import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { SERVICE_DEFINITIONS, ServiceKey, enableService, disableService, getEnabledServices } from '@/lib/services/serviceManager';

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
    const body = await request.json();
    const { userId, serviceKey, action } = body;

    // Basic validation
    if (!userId || !serviceKey || !action) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'userId, serviceKey, and action are required' 
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

    // Get current user
    const user = await UserService.getUserById(userId);
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
    const updatedServices = action === 'enable' 
      ? enableService(user.services, serviceKey as ServiceKey)
      : disableService(user.services, serviceKey as ServiceKey);

    // Update user
    const updatedUser = await UserService.updateUser(userId, { services: updatedServices });
    
    if (!updatedUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to update user services' 
        },
        { status: 500 }
      );
    }

    const enabledServices = getEnabledServices(updatedUser.services);
    
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