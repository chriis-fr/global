# PWA and Push Notifications Setup Guide

## Step 4: Generating VAPID Keys

To use Web Push Notifications, you need to generate VAPID (Voluntary Application Server Identification) keys.

### Option 1: Using web-push CLI (Recommended)

1. Install web-push globally (if not already installed):
   ```bash
   npm install -g web-push
   ```

2. Generate the VAPID keys:
   ```bash
   web-push generate-vapid-keys
   ```

3. Copy the output and add the keys to your `.env` file:
   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
   VAPID_PRIVATE_KEY=your_private_key_here
   VAPID_EMAIL=mailto:your-email@example.com
   ```

### Option 2: Using Node.js script

You can also generate keys programmatically:
```javascript
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

## Important Notes

- **NEXT_PUBLIC_VAPID_PUBLIC_KEY**: This is exposed to the client, so it's safe to use the `NEXT_PUBLIC_` prefix
- **VAPID_PRIVATE_KEY**: This must remain secret and should NEVER be exposed to the client
- **VAPID_EMAIL**: This is used for VAPID identification and should be a valid email or mailto: URL

## Testing Locally

To test push notifications locally, you need to:

1. Run Next.js with HTTPS:
   ```bash
   npm run dev -- --experimental-https
   ```

2. Ensure your browser has notifications enabled
3. Accept permissions when prompted
4. Make sure notifications are not disabled globally for your browser

## Production Deployment

When deploying to production:
- Ensure your site is served over HTTPS (required for service workers and push notifications)
- Add the VAPID keys to your production environment variables
- Test push notifications on your production domain

