import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';

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
    const { serviceKey, serviceData } = body;

    if (!serviceKey) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Service key is required' 
        },
        { status: 400 }
      );
    }

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

    // Determine where to store service onboarding data based on user type
    if (user.userType === 'business' && user.organizationId) {
      // For business users, store service onboarding data in the organization
      const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
      if (!organization) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Organization not found' 
          },
          { status: 404 }
        );
      }

      // Update organization's service onboarding data
      const currentServiceData = organization.onboarding.serviceOnboarding[serviceKey] || {};
      const updatedServiceOnboarding = {
        ...organization.onboarding.serviceOnboarding,
        [serviceKey]: {
          ...currentServiceData,
          ...serviceData,
          completed: true,
          completedAt: new Date().toISOString()
        }
      };

      // Update organization's service onboarding
      const updatedOrganization = await OrganizationService.updateOrganization(organization._id!.toString(), {
        onboarding: {
          ...organization.onboarding,
          serviceOnboarding: updatedServiceOnboarding
        }
      });

      if (!updatedOrganization) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Failed to update organization service onboarding' 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          serviceOnboarding: updatedOrganization.onboarding.serviceOnboarding,
          message: `${serviceKey} service onboarding completed successfully for organization`,
          storageLocation: 'organization'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // For individual users, store service onboarding data in the user record
      const currentServiceData = user.onboarding.serviceOnboarding[serviceKey] || {};
      const updatedServiceOnboarding = {
        ...user.onboarding.serviceOnboarding,
        [serviceKey]: {
          ...currentServiceData,
          ...serviceData,
          completed: true,
          completedAt: new Date().toISOString()
        }
      };

      // Update user's service onboarding
      const updatedUser = await UserService.updateUser(user._id!.toString(), {
        onboarding: {
          ...user.onboarding,
          serviceOnboarding: updatedServiceOnboarding
        }
      });

      if (!updatedUser) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Failed to update service onboarding' 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          serviceOnboarding: updatedUser.onboarding.serviceOnboarding,
          message: `${serviceKey} service onboarding completed successfully`,
          storageLocation: 'user'
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating service onboarding:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update service onboarding',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const serviceKey = searchParams.get('service');

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

    // Determine where to retrieve service onboarding data based on user type
    if (user.userType === 'business' && user.organizationId) {
      // For business users, retrieve service onboarding data from the organization
      const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
      if (!organization) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Organization not found' 
          },
          { status: 404 }
        );
      }

      // If organization has services enabled, mark them as completed for organization members
      const organizationServiceOnboarding = organization.onboarding.serviceOnboarding || {};
      const organizationServices = organization.services || {};
      
      // For organization members, if a service is enabled in the organization, mark it as completed
      const completedServiceOnboarding = { ...organizationServiceOnboarding };
      
      // Check each service and mark as completed if enabled
      Object.entries(organizationServices).forEach(([serviceKey, isEnabled]) => {
        if (isEnabled && !completedServiceOnboarding[serviceKey]) {
          completedServiceOnboarding[serviceKey] = {
            completed: true,
            completedAt: organization.createdAt?.toISOString() || new Date().toISOString(),
            autoCompleted: true // Flag to indicate this was auto-completed for organization members
          };
        }
      });

      if (serviceKey) {
        // Return specific service onboarding status from organization
        const serviceOnboarding = completedServiceOnboarding[serviceKey];
        const isServiceEnabled = organizationServices[serviceKey];
        
        return NextResponse.json({
          success: true,
          data: {
            serviceKey,
            serviceOnboarding,
            isCompleted: isServiceEnabled || (serviceOnboarding && typeof serviceOnboarding === 'object' && 'completed' in serviceOnboarding ? serviceOnboarding.completed : false),
            storageLocation: 'organization',
            serviceEnabled: isServiceEnabled
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Return all service onboarding status from organization
        return NextResponse.json({
          success: true,
          data: {
            serviceOnboarding: completedServiceOnboarding,
            services: organizationServices,
            storageLocation: 'organization'
          },
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // For individual users, retrieve service onboarding data from the user record
      if (serviceKey) {
        // Return specific service onboarding status from user
        const serviceOnboarding = user.onboarding.serviceOnboarding[serviceKey];
        return NextResponse.json({
          success: true,
          data: {
            serviceKey,
            serviceOnboarding,
            isCompleted: serviceOnboarding && typeof serviceOnboarding === 'object' && 'completed' in serviceOnboarding ? serviceOnboarding.completed : false,
            storageLocation: 'user'
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Return all service onboarding status from user
        return NextResponse.json({
          success: true,
          data: {
            serviceOnboarding: user.onboarding.serviceOnboarding,
            services: user.services,
            storageLocation: 'user'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching service onboarding status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch service onboarding status',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 