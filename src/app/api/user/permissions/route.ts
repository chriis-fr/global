import { NextResponse } from 'next/server';

// GET removed: use getPermissions() server action from @/lib/actions/permissions
// PermissionContext calls getPermissions() instead of this API route.
export async function GET() {
  return NextResponse.json(
    { success: false, message: 'Use getPermissions() server action' },
    { status: 410 }
  );
}
