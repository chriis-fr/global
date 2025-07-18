# MongoDB Models for Request Finance

This directory contains TypeScript interfaces and types for all MongoDB collections in the Request Finance application.

## Models Overview

### Core Entities

1. **User** (`User.ts`) - Individual user profiles with crypto wallet support
2. **Organization** (`Organization.ts`) - Business entities with member management
3. **Client** (`Client.ts`) - Invoice recipients and external parties
4. **Invoice** (`Invoice.ts`) - Core invoicing with items, taxes, and payment methods
5. **Payment** (`Payment.ts`) - Payment tracking with crypto transaction support
6. **Expense** (`Expense.ts`) - Expense management with approval workflows
7. **Transaction** (`Transaction.ts`) - Unified financial transaction logging
8. **AuditLog** (`AuditLog.ts`) - Compliance and audit trail tracking

## Key Features

### Crypto Integration
- **Wallet Addresses**: Users can have multiple crypto wallet addresses
- **Transaction Hashes**: Payments and transactions support blockchain transaction hashes
- **Multi-Currency**: Support for both fiat and cryptocurrency payments

### Relationships
- **Users ↔ Organizations**: Users belong to organizations with specific roles
- **Invoices ↔ Clients**: Invoices are issued to specific clients
- **Payments ↔ Invoices**: Payments are linked to specific invoices
- **Expenses ↔ Users**: Expenses are submitted by users within organizations

### Audit & Compliance
- **Audit Logs**: All significant actions are logged for compliance
- **Timestamps**: All models include createdAt and updatedAt fields
- **Status Tracking**: Comprehensive status tracking for invoices, payments, and expenses

## Usage

### Importing Models
```typescript
import { User, Organization, Invoice, CreateUserInput } from '@/models';
```

### Database Connection
```typescript
import { getDatabase } from '@/lib/database';

const db = await getDatabase();
const usersCollection = db.collection('users');
```

### Creating Records
```typescript
const newUser: CreateUserInput = {
  email: 'user@example.com',
  name: 'John Doe',
  role: 'user',
  walletAddresses: [
    {
      address: '0x123...',
      currency: 'ETH',
      network: 'Ethereum'
    }
  ],
  settings: {
    currencyPreference: 'USD',
    notifications: {
      email: true,
      sms: false
    }
  }
};
```

## Indexes

The following indexes should be created for optimal performance:

### Users Collection
- `email` (unique)
- `organizationId`

### Organizations Collection
- `name`
- `billingEmail` (unique)

### Invoices Collection
- `invoiceNumber` (unique)
- `issuerId`
- `clientId`
- `status`
- `dueDate`

### Payments Collection
- `invoiceId`
- `payerId`
- `status`

### Expenses Collection
- `userId`
- `organizationId`
- `status`

### Transactions Collection
- `relatedId`
- `organizationId`
- `status`

### AuditLogs Collection
- `userId`
- `organizationId`
- `entityId`
- `timestamp`

## Environment Variables

Set the following environment variables:

```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=request_finance
```

## Type Safety

All models include:
- **Input Types**: For creating new records (`CreateXInput`)
- **Update Types**: For partial updates (`UpdateXInput`)
- **Status Enums**: Type-safe status values
- **Relationship References**: Proper ObjectId typing for MongoDB references 