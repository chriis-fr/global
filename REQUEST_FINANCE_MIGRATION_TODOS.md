# Request Finance Migration - TODO Outline

## Overview
This document outlines the step-by-step implementation plan to migrate Request Finance users to our platform by implementing the same Safe wallet connection and batch payment workflows.

**Key Principles:**
- ✅ Use server actions (no API routes)
- ✅ Additive only - no breaking changes
- ✅ Dynamic and flexible payment method system
- ✅ Sync with existing invoice and payment method structure

---

## Phase 1: Safe Wallet Connection (Like Request Finance)

### 1.1 Data Model Updates
- [ ] **Extend PaymentMethod model** (`src/models/PaymentMethod.ts`)
  - Add `safeDetails` field to `CryptoPaymentDetails` interface
  - Include: `safeAddress`, `safeOwners[]`, `safeThreshold`, `safeAppAuthorized` (boolean)
  - Add `connectionMethod` enum: `'safe_app' | 'wallet_connect' | 'manual'`
  - Add `authorizedAt` timestamp for Safe App authorization

- [ ] **Extend Organization model** (already has Safe fields, verify sync)
  - Ensure `safeAddress`, `safeOwners`, `safeThreshold` sync with PaymentMethod
  - Add `connectedSafeWallets[]` array of PaymentMethod IDs

- [ ] **Create SafeConnection model** (optional, for tracking connections)
  - Store Safe App authorization details
  - Track connection history
  - Store Safe App manifest/URL

### 1.2 Server Actions - Safe Connection
- [ ] **`connectSafeWallet()`** (`src/app/actions/safe-connection.ts`)
  - Input: `{ organizationId, safeAddress, connectionMethod, safeAppUrl? }`
  - Verify Safe address exists on chain
  - Fetch Safe owners and threshold from chain
  - Create PaymentMethod entry with type='crypto', subtype='safe'
  - Store in organization's connectedSafeWallets
  - Return: `{ success, paymentMethodId, safeAddress }`

- [ ] **`authorizeSafeApp()`** (if using Safe Apps)
  - Input: `{ paymentMethodId, safeAppManifest }`
  - Store authorization status
  - Update `safeAppAuthorized` flag
  - Return authorization token/status

- [ ] **`disconnectSafeWallet()`**
  - Input: `{ paymentMethodId }`
  - Remove from organization's connectedSafeWallets
  - Mark PaymentMethod as inactive
  - Keep history for audit

- [ ] **`getConnectedSafeWallets()`**
  - Input: `{ organizationId }`
  - Return all active Safe wallets for organization
  - Include Safe details (owners, threshold, balance if needed)

### 1.3 UI Components - Safe Connection
- [ ] **Safe Connection Modal** (`src/components/safe/ConnectSafeModal.tsx`)
  - Option 1: "Connect via Safe App" (opens Safe interface)
  - Option 2: "Connect Existing Safe" (manual address entry)
  - Option 3: "Deploy New Safe" (uses existing `serverDeploySafe`)
  - Show connection status and Safe details after connection

- [ ] **Safe Wallet Selector** (`src/components/safe/SafeWalletSelector.tsx`)
  - Display list of connected Safe wallets
  - Show Safe address, owners count, threshold
  - Allow selection for payments
  - Show balance (optional)

- [ ] **Safe Connection Page** (`src/app/dashboard/settings/safe-wallets/page.tsx`)
  - List all connected Safe wallets
  - Connect new Safe button
  - Disconnect option
  - View Safe details (owners, threshold, recent transactions)

---

## Phase 2: Payment Method Integration

### 2.1 Update Payment Method Service
- [ ] **Extend `PaymentMethodService`** (`src/lib/services/paymentMethodService.ts`)
  - Add `createSafePaymentMethod()` method
  - Add `getSafePaymentMethods()` method
  - Ensure Safe wallets appear in payment method lists
  - Sync with organization's Safe wallet list

### 2.2 Payment Method UI Updates
- [ ] **Update Payment Methods Page** (`src/app/dashboard/settings/payment-methods/page.tsx`)
  - Add "Connect Safe Wallet" button/option
  - Display Safe wallets in payment methods list
  - Show Safe-specific details (multisig badge, threshold)
  - Allow setting Safe as default payment method

