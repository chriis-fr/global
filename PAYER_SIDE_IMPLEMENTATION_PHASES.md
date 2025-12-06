# Payer Side Implementation Phases

## Current State Analysis

### ✅ What Exists (Sender Side)
- Invoice creation with crypto/fiat payment methods
- Safe wallet connection for senders
- Batch payment for senders
- Payment method selection in invoice creation

### ❌ What's Missing (Payer Side)
- Direct payment from invoice link page
- Wallet connection for payers (MetaMask, WalletConnect, Safe)
- Crypto payment execution (EOA or Safe)
- Payment method selection for payers
- Safe wallet payment proposals for payers

---

## Phase 5: Payer Wallet Connection & Payment Methods

### Overview
Enable payers to connect wallets and select payment methods when paying invoices.

### Implementation Steps

#### Step 5.1: Create Payer Wallet Connection Component
**File:** `src/components/payer/PayerWalletSelector.tsx`
- Modal/component for wallet selection
- Options: MetaMask, WalletConnect, Safe Wallet
- Detects available wallets
- Stores connected wallet in session/localStorage
- Returns wallet address and type

#### Step 5.2: Create Payer Payment Method Store
**File:** `src/lib/stores/payerPaymentStore.ts`
- Zustand store for payer payment methods
- Stores connected wallets (EOA, Safe)
- Caches wallet connections
- Manages active payment method

#### Step 5.3: Update Invoice Link Page with Payment Flow
**File:** `src/app/invoice/[invoiceNumber]/page.tsx`
- Replace "Pay Invoice" redirect with actual payment flow
- Add payment method selection (if crypto invoice)
- Show wallet connection UI
- Display payment details (amount, token, network)
- Add "Pay Now" button with payment execution

#### Step 5.4: Create Payer Payment Server Actions
**File:** `src/app/actions/payer-payment-actions.ts`
- `connectPayerWallet`: Connect payer's wallet (MetaMask/WalletConnect)
- `getPayerPaymentMethods`: Get payer's available payment methods
- `payInvoiceWithEOA`: Pay invoice with EOA wallet (client-side signing)
- `payInvoiceWithSafe`: Pay invoice with Safe wallet (propose transaction)
- `validatePayerWallet`: Validate payer has sufficient balance

---

## Phase 6: Crypto Invoice Payment Execution

### Overview
Implement actual payment execution for crypto invoices (both EOA and Safe).

### Implementation Steps

#### Step 6.1: EOA Payment Flow
**Files:**
- `src/components/payer/EOAPaymentModal.tsx`
- `src/app/actions/payer-payment-actions.ts`

**Flow:**
1. User clicks "Pay Invoice" on crypto invoice
2. Payment modal opens
3. User connects wallet (MetaMask/WalletConnect)
4. System validates:
   - Wallet is on correct network
   - Wallet has sufficient balance
   - Invoice is payable (status: sent/pending)
5. User confirms payment
6. Transaction is signed client-side (via wallet)
7. Transaction hash sent to server
8. Server validates transaction on blockchain
9. Invoice marked as "paid" with txHash
10. Success confirmation shown

**Server Action:**
```typescript
async function payInvoiceWithEOA({
  invoiceId,
  txHash,
  fromAddress,
  chainId
})
```

#### Step 6.2: Safe Wallet Payment Flow
**Files:**
- `src/components/payer/SafePaymentModal.tsx`
- `src/app/actions/payer-payment-actions.ts`

**Flow:**
1. User clicks "Pay Invoice" on crypto invoice
2. Payment modal opens
3. User selects "Pay with Safe Wallet"
4. User connects Safe wallet (or selects existing)
5. System validates:
   - Safe is on correct network
   - Safe has sufficient balance
   - User is an owner of the Safe
6. User confirms payment
7. Server creates Safe transaction proposal
8. Transaction proposed to Safe Transaction Service
9. Invoice marked as "proposed" with safeTxHash
10. User sees proposal link and instructions
11. Other Safe owners can sign
12. Once threshold met, transaction executes
13. Invoice marked as "paid" when confirmed

**Server Action:**
```typescript
async function payInvoiceWithSafe({
  invoiceId,
  safeAddress,
  proposerPrivateKey, // From connected wallet
  chainId
})
```

#### Step 6.3: Payment Status Tracking
**File:** `src/app/actions/payment-status-actions.ts`
- `getPaymentStatus`: Check transaction status on blockchain
- `pollPaymentStatus`: Poll blockchain for confirmation
- `updateInvoiceStatus`: Update invoice when payment confirmed
- Background job to sync payment statuses

---

## Phase 7: Payable Page Payment Integration

### Overview
Update payable page to support crypto payments (currently only marks as paid).

### Implementation Steps

#### Step 7.1: Update Payable Page with Payment UI
**File:** `src/app/dashboard/services/payables/[id]/page.tsx`
- Add payment method selection section
- Show payment details (amount, currency, network)
- Add "Pay with Crypto" button (if crypto payable)
- Add "Pay with Safe" option
- Show payment status (pending, proposed, paid)

