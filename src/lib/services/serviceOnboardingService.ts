import { UserService } from './userService';
import { OrganizationService } from './organizationService';

export interface ServiceOnboardingData {
  serviceKey: string;
  serviceOnboarding: Record<string, unknown>;
  isCompleted: boolean;
  storageLocation: 'user' | 'organization';
}

export class ServiceOnboardingService {
  /**
   * Get service onboarding data for a specific service
   * Automatically determines whether to fetch from user or organization based on user type
   */
  static async getServiceOnboardingData(userEmail: string, serviceKey: string): Promise<ServiceOnboardingData | null> {
    try {
      const user = await UserService.getUserByEmail(userEmail);
      if (!user) {
        return null;
      }

      // For business users with organization, get data from organization
      if (user.userType === 'business' && user.organizationId) {
        const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
        if (!organization) {
          return null;
        }

        const serviceOnboarding = organization.onboarding.serviceOnboarding[serviceKey];
        const isCompleted = serviceOnboarding && 
          typeof serviceOnboarding === 'object' && 
          'completed' in serviceOnboarding ? 
          serviceOnboarding.completed : false;

        return {
          serviceKey,
          serviceOnboarding: (serviceOnboarding || {}) as Record<string, unknown>,
          isCompleted: Boolean(isCompleted),
          storageLocation: 'organization'
        };
      } else {
        // For individual users, get data from user record
        const serviceOnboarding = user.onboarding.serviceOnboarding[serviceKey];
        const isCompleted = serviceOnboarding && 
          typeof serviceOnboarding === 'object' && 
          'completed' in serviceOnboarding ? 
          serviceOnboarding.completed : false;

        return {
          serviceKey,
          serviceOnboarding: (serviceOnboarding || {}) as Record<string, unknown>,
          isCompleted: Boolean(isCompleted),
          storageLocation: 'user'
        };
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all service onboarding data for a user
   * Automatically determines whether to fetch from user or organization based on user type
   */
  static async getAllServiceOnboardingData(userEmail: string): Promise<{
    serviceOnboarding: Record<string, unknown>;
    services: Record<string, boolean>;
    storageLocation: 'user' | 'organization';
  } | null> {
    try {
      const user = await UserService.getUserByEmail(userEmail);
      if (!user) {
        return null;
      }

      // For business users with organization, get data from organization
      if (user.userType === 'business' && user.organizationId) {
        const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
        if (!organization) {
          return null;
        }

        return {
          serviceOnboarding: organization.onboarding.serviceOnboarding,
          services: organization.services as unknown as Record<string, boolean>,
          storageLocation: 'organization'
        };
      } else {
        // For individual users, get data from user record
        return {
          serviceOnboarding: user.onboarding.serviceOnboarding,
          services: user.services as unknown as Record<string, boolean>,
          storageLocation: 'user'
        };
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Save service onboarding data
   * Automatically determines whether to save to user or organization based on user type
   */
  static async saveServiceOnboardingData(
    userEmail: string, 
    serviceKey: string, 
    serviceData: Record<string, unknown>
  ): Promise<{
    success: boolean;
    message: string;
    storageLocation: 'user' | 'organization';
  }> {
    try {
      const user = await UserService.getUserByEmail(userEmail);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          storageLocation: 'user'
        };
      }

      // For business users with organization, save to organization
      if (user.userType === 'business' && user.organizationId) {
        const organization = await OrganizationService.getOrganizationById(user.organizationId.toString());
        if (!organization) {
          return {
            success: false,
            message: 'Organization not found',
            storageLocation: 'organization'
          };
        }

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

        const updatedOrganization = await OrganizationService.updateOrganization(organization._id!.toString(), {
          onboarding: {
            ...organization.onboarding,
            serviceOnboarding: updatedServiceOnboarding
          }
        });

        if (!updatedOrganization) {
          return {
            success: false,
            message: 'Failed to update organization service onboarding',
            storageLocation: 'organization'
          };
        }

        return {
          success: true,
          message: `${serviceKey} service onboarding completed successfully for organization`,
          storageLocation: 'organization'
        };
      } else {
        // For individual users, save to user record
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

        const updatedUser = await UserService.updateUser(user._id!.toString(), {
          onboarding: {
            ...user.onboarding,
            serviceOnboarding: updatedServiceOnboarding
          }
        });

        if (!updatedUser) {
          return {
            success: false,
            message: 'Failed to update user service onboarding',
            storageLocation: 'user'
          };
        }

        return {
          success: true,
          message: `${serviceKey} service onboarding completed successfully`,
          storageLocation: 'user'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to save service onboarding data',
        storageLocation: 'user'
      };
    }
  }

  /**
   * Check if a service onboarding is completed
   */
  static async isServiceOnboardingCompleted(userEmail: string, serviceKey: string): Promise<boolean> {
    const data = await this.getServiceOnboardingData(userEmail, serviceKey);
    return data?.isCompleted || false;
  }

  /**
   * Get business information for a service (e.g., for invoice creation)
   */
  static async getBusinessInfo(userEmail: string, serviceKey: string): Promise<{
    name: string;
    email: string;
    phone?: string;
    address: {
      street: string;
      city: string;
      state?: string;
      zipCode?: string;
      country: string;
    };
    taxId?: string;
    logo?: string;
  } | null> {
    const data = await this.getServiceOnboardingData(userEmail, serviceKey);
    if (!data || !data.isCompleted) {
      return null;
    }

    const businessInfo = data.serviceOnboarding.businessInfo;
    if (!businessInfo || typeof businessInfo !== 'object') {
      return null;
    }

    return businessInfo as {
      name: string;
      email: string;
      phone?: string;
      address: {
        street: string;
        city: string;
        state?: string;
        zipCode?: string;
        country: string;
      };
      taxId?: string;
      logo?: string;
    };
  }

  /**
   * Get invoice settings for a service
   */
  static async getInvoiceSettings(userEmail: string, serviceKey: string): Promise<{
    defaultCurrency: string;
    paymentTerms: number;
    taxRates: Array<{
      name: string;
      rate: number;
      description?: string;
    }>;
    invoiceTemplate: string;
  } | null> {
    const data = await this.getServiceOnboardingData(userEmail, serviceKey);
    if (!data || !data.isCompleted) {
      return null;
    }

    const invoiceSettings = data.serviceOnboarding.invoiceSettings;
    if (!invoiceSettings || typeof invoiceSettings !== 'object') {
      return null;
    }

    return invoiceSettings as {
      defaultCurrency: string;
      paymentTerms: number;
      taxRates: Array<{
        name: string;
        rate: number;
        description?: string;
      }>;
      invoiceTemplate: string;
    };
  }
} 