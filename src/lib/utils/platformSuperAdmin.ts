/** Matches Sidebar / PDF admin bypass: designated platform account. */
const PLATFORM_SUPER_ADMIN_EMAIL = 'caspianodhis@gmail.com';

/**
 * Platform super admin: `adminTag` or designated platform email.
 * Used for integrations and other org-less admin experiences.
 */
export function isPlatformSuperAdmin(
  user: { adminTag?: boolean; email?: string | null } | undefined
): boolean {
  if (!user) return false;
  if (user.adminTag === true) return true;
  return (user.email ?? '').toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL;
}
