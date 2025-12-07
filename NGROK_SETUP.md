# Ngrok Setup for Google OAuth Testing

## Quick Setup

To test Google OAuth with ngrok, you need to:

### 1. Update `.env.local`

Add or update the `NEXTAUTH_URL` to use your ngrok URL:

```bash
# Temporarily change this for ngrok testing
NEXTAUTH_URL=https://b172734798fa.ngrok-free.app
```

### 2. Add Ngrok Callback URL to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Find your OAuth 2.0 Client ID
4. Click "Edit"
5. Under "Authorized redirect URIs", add:
   ```
   https://b172734798fa.ngrok-free.app/api/auth/callback/google
   ```
6. Click "Save"

### 3. Restart Your Dev Server

After updating `.env.local`, restart your Next.js dev server:

```bash
npm run dev
```

### 4. Test Google OAuth

Now when you click "Continue with Google", it will use the ngrok URL for the callback.

## Switching Back to Localhost

When you're done testing with ngrok:

1. Update `.env.local`:
   ```bash
   NEXTAUTH_URL=http://localhost:3000
   ```

2. Restart your dev server

## Notes

- The ngrok URL changes each time you restart ngrok (unless you have a paid plan with a static domain)
- You'll need to update both `.env.local` and Google Cloud Console each time the ngrok URL changes
- For production, use your actual domain instead of ngrok

