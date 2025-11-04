import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';

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
    const serviceKey = searchParams.get('service') || 'smartInvoicing';

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

    const debugInfo: Record<string, unknown> = {
      userEmail: user.email,
      userOrganizationId: user.organizationId?.toString(),
      serviceKey,
    };

    if (user.organizationId) {
      // For organization users
      const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
      if (organization) {
        debugInfo.organization = {
          _id: organization._id?.toString(),
          name: organization.name,
          services: organization.services,
          onboarding: {
            completed: organization.onboarding.completed,
            currentStep: organization.onboarding.currentStep,
            completedSteps: organization.onboarding.completedSteps,
            serviceOnboarding: organization.onboarding.serviceOnboarding,
          },
          // Show the specific service onboarding data
          [`${serviceKey}Onboarding`]: organization.onboarding.serviceOnboarding[serviceKey],
          // Check if service is enabled
          [`${serviceKey}Enabled`]: (organization.services as unknown as Record<string, unknown>)[serviceKey],
        };

        // Deep check for smartInvoicing data
        if (serviceKey === 'smartInvoicing') {
          const serviceData = organization.onboarding.serviceOnboarding[serviceKey];
          debugInfo.smartInvoicingAnalysis = {
            exists: !!serviceData,
            type: typeof serviceData,
            hasCompleted: serviceData && typeof serviceData === 'object' && 'completed' in serviceData,
            completedValue: serviceData && typeof serviceData === 'object' && 'completed' in serviceData ? (serviceData as Record<string, unknown>).completed : null,
            hasBusinessInfo: serviceData && typeof serviceData === 'object' && 'businessInfo' in serviceData,
            hasInvoiceSettings: serviceData && typeof serviceData === 'object' && 'invoiceSettings' in serviceData,
            fullData: serviceData,
          };
        }
      } else {
        debugInfo.organizationError = 'Organization not found';
      }
    } else {
      // For individual users
      const userOnboarding = user.onboarding;
      debugInfo.userOnboarding = {
        isCompleted: userOnboarding.isCompleted,
        currentStep: userOnboarding.currentStep,
        completedSteps: userOnboarding.completedSteps,
        data: userOnboarding.data,
      };

      // Check service onboarding in user data
      const serviceOnboarding = (userOnboarding.data as { serviceOnboarding?: Record<string, unknown> })?.serviceOnboarding || {};
      debugInfo.serviceOnboarding = serviceOnboarding;
      debugInfo[`${serviceKey}Onboarding`] = (serviceOnboarding as Record<string, unknown>)[serviceKey];

      // Deep check for smartInvoicing data
      if (serviceKey === 'smartInvoicing') {
        const serviceData = (serviceOnboarding as Record<string, unknown>)[serviceKey];
        debugInfo.smartInvoicingAnalysis = {
          exists: !!serviceData,
          type: typeof serviceData,
          hasCompleted: serviceData && typeof serviceData === 'object' && 'completed' in serviceData,
          completedValue: serviceData && typeof serviceData === 'object' && 'completed' in serviceData ? (serviceData as Record<string, unknown>).completed : null,
          hasBusinessInfo: serviceData && typeof serviceData === 'object' && 'businessInfo' in serviceData,
          hasInvoiceSettings: serviceData && typeof serviceData === 'object' && 'invoiceSettings' in serviceData,
          fullData: serviceData,
        };
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch debug info',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

