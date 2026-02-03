# Onboarding → Dashboard: Services Debug Checklist

Use this when creating an **organisation** and selecting services during onboarding, to confirm services show on the dashboard. All logs use the prefix **`[Services→Dashboard]`** so you can grep your terminal or browser console.

---

## Step-by-step verification

### 1. During onboarding – enable a service

1. Go through signup (business account, create organisation).
2. On onboarding **Step 2 (Service Selection)**, enable at least one service (e.g. Smart Invoicing).
3. **Terminal (server):** You should see:
   ```text
   [Services→Dashboard] POST /api/services: user updated { userId, organizationId, serviceKey, action, updatedServices, enabled: ['smartInvoicing', ...] }
   [Services→Dashboard] POST /api/services: organization updated { organizationId, services }
   ```
   - If you see **`no organizationId (individual user)`** → user has no org; only user document is updated (expected for individual).
   - If you see **`org sync failed`** → organisation update failed; fix the error and try again.

**Check:** `enabled` in the first log and `services` in the second (for org) should include the service you turned on.

---

### 2. Session refresh after enabling

- Onboarding calls **`updateSession()`** after a successful service toggle.
- That triggers the **JWT callback** (next time the session is read).

**Terminal (server):** After you complete onboarding and hit the dashboard, you should see:
   ```text
   [Services→Dashboard] JWT callback: org member { trigger, organizationId, orgFound: true, orgServices: ['smartInvoicing', ...], tokenServices: ['smartInvoicing', ...] }
   ```
   or for an individual user:
   ```text
   [Services→Dashboard] JWT callback: individual { trigger, tokenServices: ['smartInvoicing', ...] }
   ```

**If you see `orgFound: false` or `tokenServices: []`:**  
- Org member: JWT is falling back to user or org lookup failed (check for `JWT callback: org lookup failed` in logs).  
- Individual: user document may not have been updated or session wasn’t refreshed.

---

### 3. Dashboard load

1. Complete onboarding (Step 4) and land on `/dashboard`.
2. Dashboard runs a **one-time `updateSession()`** on load, so the JWT runs again and picks up latest user/org services.
3. **Browser DevTools → Console:** You should see:
   ```text
   [Services→Dashboard] Dashboard session.user.services { enabled: ['smartInvoicing', ...], smartInvoicing: true, accountsPayable: false }
   ```

**Check:** `enabled` and the booleans should match the services you enabled. If they’re empty or wrong, the session didn’t get the latest services (see Step 2).

---

## Quick checks

| Where | What to check |
|-------|----------------|
| **POST /api/services** | Log shows `user updated` and (for org) `organization updated` with correct `enabled` / `services`. |
| **JWT callback** | Log shows `org member` or `individual` with `tokenServices` (or `orgServices`) containing the services you enabled. |
| **Dashboard console** | Log shows `session.user.services` with `enabled` and booleans matching your choices. |
| **UI** | Dashboard quick actions / sidebar show the enabled services (e.g. Create Invoice if Smart Invoicing is on). |

---

## If services still don’t show

1. **Grep terminal for errors:**  
   `[Services→Dashboard]` and `org sync failed` or `org lookup failed`.
2. **Confirm org path:** For org users, the JWT uses **organisation** services. If org wasn’t updated in Step 1, token will fall back to user; fix org update or sync.
3. **Confirm session refresh:** Dashboard triggers one `updateSession()` on load. If the JWT isn’t run (e.g. token not refreshed), session stays stale; check that `trigger === 'update'` or refresh conditions are met in auth.
4. **ObjectId:** Org lookup uses `organizationId` as ObjectId; we convert string → ObjectId in auth. If you see `orgFound: false`, check `organizationId` in DB and in the JWT log.

---

## Removing debug logs

When you’re done debugging:

- **Server:** Search for `[Services→Dashboard]` and remove or comment out those `console.log` / `console.error` in:
  - `src/app/api/services/route.ts`
  - `src/lib/auth.ts`
- **Client:** Remove the `useEffect` that logs `Dashboard session.user.services` in `src/app/dashboard/page.tsx`.