- [ ] **Update Payment Method Selection** (invoice/payable creation)
  - Show Safe wallets as payment option
  - Display Safe-specific info when selected
  - Validate Safe has sufficient balance (optional)

---

## Phase 3: Batch Payment UI (Like Request Finance)

### 3.1 Invoice Selection Interface
- [ ] **Batch Selection Component** (`src/components/payments/BatchInvoiceSelector.tsx`)
  - Checkbox list of invoices (similar to Request Finance)
  - Filter by status, date, amount
  - Show total amount for selected invoices
  - Validate all invoices can be paid together (same chain/token)
  - Group by chain/token if needed

- [ ] **Batch Actions Bar** (`src/components/payments/BatchActionsBar.tsx`)
  - "Batch Approve" button (if approval workflow enabled)
  - "Batch Payment" button
  - Show count of selected invoices
  - Show total amount

### 3.2 Batch Payment Modal/Page
- [ ] **Batch Payment Modal** (`src/components/payments/BatchPaymentModal.tsx`)
  - Display selected invoices summary
  - Wallet/Safe selection dropdown
  - Show payment breakdown (per invoice)
  - Show total amount
  - "Approve & Pay" or "Pay" button
  - Transaction preview

- [ ] **Batch Payment Page** (`src/app/dashboard/payments/batch/page.tsx`)
  - Full-page version of batch payment
  - More detailed invoice list
  - Payment method selection
  - Transaction status tracking

### 3.3 Batch Approval UI (if approval workflow)
- [ ] **Batch Approval Modal** (`src/components/payments/BatchApprovalModal.tsx`)
  - List invoices requiring approval
  - Approve/Reject buttons
  - Bulk approval option
  - Comments field

---

## Phase 4: Batch Payment Server Actions

### 4.1 Batch Payment Creation
- [ ] **`createBatchPayment()`** (`src/app/actions/batch-payment.ts`)
  - Input: `{ invoiceIds[], paymentMethodId, organizationId, chainId? }`
  - Validate all invoices can be batched (same chain/token)
  - Get payment method (Safe or EOA)
  - Create batch transaction structure
  - If Safe: create Safe transaction proposal
  - If EOA: prepare direct transfers
  - Return: `{ batchId, txHash?, safeTxHash?, status }`

- [ ] **`validateBatchPayment()`**
  - Check invoice compatibility (chain, token, status)
  - Verify payment method has sufficient balance
  - Validate Safe threshold if using Safe
  - Return validation result

### 4.2 Batch Approval Flow
- [ ] **`approveBatchPayment()`** (if approval workflow)
  - Input: `{ batchId, approverId, approved, comments? }`
  - Update batch approval status
  - Check if all required approvals received
  - Auto-proceed to payment if threshold met
  - Return approval status

- [ ] **`getBatchApprovalStatus()`**
  - Return current approval status
  - List approvers and their status
  - Show remaining approvals needed

### 4.3 Batch Execution
- [ ] **`executeBatchPayment()`** (`src/app/actions/batch-payment.ts`)
  - Input: `{ batchId, proposerPrivateKey? }`
  - If Safe: execute Safe transaction (if threshold met)
  - If EOA: execute direct transfers
  - Update all invoice statuses
  - Create payment records
  - Return execution result

- [ ] **`getBatchPaymentStatus()`**
  - Poll transaction status
  - Update invoice statuses when confirmed
  - Return current batch status

---

## Phase 5: Transaction Status Tracking

### 5.1 Status Polling
- [ ] **`pollTransactionStatus()`** (`src/app/actions/transaction-status.ts`)
  - Input: `{ txHash, chainId }`
  - Poll blockchain for transaction status
  - Update invoice status when confirmed
  - Handle failed transactions
  - Return current status

- [ ] **`pollSafeTransactionStatus()`**
  - Input: `{ safeTxHash, safeAddress, chainId }`
  - Poll Safe Transaction Service
  - Check signature count vs threshold
  - Update when executed
  - Return execution status

### 5.2 Background Jobs (Optional)
- [ ] **Transaction Status Sync Job**
  - Periodic job to check pending transactions
  - Update invoice statuses
  - Notify users of completion/failure

---

## Phase 6: Invoice Status Updates & Reporting

