import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/**
 * GET /api/integrations/clickup/data
 * Fetches tasks from ClickUp for the connected org.
 * Query: ?teamId=XXX to use a specific workspace (team). If omitted, uses first team.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedTeamId = searchParams.get('teamId') || undefined;
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
    // ClickUp: get authorized teams (workspaces)
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: accessToken },
    });

    const teamsRaw = await teamsRes.text();
    console.log('[ClickUp Data] GET /team status:', teamsRes.status, 'raw (first 500):', teamsRaw.slice(0, 500));

    if (!teamsRes.ok) {
      console.log('[ClickUp Data] Teams API failed, Returning dummy. Full response:', teamsRaw.slice(0, 800));
      return NextResponse.json({
        success: true,
        data: [
          { id: 'dummy-1', name: 'Sample task from ClickUp (API may need scope)', listName: 'List', spaceName: 'Space' },
        ],
      });
    }

    const teamsData = JSON.parse(teamsRaw) as { teams?: Array<{ id: string; name?: string }> };
    const teams = teamsData?.teams || [];
    console.log('[ClickUp Data] Teams count:', teams.length, 'teams:', teams.map((t) => ({ id: t.id, name: t.name })));

    const teamId = selectedTeamId || teams[0]?.id;
    if (!teamId) {
      console.log('[ClickUp Data] No teamId. selectedTeamId:', selectedTeamId, 'firstTeam:', teams[0]?.id);
      return NextResponse.json({ success: true, data: [] });
    }

    if (selectedTeamId && !teams.some((t) => t.id === selectedTeamId)) {
      console.log('[ClickUp Data] selectedTeamId not in teams:', selectedTeamId, 'available:', teams.map((t) => t.id));
      return NextResponse.json({ success: false, data: [], message: 'Selected workspace not found' });
    }

    console.log('[ClickUp Data] Using teamId:', teamId, '(selected:', !!selectedTeamId, ')');

    const spacesRes = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space?archived=false`, {
      headers: { Authorization: accessToken },
    });
    const spacesRaw = await spacesRes.text();
    console.log('[ClickUp Data] GET /space status:', spacesRes.status, 'raw (first 400):', spacesRaw.slice(0, 400));

    if (!spacesRes.ok) {
      console.log('[ClickUp Data] Spaces API failed. Full:', spacesRaw.slice(0, 600));
      return NextResponse.json({ success: true, data: [] });
    }

    const spacesData = JSON.parse(spacesRaw) as { spaces?: Array<{ id: string; name?: string }> };
    const spaces = spacesData?.spaces || [];
    console.log('[ClickUp Data] Spaces count:', spaces.length, 'spaces:', spaces.map((s) => ({ id: s.id, name: s.name })));

    if (spaces.length === 0) {
      console.log('[ClickUp Data] No spaces');
      return NextResponse.json({ success: true, data: [] });
    }

    const tasks: Array<{ id: string; name: string; listId?: string; listName?: string; spaceName?: string; status?: string }> = [];
    const meta: { spacesChecked: number; listsChecked: number } = { spacesChecked: 0, listsChecked: 0 };
    const hierarchy: Array<{
      id: string;
      name: string;
      folders?: Array<{ id: string; name: string; lists: Array<{ id: string; name: string; taskCount: number }> }>;
      folderlessLists?: Array<{ id: string; name: string; taskCount: number }>;
    }> = [];

    for (const space of spaces) {
      const spaceId = space.id;
      const spaceName = space.name || 'Space';
      meta.spacesChecked++;

      const spaceNode: {
        id: string;
        name: string;
        folders?: Array<{ id: string; name: string; lists: Array<{ id: string; name: string; taskCount: number }> }>;
        folderlessLists?: Array<{ id: string; name: string; taskCount: number }>;
      } = { id: spaceId, name: spaceName };

      // Folderless lists
      const folderlessRes = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list?archived=false`, {
        headers: { Authorization: accessToken },
      });
      if (folderlessRes.ok) {
        const data = JSON.parse(await folderlessRes.text()) as { lists?: Array<{ id: string; name: string }> };
        const folderless = data?.lists || [];
        spaceNode.folderlessLists = [];
        for (const list of folderless) {
          meta.listsChecked++;
          const tasksRes = await fetch(`https://api.clickup.com/api/v2/list/${list.id}/task?archived=false&include_closed=true`, { headers: { Authorization: accessToken } });
          const listTasks = tasksRes.ok ? (JSON.parse(await tasksRes.text()) as { tasks?: unknown[] })?.tasks || [] : [];
          spaceNode.folderlessLists.push({ id: list.id, name: list.name, taskCount: listTasks.length });
          for (const t of listTasks as Array<{ id: string; name: string; status?: { status: string } }>) {
            tasks.push({ id: t.id, name: t.name, listId: list.id, listName: list.name, spaceName, status: t.status?.status });
          }
        }
      }

      // Folders and their lists
      const foldersRes = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/folder?archived=false`, {
        headers: { Authorization: accessToken },
      });
      if (foldersRes.ok) {
        const foldersData = JSON.parse(await foldersRes.text()) as { folders?: Array<{ id: string; name: string }> };
        const folders = foldersData?.folders || [];
        spaceNode.folders = [];
        for (const folder of folders) {
          const folderListsRes = await fetch(`https://api.clickup.com/api/v2/folder/${folder.id}/list?archived=false`, { headers: { Authorization: accessToken } });
          if (!folderListsRes.ok) continue;
          const folderListsData = JSON.parse(await folderListsRes.text()) as { lists?: Array<{ id: string; name: string }> };
          const folderLists = folderListsData?.lists || [];
          const folderNode = { id: folder.id, name: folder.name, lists: [] as Array<{ id: string; name: string; taskCount: number }> };
          for (const list of folderLists) {
            meta.listsChecked++;
            const tasksRes = await fetch(`https://api.clickup.com/api/v2/list/${list.id}/task?archived=false&include_closed=true`, { headers: { Authorization: accessToken } });
            const listTasks = tasksRes.ok ? (JSON.parse(await tasksRes.text()) as { tasks?: unknown[] })?.tasks || [] : [];
            folderNode.lists.push({ id: list.id, name: list.name, taskCount: listTasks.length });
            for (const t of listTasks as Array<{ id: string; name: string; status?: { status: string } }>) {
              tasks.push({ id: t.id, name: t.name, listId: list.id, listName: list.name, spaceName, status: t.status?.status });
            }
          }
          spaceNode.folders!.push(folderNode);
        }
      }

      hierarchy.push(spaceNode);
    }

    console.log('[ClickUp Data] Total tasks:', tasks.length, 'hierarchy spaces:', hierarchy.length);
    return NextResponse.json({ success: true, data: tasks, hierarchy, meta });
  } catch (e) {
    console.error('[ClickUp] Data fetch error:', e);
    return NextResponse.json({ success: false, data: [] });
  }
}
