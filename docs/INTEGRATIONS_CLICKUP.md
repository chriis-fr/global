# ClickUp integration – environment variables

The ClickUp integration uses OAuth 2.0. Add these to your **`.env`** (or `.env.local`) file. Do **not** commit the file with real secrets.

## Required variables

```env
# ClickUp OAuth (from ClickUp Settings → Apps → Create new app)
CLICKUP_CLIENT_ID=your_client_id_here
CLICKUP_CLIENT_SECRET=your_client_secret_here

# Must match the redirect URL you registered in the ClickUp app.
# Local: http://localhost:3000/api/integrations/clickup/callback
# Production: https://global.chains-erp.com/api/integrations/clickup/callback
CLICKUP_REDIRECT_URI=http://localhost:3000/api/integrations/clickup/callback
```

## Where to get them

1. Log in to ClickUp.
2. Click your avatar (top right) → **Settings**.
3. In the sidebar: **Apps** (or open https://app.clickup.com/settings/apps).
4. Click **Create new app**.
5. Set the app name and add the **Redirect URL** (same as `CLICKUP_REDIRECT_URI` above).
6. Copy the **client_id** and **secret** into `.env` as `CLICKUP_CLIENT_ID` and `CLICKUP_CLIENT_SECRET`.

## Where they are used in the app

- **Connect flow:** `src/app/api/integrations/clickup/connect/route.ts` uses `CLICKUP_CLIENT_ID` and `CLICKUP_REDIRECT_URI` to send users to ClickUp’s authorization page.
- **Callback:** `src/app/api/integrations/clickup/callback/route.ts` uses all three to exchange the authorization code for an access token and store it per organization.
- Tokens are stored in the `integration_connections` collection (per organization). No other app logic (invoices, sidebar, etc.) is changed by this integration.

## Production

For production, set `CLICKUP_REDIRECT_URI` to your live callback URL, e.g.:

`https://global.chains-erp.com/api/integrations/clickup/callback`

and add that exact URL in the ClickUp app’s redirect URL list.
