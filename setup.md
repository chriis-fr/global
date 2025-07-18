# Setup Guide for Google OAuth and Profile System

## 1. Environment Variables

Create a `.env.local` file in your project root with the following content:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/chains-erp

# NextAuth Configuration
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

## 2. Google OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API

### Step 2: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Set authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
5. Copy the Client ID and Client Secret

### Step 3: Update Environment Variables
Replace the placeholder values in your `.env.local` file with the actual Google credentials.

## 3. Generate NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

Or use this online generator: https://generate-secret.vercel.app/32

## 4. Database Setup

Make sure MongoDB is running locally or use a cloud MongoDB instance.

## 5. Install Dependencies

```bash
npm install
```

## 6. Start the Development Server

```bash
npm run dev
```

## 7. Test the System

1. Open http://localhost:3000/auth
2. Try the "Continue with Google" button
3. Complete the onboarding flow
4. Visit http://localhost:3000/profile to see your profile

## Troubleshooting

### Common Issues:

1. **"Invalid redirect URI" error**: Make sure the redirect URI in Google Console matches exactly
2. **"NEXTAUTH_SECRET not set"**: Generate and set a proper secret
3. **Database connection issues**: Check MongoDB connection string
4. **Google OAuth not working**: Verify Client ID and Secret are correct

### Debug Mode:

Add this to your `.env.local` for detailed logging:
```bash
DEBUG=next-auth:*
```

## API Endpoints Available:

- `/api/auth/[...nextauth]` - NextAuth authentication
- `/api/auth/signup` - User registration
- `/api/auth/login` - User login
- `/api/users/profile` - Profile management
- `/api/services` - Service management
- `/api/onboarding/*` - Onboarding flow

## Features Implemented:

✅ Google OAuth login
✅ User profile with avatars
✅ Organization logos
✅ Session management
✅ Profile editing
✅ Onboarding flow
✅ Service selection
✅ Database integration
✅ Type safety
✅ Error handling 