### 6.1 Post-Payment Updates
- [ ] **`updateInvoicesAfterBatchPayment()`**
  - Update all invoices in batch to "paid"
  - Store transaction hashes
  - Update payment dates
  - Create ledger entries

### 6.2 Accounting/Reporting Split
- [ ] **`splitBatchPaymentForReporting()`**
  - Create individual payment records per invoice
  - Link to batch payment
  - Maintain batch reference for audit
  - Export to CSV/accounting systems

- [ ] **Batch Payment History**
  - Store batch payment records
  - Link to individual invoices
  - Show batch summary in reports

---

## Phase 7: UI Integration Points

### 7.1 Invoice List Page
- [ ] **Add batch selection** (`src/app/dashboard/services/smart-invoicing/invoices/page.tsx`)
  - Checkboxes for invoice selection
  - Batch actions toolbar
  - Show batch payment status

### 7.2 Payables Page
- [ ] **Add batch selection** (if payables have similar flow)
  - Checkboxes for payable selection
  - Batch payment option
  - Integration with existing payable flow

### 7.3 Payment History
- [ ] **Batch Payment View**
  - Show batch payments in history
  - Expand to show individual invoices
  - Filter by batch vs individual

---

## Phase 8: Safe App Integration (Advanced)

### 8.1 Safe App Manifest
- [ ] **Create Safe App manifest.json**
  - Define app metadata
  - Set required permissions
  - Configure Safe App URL

### 8.2 Safe App Authorization Flow
- [ ] **Safe App Connection Handler**
  - Handle Safe App authorization callback
  - Store authorization token
  - Verify Safe App permissions

### 8.3 Safe App UI Integration
- [ ] **Embed Safe Interface** (if needed)
  - Iframe for Safe App
  - Communication bridge
  - Transaction signing flow

---

## Phase 9: Error Handling & Edge Cases

### 9.1 Error Handling
- [ ] **Transaction Failure Handling**
  - Handle failed transactions
  - Revert invoice status
  - Notify users
  - Retry mechanism

- [ ] **Safe Threshold Not Met**
  - Handle pending Safe transactions
  - Show signature status
  - Allow cancellation
  - Notify other signers

### 9.2 Edge Cases
- [ ] **Partial Batch Execution**
  - Handle if some invoices fail
  - Rollback strategy
  - Partial payment handling

- [ ] **Multi-Chain Batches**
  - Group invoices by chain
  - Create separate batches per chain
  - Execute in parallel

---

## Phase 10: Testing & Migration

### 10.1 Testing
- [ ] **Unit Tests**
  - Test batch payment creation
  - Test Safe connection
  - Test status updates

- [ ] **Integration Tests**
  - End-to-end batch payment flow
  - Safe connection flow
  - Multi-signature approval

### 10.2 Migration Support
- [ ] **Request Finance Data Import**
  - Import existing Safe connections
  - Import payment history
  - Map Request Finance users to our system

---

## Implementation Order (Recommended)

1. **Phase 1** - Safe Wallet Connection (Foundation)
2. **Phase 2** - Payment Method Integration (Sync with existing)
3. **Phase 4** - Batch Payment Server Actions (Core functionality)
4. **Phase 3** - Batch Payment UI (User interface)
5. **Phase 5** - Status Tracking (Real-time updates)
6. **Phase 6** - Reporting (Accounting integration)
7. **Phase 7** - UI Integration (Polish)
8. **Phase 8** - Safe App (Advanced features)
9. **Phase 9** - Error Handling (Robustness)
10. **Phase 10** - Testing (Quality assurance)

---

## Notes

- All server actions should be in `src/app/actions/` directory
- Use existing database helpers from `src/lib/db.ts`
- Leverage existing Safe functions from `src/lib/payments/safe.ts`
- Maintain backward compatibility with existing payment flows
- Keep payment method system flexible for future additions
- Follow Request Finance UX patterns for familiarity

---

## Questions to Clarify

1. Do we need Safe App integration, or just manual Safe connection?
2. Should batch payments support mixed payment methods (some Safe, some EOA)?
3. Do we need approval workflow for batch payments, or just Safe multisig?
4. Should we support batch payments across different chains in one batch?
5. Do we need real-time transaction status updates, or polling is sufficient?