#### Step 7.2: Create Payable Payment Server Actions
**File:** `src/app/actions/payable-payment-actions.ts`
- `payPayableWithEOA`: Pay payable with EOA wallet
- `payPayableWithSafe`: Pay payable with Safe wallet
- `getPayablePaymentStatus`: Get payment status
- Sync payable payment to related invoice

#### Step 7.3: Payment Confirmation Flow
- Show transaction hash after payment
- Link to blockchain explorer
- Show confirmation count (for Safe)
- Update payable status when confirmed

---

## Phase 8: Multi-Chain & Token Support

### Overview
Support multiple chains and tokens for payer payments.

### Implementation Steps

#### Step 8.1: Chain Detection & Switching
**File:** `src/lib/wallet/chainSwitcher.ts`
- Detect current wallet network
- Prompt user to switch if wrong network
- Auto-switch to invoice's network
- Support multiple chains (Celo, Ethereum, Polygon, etc.)

#### Step 8.2: Token Balance Validation
**File:** `src/lib/wallet/balanceChecker.ts`
- Check payer's token balance
- Validate sufficient balance before payment
- Show balance in payment UI
- Handle insufficient balance errors

#### Step 8.3: Token Approval (if needed)
**File:** `src/lib/wallet/tokenApproval.ts`
- Check if token approval needed
- Request approval transaction
- Handle approval flow
- Proceed with payment after approval

---

## Implementation Priority

### High Priority (Core Functionality)
1. **Phase 5.3**: Invoice Link Page Payment Flow
2. **Phase 6.1**: EOA Payment Flow
3. **Phase 6.2**: Safe Wallet Payment Flow
4. **Phase 7.1**: Payable Page Payment UI

### Medium Priority (Enhanced UX)
5. **Phase 5.1**: Payer Wallet Connection Component
6. **Phase 5.2**: Payer Payment Method Store
7. **Phase 6.3**: Payment Status Tracking
8. **Phase 8.1**: Chain Detection & Switching

### Low Priority (Nice to Have)
9. **Phase 8.2**: Token Balance Validation
10. **Phase 8.3**: Token Approval Flow

---

## Technical Requirements

### Dependencies Needed
- Wallet connection library (already have WalletConnect support)
- Blockchain interaction (already have viem)
- Safe SDK (already integrated)

### Server Actions to Create
1. `src/app/actions/payer-payment-actions.ts`
2. `src/app/actions/payable-payment-actions.ts`
3. `src/app/actions/payment-status-actions.ts`

### Components to Create
1. `src/components/payer/PayerWalletSelector.tsx`
2. `src/components/payer/EOAPaymentModal.tsx`
3. `src/components/payer/SafePaymentModal.tsx`
4. `src/components/payer/PaymentStatusTracker.tsx`

### Stores to Create
1. `src/lib/stores/payerPaymentStore.ts`

---

## Payment Flow Diagrams

### EOA Payment Flow
```
Invoice Link Page
  ↓
Click "Pay Invoice"
  ↓
Payment Modal Opens
  ↓
Connect Wallet (MetaMask/WalletConnect)
  ↓
Validate Network & Balance
  ↓
User Confirms Payment
  ↓
Wallet Signs Transaction (Client-Side)
  ↓
Transaction Hash Sent to Server
  ↓
Server Validates Transaction
  ↓
Invoice Marked as "paid"
  ↓
Success Confirmation
```

### Safe Payment Flow
```
Invoice Link Page
  ↓
Click "Pay Invoice"
  ↓
Payment Modal Opens
  ↓
Select "Pay with Safe Wallet"
  ↓
Connect Safe Wallet
  ↓
Validate Safe Network & Balance
  ↓
User Confirms Payment
  ↓
Server Creates Safe Transaction Proposal
  ↓
Proposal Sent to Safe Transaction Service
  ↓
Invoice Marked as "proposed"
  ↓
Show Proposal Link & Instructions
  ↓
Other Owners Sign (via Safe UI)
  ↓
Threshold Met → Transaction Executes
  ↓
Invoice Marked as "paid" (when confirmed)
```

---

## What's Left to Implement

### Critical Path (Must Have)
1. ✅ Invoice link page payment button → Actual payment flow
2. ✅ Wallet connection for payers
3. ✅ EOA payment execution
4. ✅ Safe wallet payment execution
5. ✅ Payment status tracking
6. ✅ Payable page payment integration

### Enhancement Path (Should Have)
7. ⚠️ Multi-chain support
8. ⚠️ Token balance validation
9. ⚠️ Payment method persistence
10. ⚠️ Payment history

### Future Enhancements (Nice to Have)
11. ⚠️ Scheduled payments
12. ⚠️ Partial payments
13. ⚠️ Payment reminders
14. ⚠️ Payment analytics

---

## Next Steps

1. **Start with Phase 5.3**: Update invoice link page with payment flow
2. **Then Phase 6.1**: Implement EOA payment (simpler, no multisig)
3. **Then Phase 6.2**: Implement Safe payment (more complex)
4. **Then Phase 7.1**: Update payable page
5. **Finally Phase 8**: Add multi-chain support

