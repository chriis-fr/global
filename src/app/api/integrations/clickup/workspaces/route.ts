import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/**
 * GET /api/integrations/clickup/workspaces
 * Returns ClickUp teams (workspaces) for the connected org.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, data: [] }, { status: 401 });
  }

  const user = await UserService.getUserByEmail(session.user.email);
  const isAdmin = (session.user as { adminTag?: boolean }).adminTag === true;

  const db = await getDatabase();
  let connection = null;
  if (user?.organizationId) {
    connection = await db.collection('integration_connections').findOne({
      organizationId: user.organizationId,
      provider: 'clickup',
    });
  } else if (isAdmin && user?._id) {
    connection = await db.collection('integration_connections').findOne({
      userId: user._id.toString(),
      provider: 'clickup',
    });
  }

  const accessToken = connection?.accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ success: false, data: [], message: 'Not connected' });
  }

  try {
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: accessToken },
    });

    const raw = await teamsRes.text();
    console.log('[ClickUp Workspaces] GET /team status:', teamsRes.status, 'raw (first 500):', raw.slice(0, 500));

    if (!teamsRes.ok) {
      console.log('[ClickUp Workspaces] Failed:', raw.slice(0, 600));
      return NextResponse.json({ success: false, data: [], message: 'Failed to fetch workspaces' });
    }

    const data = JSON.parse(raw) as { teams?: Array<{ id: string; name?: string }> };
    const teams = (data?.teams || []).map((t) => ({ id: t.id, name: t.name || 'Unnamed workspace' }));
    console.log('[ClickUp Workspaces] Returning', teams.length, 'workspaces:', teams);
    return NextResponse.json({ success: true, data: teams });
  } catch (e) {
    console.error('[ClickUp Workspaces] Error:', e);
    return NextResponse.json({ success: false, data: [] });
  }
}
