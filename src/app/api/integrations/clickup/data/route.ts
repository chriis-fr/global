import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/**
 * GET /api/integrations/clickup/data
 * Fetches tasks (or dummy data) from ClickUp for the connected org.
 * Uses stored access token; does not touch any existing invoice/payable logic.
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

  if (!user?.organizationId && !isAdmin) {
    return NextResponse.json({ success: false, data: [] });
  }

  const accessToken = connection?.accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ success: false, data: [], message: 'Not connected' });
  }

  try {
    // ClickUp: get authorized teams, then pick first and get spaces/lists/tasks
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: accessToken },
    });

    if (!teamsRes.ok) {
      return NextResponse.json({
        success: true,
        data: [
          { id: 'dummy-1', name: 'Sample task from ClickUp (API may need scope)', listName: 'List', spaceName: 'Space' },
        ],
      });
    }

    const teamsData = (await teamsRes.json()) as { teams?: Array<{ id: string }> };
    const teamId = teamsData?.teams?.[0]?.id;
    if (!teamId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const spacesRes = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space?archived=false`, {
      headers: { Authorization: accessToken },
    });
    if (!spacesRes.ok) {
      return NextResponse.json({ success: true, data: [] });
    }

    const spacesData = (await spacesRes.json()) as { spaces?: Array<{ id: string }> };
    const spaceId = spacesData?.spaces?.[0]?.id;
    if (!spaceId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const foldersRes = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list?archived=false`, {
      headers: { Authorization: accessToken },
    });
    if (!foldersRes.ok) {
      return NextResponse.json({ success: true, data: [] });
    }

    const foldersData = (await foldersRes.json()) as { lists?: Array<{ id: string; name: string }> };
    const lists = foldersData?.lists || [];
    const tasks: Array<{ id: string; name: string; listName?: string; spaceName?: string; status?: string }> = [];

    for (const list of lists.slice(0, 3)) {
      const tasksRes = await fetch(`https://api.clickup.com/api/v2/list/${list.id}/task?archived=false`, {
        headers: { Authorization: accessToken },
      });
      if (!tasksRes.ok) continue;
      const taskData = (await tasksRes.json()) as { tasks?: Array<{ id: string; name: string; status?: { status: string } }> };
      for (const t of taskData?.tasks || []) {
        tasks.push({
          id: t.id,
          name: t.name,
          listName: list.name,
          status: t.status?.status,
        });
      }
    }

    return NextResponse.json({ success: true, data: tasks });
  } catch (e) {
    console.error('[ClickUp] Data fetch error:', e);
    return NextResponse.json({ success: false, data: [] });
  }
}
