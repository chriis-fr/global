import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/**
 * DELETE /api/integrations/clickup/disconnect
 * Removes the ClickUp connection for the user's organization (or user if admin without org).
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await UserService.getUserByEmail(session.user.email);
  const isAdmin = (session.user as { adminTag?: boolean }).adminTag === true;

  const db = await getDatabase();
  const collection = db.collection('integration_connections');

  let result: { deletedCount: number };
  if (user?.organizationId) {
    result = await collection.deleteOne({
      organizationId: user.organizationId,
      provider: 'clickup',
    });
  } else if (isAdmin && user?._id) {
    result = await collection.deleteOne({
      userId: user._id.toString(),
      provider: 'clickup',
    });
  } else {
    return NextResponse.json({ success: false, error: 'No organization or user context' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    disconnected: (result.deletedCount ?? 0) > 0,
  });
}
