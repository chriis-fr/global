# Chains ERP - Global Finance Platform

A comprehensive fintech platform similar to Request Finance, built with Next.js, MongoDB, and blockchain technology. Features include user management, organization profiles, invoicing, payments, expenses, and service integrations.

## Features

- **User Authentication**: Email/password and Google OAuth login
- **Organization Management**: Multi-user organizations with roles
- **Profile Management**: User avatars and organization logos
- **Service Integration**: Configurable business services
- **Onboarding Flow**: Multi-step user and organization setup
- **Blockchain Integration**: Smart contracts and crypto payments
- **Invoice Management**: Create and manage invoices
- **Payment Processing**: Multiple payment methods
- **Audit Trail**: Complete transaction history

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local or cloud)
- Google OAuth credentials

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

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

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Set authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. Copy the Client ID and Client Secret to your `.env.local` file

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
