# Paystack setup and subscription sync

This doc covers: (1) what to configure in Paystack, (2) how the app stays in sync with the database, and (3) payment reminders and past-due behavior (including 3-day degrade and data preservation).

---

## 1. What to do in Paystack

### 1.1 API keys and currency

- **Secret key** (required): In [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks, copy your **Secret Key**.
- **Currency**: Your Paystack account supports specific currencies (e.g. **KES**, NGN, GHS). Check Dashboard → Settings. Use that currency and convert from your USD prices.
- Add to `.env`:
  ```env
  PAYSTACK_SECRET_KEY=sk_live_xxxx   # or sk_test_xxx for test
  PAYSTACK_CURRENCY=KES              # KES, NGN, GHS, etc. (see your Paystack account)
  PAYSTACK_USD_TO_LOCAL_RATE=130     # 1 USD = 130 KES (adjust to your rate)
  ```
- Your billing plans are in **USD**; the app converts to the local currency when creating Paystack plans using `PAYSTACK_USD_TO_LOCAL_RATE`.

### 1.2 Webhook URL and secret

- In Paystack Dashboard → **Settings → API Keys & Webhooks**:
  - **Webhook URL**: `https://yourdomain.com/api/paystack/webhook`
  - Click **Generate** or copy the **Webhook Secret** and add to `.env`:
    ```env
    PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
    ```
- **Subscribed events** (enable these):
  - `subscription.create`
  - `subscription.update`
  - `subscription.disable`
  - `charge.success`
  - `charge.failed`

### 1.3 Dynamic plans (no manual plans needed)

- The app **creates plans on the fly** when a user checks out (e.g. Growth 1 seat = $5.99, 3 seats = $17.97).
- You do **not** need to create fixed plans in the Paystack dashboard for Growth/Scale/Combined.
- Ensure your Paystack account can charge in **USD** if you use USD pricing.

### 1.4 Optional: development

- To test webhooks locally, use a tunnel (e.g. ngrok) and set Webhook URL to your tunnel URL.
- You can set `DISABLE_PAYSTACK_IP_CHECK=true` in `.env` for local testing (do not use in production).
- Do **not** set `DISABLE_PAYSTACK_WEBHOOK=true` in production or webhooks will be ignored.

---

## 2. How the database stays in sync with Paystack

### 2.1 Flow overview

| Event | Webhook / action | What we do in the DB |
|--------|-------------------|----------------------|
| User subscribes (first payment) | `subscription.create` or success page calls `verifyAndActivateSubscription` | Set `subscription.planId`, `status: 'active'`, `currentPeriodStart`, `currentPeriodEnd`, `paystackSubscriptionCode`, `paystackPlanCode` |
| Recurring payment succeeds | `charge.success` | Call `subscribeToPlan` → update `currentPeriodStart`, `currentPeriodEnd`, `status: 'active'`, clear `paymentFailedAt` |
| Recurring payment fails | `charge.failed` | Set `subscription.status: 'past_due'`, `subscription.paymentFailedAt: now`; sync to org if user is owner |
| User cancels | `subscription.disable` | Set `subscription.status: 'cancelled'` |

### 2.2 Where subscription is stored

- **Users**: `users.subscription` (planId, status, currentPeriodEnd, paystackSubscriptionCode, paystackPlanCode, paymentFailedAt).
- **Organizations**: For org members, subscription is read from the **organization owner’s** subscription; when the owner’s subscription is updated (e.g. past_due or charge.success), we update the organization’s `subscription` copy so all members see the same state.

### 2.3 Caching

- Subscription is cached in memory (per user) and cleared on:
  - Plan change (free, subscribe, upgrade),
  - Webhook handling (`subscription.create`, `subscription.update`, `subscription.disable`, `charge.success`, `charge.failed`).
- So after Paystack sends an event, the next request gets fresh subscription from the DB.

---

## 3. Letting users know when to pay next

- **Next payment due**: The app shows “Next payment due: &lt;date&gt;” in the dashboard (from `subscription.currentPeriodEnd`) for active paid plans.
- **Reminders** (you can add these):
  - **Before due**: e.g. 3 days before `currentPeriodEnd`, send an email: “Your next payment of $X is on &lt;date&gt;.”
  - **After failure**: When status becomes `past_due`, send an email: “Your payment failed. Please update your payment method to restore access.”
  - **Optional 3-day reminder**: e.g. 1 day and 3 days after `paymentFailedAt`, remind again: “Your access is suspended. Pay to restore.”

Implementation options:
- A **cron job** or **scheduled function** (e.g. Vercel Cron, or a worker) that:
  - Finds users where `currentPeriodEnd` is in 3 days and sends “pay soon” emails.
  - Finds users where `status === 'past_due'` and `paymentFailedAt` is 1 or 3 days ago and sends “pay to restore” emails.
- Or use an email provider that supports scheduled campaigns based on your DB (e.g. segment “paid plan + currentPeriodEnd in 3 days” and “past_due”).

---

## 4. After 3 days of non-payment: degrade access, keep data

### 4.1 Current behavior

- On **first** payment failure, Paystack sends `charge.failed` and we set:
  - `subscription.status = 'past_due'`
  - `subscription.paymentFailedAt = now`
- **Immediately** after that:
  - The user is treated as **degraded**: they cannot create invoices, use payables, or use other paid features (`canCreateInvoice`, `canAccessPayables`, `canUseAdvancedFeatures` are false).
  - **No data is deleted**: invoices, clients, and all other data remain in the DB.
  - They can still open the dashboard but see a clear “Payment overdue – pay to restore access” and “Pay now” (and the dashboard past-due banner).

So “degrade” = **access is blocked** from the first failed payment; the “3 days” is typically used for **reminders** (e.g. remind at 0, 1, and 3 days after failure), not for a separate grace period in code.

### 4.2 Optional: 3-day grace before blocking

If you want to **allow full access for 3 days** after the first failure and only then block:

- In `getUserSubscription` (and org path), instead of blocking whenever `status === 'past_due'`, block only when:
  - `status === 'past_due'` **and**
  - `paymentFailedAt` is more than 3 days ago.
- Until then, keep showing a warning (“Your payment failed. Please pay within 3 days to avoid loss of access.”) but do not set `canCreateInvoice` / `canAccessPayables` to false.

Right now the app **does not** implement this grace window; access is restricted as soon as `past_due` is set.

### 4.3 Restoring access

- When the user pays (successful renewal or one-time pay), Paystack sends `charge.success`.
- We run the same logic as a new subscription: set `status: 'active'`, update `currentPeriodEnd`, and **clear** `paymentFailedAt`.
- After cache clear, the user immediately has access again; data was never removed.

---

## 5. Checklist

- [ ] Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` to `.env`.
- [ ] In Paystack Dashboard, set Webhook URL to `https://yourdomain.com/api/paystack/webhook` and enable `subscription.create`, `subscription.update`, `subscription.disable`, `charge.success`, `charge.failed`.
- [ ] Confirm currency (e.g. USD) and that dynamic plan creation works for your pricing (already implemented in code).
- [ ] Optional: Add a cron/scheduled job to send “pay next by X” and “payment failed / pay to restore” emails using `currentPeriodEnd` and `paymentFailedAt`.
- [ ] Optional: Implement 3-day grace before blocking (see 4.2) if you want access to continue for 3 days after the first failure.
