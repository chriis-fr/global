# Safe App URL Implementation

## Overview

This implementation allows your Safe App to work **immediately** without waiting for Safe's approval. It uses Safe's direct URL sharing method which works 100% without needing to be in Safe's default app list.

## How It Works

### Method 1: Direct Share URL (Currently Implemented)

When a user clicks "Pay with Safe" and Safe is not detected in the current browser, the app redirects to:

```
https://app.safe.global/share/safe-app?appUrl=YOUR_APP_URL
```

**Example:**
```
https://app.safe.global/share/safe-app?appUrl=https%3A%2F%2Fb172734798fa.ngrok-free.app%2Fsafe%2Fpay%3FpayableId%3D69346b152d658fa36f3fc345
```

**What happens:**
1. User clicks "Pay with Safe"
2. Safe App opens in a new tab
3. User selects their Safe wallet
4. Safe loads your app inside an iframe
5. User can pay, sign, batch, etc.
6. Safe shows a warning (because you're not listed), but **functionality works 100%**

### Method 2: Direct Safe Address (Available)

If you know the user's Safe address, you can open directly to that Safe:

```
https://app.safe.global/home?appUrl=YOUR_APP_URL&safe=celo:0xSafeAddress
```

This is available via `generateSafeAppUrlWithSafe()` function.

## Files Created/Modified

### New File: `src/lib/safe/safeAppUrl.ts`

Utility functions for generating Safe App URLs:

- `generateSafeAppShareUrl(appUrl)` - Basic share URL format
- `generateSafeAppUrlWithSafe(appUrl, safeAddress, chainId)` - URL with specific Safe
- `generatePayableSafeAppUrl(payableId, baseUrl, safeAddress?, chainId?)` - For payable payments
- `generateInvoiceSafeAppUrl(invoiceId, baseUrl, safeAddress?, chainId?)` - For invoice payments

### Modified: `src/components/payer/PayablePaymentModal.tsx`

Updated `buildSafeAppUrl()` to use the new utility function with the `/share/safe-app` format.

## Usage

### In PayablePaymentModal (Current Implementation)

```typescript
const buildSafeAppUrl = (): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return generatePayableSafeAppUrl(
        payable._id,
        origin,
        undefined, // No specific Safe - user selects
        chainId
    );
};
```

### With Specific Safe Address

```typescript
const safeAppUrl = generatePayableSafeAppUrl(
    payableId,
    "https://yourapp.com",
    "0x1234...5678", // Safe address
    42220 // Celo chain ID
);
```

## Benefits

✅ **Works immediately** - No approval needed from Safe  
✅ **Full functionality** - All Safe features work (sign, batch, execute)  
✅ **User-friendly** - Simple redirect flow  
✅ **Flexible** - Can work with or without specific Safe address  
✅ **Production-ready** - Works with ngrok, localhost, or production domains  

## Warning Message

When using this method, Safe will show:

> ⚠️ "Unknown app — not in default list"  
> "Check the app link and ensure it comes from a trusted source"

**This is normal and expected.** The warning does NOT affect functionality. Users can still:
- Sign transactions
- Batch payments
- Execute multisig operations
- Use all Safe features

## Testing

1. Start your dev server with ngrok:
   ```bash
   ngrok http 3000
   ```

2. Update `NEXTAUTH_URL` in `.env.local`:
   ```
   NEXTAUTH_URL=https://your-ngrok-url.ngrok-free.app
   ```

3. Click "Pay with Safe" in your app
4. Safe App should open in a new tab
5. Select your Safe wallet
6. Your payment page loads inside Safe
7. Complete the payment flow

## Future: Getting Listed

Once Safe approves your app for the default list:
- The warning message will disappear
- Your app will appear in Safe's app directory
- Users can discover your app directly in Safe
- The URL format will still work (backward compatible)

## Notes

- The `/share/safe-app` format is the recommended method for unlisted apps
- The `/apps/open` format (previous implementation) also works but `/share/safe-app` is more explicit
- Chain prefixes are automatically converted (e.g., 42220 → 'celo', 1 → 'eth')
- All URLs are properly encoded for safe transmission

