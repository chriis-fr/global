# Service Onboarding System

## Overview

The service onboarding system ensures that service-specific data (business information, invoice settings, etc.) is stored in a centralized location and is easily retrievable for app operations. The system automatically determines whether to store data at the user level or organization level based on the user type.

## Data Storage Strategy

### Individual Users
- Service onboarding data is stored in `user.onboarding.serviceOnboarding`
- Each service has its own configuration (e.g., `smartInvoicing`, `expenses`, etc.)
- Data is user-specific and not shared

### Business Users (Organizations)
- Service onboarding data is stored in `organization.onboarding.serviceOnboarding`
- Data is shared across all organization members
- Ensures consistency across the organization
- Multiple users can access the same business settings

## Key Components

### 1. ServiceOnboardingService (`src/lib/services/serviceOnboardingService.ts`)

Central service for managing service onboarding data:

```typescript
// Get service onboarding data for a specific service
const data = await ServiceOnboardingService.getServiceOnboardingData(userEmail, 'smartInvoicing');

// Check if service onboarding is completed
const isCompleted = await ServiceOnboardingService.isServiceOnboardingCompleted(userEmail, 'smartInvoicing');

// Get business information for invoice creation
const businessInfo = await ServiceOnboardingService.getBusinessInfo(userEmail, 'smartInvoicing');

// Get invoice settings
const invoiceSettings = await ServiceOnboardingService.getInvoiceSettings(userEmail, 'smartInvoicing');
```

### 2. API Endpoint (`src/app/api/onboarding/service/route.ts`)

Handles saving and retrieving service onboarding data:

- **POST**: Save service onboarding data
- **GET**: Retrieve service onboarding data

Automatically determines storage location based on user type.

### 3. Data Models

#### User Model (`src/models/User.ts`)
```typescript
interface User {
  // ... other fields
  userType: 'individual' | 'business';
  organizationId?: ObjectId;
  onboarding: {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    serviceOnboarding: ServiceOnboarding;
  };
}
```

#### Organization Model (`src/models/Organization.ts`)
```typescript
interface Organization {
  // ... other fields
  onboarding: {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    serviceOnboarding: ServiceOnboarding;
  };
}
```

#### ServiceOnboarding Interface
```typescript
interface ServiceOnboarding {
  smartInvoicing?: {
    businessInfo: {
      name: string;
      email: string;
      phone?: string;
      address: Address;
      taxId?: string;
      logo?: string;
    };
    invoiceSettings: {
      defaultCurrency: string;
      paymentTerms: number;
      taxRates: Array<{
        name: string;
        rate: number;
        description?: string;
      }>;
      invoiceTemplate: 'standard' | 'custom';
    };
    completed: boolean;
    completedAt: string;
  };
  // Other services can be added here
  [key: string]: unknown;
}
```

## Usage Examples

### 1. Smart Invoicing Service Onboarding

When a user completes Smart Invoicing setup:

```typescript
// Data is automatically saved to the appropriate location
const result = await ServiceOnboardingService.saveServiceOnboardingData(
  userEmail,
  'smartInvoicing',
  {
    businessInfo: {
      name: 'My Company',
      email: 'contact@mycompany.com',
      phone: '+1234567890',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      },
      taxId: '12-3456789'
    },
    invoiceSettings: {
      defaultCurrency: 'USD',
      paymentTerms: 30,
      taxRates: [
        {
          name: 'Sales Tax',
          rate: 8.5,
          description: 'State sales tax'
        }
      ],
      invoiceTemplate: 'standard'
    }
  }
);
```

### 2. Invoice Creation

When creating an invoice, the system automatically loads the appropriate business information:

```typescript
// Load business info from centralized location
const businessInfo = await ServiceOnboardingService.getBusinessInfo(userEmail, 'smartInvoicing');

if (businessInfo) {
  // Use the centralized business information
  setFormData(prev => ({
    ...prev,
    companyName: businessInfo.name,
    companyEmail: businessInfo.email,
    companyPhone: businessInfo.phone,
    companyAddress: businessInfo.address,
    companyTaxNumber: businessInfo.taxId
  }));
}
```

## Benefits

1. **Centralized Storage**: All service-specific data is stored in one place
2. **Automatic Location Detection**: System automatically determines whether to use user or organization data
3. **Consistency**: Business users share the same settings across the organization
4. **Retrievability**: Easy to access data for any app operation
5. **Scalability**: Easy to add new services with their own onboarding data

## Migration Strategy

For existing users:
- Individual users: Data remains in user record
- Business users: Data can be migrated to organization level when they create/join an organization
- New users: Data is automatically stored in the correct location based on user type

## API Endpoints

### POST `/api/onboarding/service`
Save service onboarding data

**Request:**
```json
{
  "serviceKey": "smartInvoicing",
  "serviceData": {
    "businessInfo": { ... },
    "invoiceSettings": { ... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceOnboarding": { ... },
    "message": "smartInvoicing service onboarding completed successfully",
    "storageLocation": "organization"
  }
}
```

### GET `/api/onboarding/service?service=smartInvoicing`
Retrieve service onboarding data

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceKey": "smartInvoicing",
    "serviceOnboarding": { ... },
    "isCompleted": true,
    "storageLocation": "organization"
  }
}
```

## Best Practices

1. **Always use the ServiceOnboardingService** for data operations
2. **Check completion status** before using service data
3. **Handle missing data gracefully** with fallbacks
4. **Log storage location** for debugging purposes
5. **Validate data structure** before using it

## Future Enhancements

1. **Data Migration Tools**: For moving data between user and organization
2. **Service Templates**: Pre-configured settings for common business types
3. **Data Validation**: Schema validation for service onboarding data
4. **Audit Trail**: Track changes to service onboarding data
5. **Multi-tenant Support**: Support for multiple organizations per user 