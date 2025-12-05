# Safe Wallet Logging & UI Status

## 📱 UI Status

**Current Status: UI Not Built Yet**

The Safe wallet functionality is currently **backend-only** (Phase 1 & 2 complete). The UI components will be built in **Phase 3** of the Request Finance migration.

### What's Available Now:
- ✅ Server actions for importing/connecting Safe wallets
- ✅ Database models and services
- ✅ Logging and error tracking

### What's Coming in Phase 3:
- 🔜 Safe wallet connection UI
- 🔜 Safe wallet list/management page
- 🔜 Payment method selection with Safe wallets
- 🔜 Batch payment UI

### To Test the Backend Now:
You can test the server actions directly from the browser console or create a temporary test page:

```typescript
// Test in browser console or temporary page
import { importExistingSafe, getConnectedSafeWallets } from "@/app/actions/safe-connection";

// Import a Safe wallet
const result = await importExistingSafe({
    safeAddress: "0x...", // Your Safe address
    name: "Test Safe",
});

// Get connected Safe wallets
const wallets = await getConnectedSafeWallets({});
```

---

## 📊 Logging System

### Overview

All Safe wallet operations now include **structured logging** with:
- ✅ Operation name
- ✅ Timestamp
- ✅ Success/Error status
- ✅ Duration tracking
- ✅ Metadata (addresses, IDs, counts, etc.)
- ✅ Error stack traces

### Log Format

Logs follow this pattern:
```
[Emoji] [Safe Connection] [Operation]: [Message] { metadata }
```

**Log Levels:**
- `ℹ️` - Info (operation started, progress updates)
- `✅` - Success (operation completed successfully)
- `❌` - Error (operation failed)
- `⚠️` - Warning (non-critical issues)

### Example Logs

#### Successful Import
```
✅ [Safe Connection] importExistingSafe: Safe wallet imported successfully {
  timestamp: "2024-01-15T10:30:45.123Z",
  safeAddress: "0x1234...",
  paymentMethodId: "507f1f77bcf86cd799439011",
  organizationId: "507f191e810c19729de860ea",
  ownersCount: 3,
  threshold: 2,
  durationMs: 1250
}
```

#### Error Log
```
❌ [Safe Connection] importExistingSafe ERROR: Failed to import Safe wallet {
  timestamp: "2024-01-15T10:30:45.123Z",
  message: "Chain not found or not enabled: ethereum",
  error: "Chain not found or not enabled: ethereum",
  errorStack: "Error: Chain not found...\n    at importExistingSafe...",
  durationMs: 45
}
```

---

## 🔍 Where to Find Logs

### Development Environment

**Console Output:**
- All logs appear in your **terminal/console** where Next.js is running
- Look for logs prefixed with `[Safe Connection]`

**Browser Console:**
- Client-side errors will appear in browser DevTools
- Server action errors are logged server-side

### Production Environment

**Server Logs:**
- Check your hosting platform's logs (Vercel, Railway, etc.)
- Filter by `[Safe Connection]` to find Safe wallet operations

**Error Tracking:**
- Consider integrating with Sentry or similar for production error tracking
- Logs include stack traces for easier debugging

---

## 📋 Logged Operations

### 1. `importExistingSafe`
**Logged Events:**
- Operation start (with input parameters)
- Session validation
- Chain configuration
- Safe info fetch from blockchain
- Existing Safe check
- Payment method creation
- Organization update
- Success/Error with duration

**Key Metadata:**
- `safeAddress` - Safe wallet address
- `chainId` - Blockchain network
- `ownersCount` - Number of Safe owners
- `threshold` - Required signatures
- `paymentMethodId` - Created payment method ID
- `durationMs` - Operation duration

### 2. `getConnectedSafeWallets`
**Logged Events:**
- Operation start
- Session validation
- Organization ID resolution
- Database query
- Success with count

**Key Metadata:**
- `organizationId` - Organization ID
- `count` - Number of Safe wallets found
- `durationMs` - Query duration

