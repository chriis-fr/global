import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const user = await UserService.getUserByEmail(session.user.email);
  if (!user?.organizationId) {
    return NextResponse.json({ connected: false });
  }

  const db = await getDatabase();
  const doc = await db.collection('integration_connections').findOne({
    organizationId: user.organizationId,
    provider: 'clickup',
  });

  const connected = !!doc?.accessToken;
  console.log('[ClickUp Status] org:', user.organizationId?.toString(), 'connected:', connected);
  return NextResponse.json({ connected });
}
