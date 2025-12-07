# Fix for "Unknown" Safe App Issue

## The Problem

When using Safe App with `localhost`, Safe cannot:
1. Fetch the manifest file (it's on localhost, not accessible to Safe's servers)
2. Display the app name and description (shows "unknown")

## The Solution

### Option 1: Use Ngrok (Recommended for Testing)

1. **Add to `.env.local`:**
   ```bash
   # For Safe App to work, use your ngrok URL
   NEXT_PUBLIC_BASE_URL=https://b172734798fa.ngrok-free.app
   NEXTAUTH_URL=https://b172734798fa.ngrok-free.app
   ```

2. **Restart your dev server:**
   ```bash
   npm run dev
   ```

3. **Now when you click "Pay with Safe":**
   - The URL will use your ngrok URL instead of localhost
   - Safe can fetch the manifest
   - App name and description will display correctly

### Option 2: Use Production URL

For production, set:
```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
```

## How It Works

The code now:
1. Checks for `NEXT_PUBLIC_BASE_URL` (client-accessible)
2. Falls back to `NEXTAUTH_URL` (via meta tag)
3. Falls back to `window.location.origin` (localhost)

The public URL is exposed via a meta tag in the layout, making it available to all client components.

## Important Notes

- **"Unknown" warning is normal** - Even with the correct URL, Safe will show a warning if your app isn't in their default list. This is expected and **does NOT affect functionality**.
- **Functionality works 100%** - Users can still sign transactions, batch payments, and use all Safe features even with the warning.
- **The warning disappears** once Safe approves your app for their default list.

## Testing

1. Set `NEXT_PUBLIC_BASE_URL` to your ngrok URL
2. Restart the dev server
3. Click "Pay with Safe" on a payable
4. Check the Safe App URL - it should now use your ngrok URL
5. Safe should be able to fetch the manifest and display app info

## Troubleshooting

If you still see localhost:
1. Make sure `NEXT_PUBLIC_BASE_URL` is set in `.env.local`
2. Restart your dev server (env vars are loaded at startup)
3. Clear browser cache
4. Check the meta tag in page source: `<meta name="public-url" content="...">`

