/**
 * Auth client: useSession from our context (no GET /api/auth/session).
 * signIn/signOut from NextAuth for OAuth and sign-out (POST only).
 */
export { useSession } from '@/lib/contexts/SessionContext';
export { signIn, signOut } from 'next-auth/react';