### 3. `disconnectSafeWallet`
**Logged Events:**
- Operation start
- Session validation
- Payment method lookup
- Marking as inactive
- Organization update
- Success/Error

**Key Metadata:**
- `paymentMethodId` - Payment method being disconnected
- `safeAddress` - Safe wallet address
- `organizationId` - Organization ID

### 4. `authorizeSafeApp`
**Logged Events:**
- Operation start
- Session validation
- Payment method lookup
- Authorization update
- Success/Error

**Key Metadata:**
- `paymentMethodId` - Payment method ID
- `safeAddress` - Safe wallet address
- `hasManifest` - Whether manifest was provided

---

## 🐛 Troubleshooting Guide

### Common Issues & Log Patterns

#### 1. "Unauthorized" Errors
**Log Pattern:**
```
❌ [Safe Connection] [operation]: Unauthorized - no session
```

**Solution:**
- Check if user is logged in
- Verify session is valid
- Check NextAuth configuration

#### 2. "Chain not found" Errors
**Log Pattern:**
```
❌ [Safe Connection] importExistingSafe: Chain not found {
  chainId: "ethereum"
}
```

**Solution:**
- Verify chain is in `SUPPORTED_CHAINS` array
- Check chain ID spelling
- Ensure chain is enabled

#### 3. "Safe wallet not found" Errors
**Log Pattern:**
```
❌ [Safe Connection] importExistingSafe ERROR: Failed to import Safe wallet {
  error: "Safe wallet not found on the specified chain"
}
```

**Solution:**
- Verify Safe address is correct
- Check Safe is deployed on the specified chain
- Verify RPC endpoint is working
- Check Safe Transaction Service URL

#### 4. "Organization ID required" Errors
**Log Pattern:**
```
❌ [Safe Connection] [operation]: Organization ID required {
  userId: "...",
  hasOrgId: false
}
```

**Solution:**
- User must be part of an organization
- Pass `organizationId` explicitly
- Check user's organization membership

#### 5. "Safe wallet already connected"
**Log Pattern:**
```
⚠️ [Safe Connection] importExistingSafe: Safe wallet already connected {
  safeAddress: "0x...",
  existingPaymentMethodId: "..."
}
```

**Solution:**
- This is a warning, not an error
- Safe is already connected
- Use existing `paymentMethodId` for payments

---

## 📈 Performance Monitoring

### Duration Tracking

All operations log `durationMs` to track performance:

**Expected Durations:**
- `importExistingSafe`: 500-2000ms (blockchain query + DB operations)
- `getConnectedSafeWallets`: 50-200ms (DB query only)
- `disconnectSafeWallet`: 100-300ms (DB updates)
- `authorizeSafeApp`: 100-300ms (DB update)

**If durations are high:**
- Check database connection
- Verify RPC endpoint response time
- Check network latency

---

## 🔧 Adding More Logging

To add logging to new Safe operations:

```typescript
const operation = "yourOperationName";
const startTime = Date.now();

try {
    logSafeOperation(operation, "info", "Starting operation", {
        // Add relevant metadata
    });
    
    // Your code here
    
    const duration = Date.now() - startTime;
    logSafeOperation(operation, "success", "Operation completed", {
        // Add result metadata
        durationMs: duration,
    });
} catch (error) {
    const duration = Date.now() - startTime;
    logSafeOperation(operation, "error", "Operation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
    });
}
```

---

## 🚀 Next Steps

1. **Phase 3**: Build UI components for Safe wallet management
2. **Monitoring**: Set up production error tracking (Sentry, etc.)
3. **Analytics**: Track Safe wallet usage metrics
4. **Alerts**: Set up alerts for critical errors

---

## 📝 Notes

- All logs include timestamps for correlation
- Error logs include stack traces for debugging
- Duration tracking helps identify performance issues
- Metadata is structured for easy filtering/searching

