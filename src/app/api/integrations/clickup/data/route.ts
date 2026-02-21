import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/** ClickUp task attachment (file/document) - can be converted for invoicing */
interface ClickUpAttachment {
  id?: string;
  title?: string;
  url?: string;
  type?: number;
  date_created?: string;
  source?: string;
}

/** ClickUp raw task from list API - destructure everything including attachments */
interface ClickUpRawTask {
  id?: string;
  name?: string;
  description?: string;
  markdown_description?: string;
  status?: { status?: string; color?: string; type?: string };
  url?: string;
  custom_task_ids?: boolean;
  custom_fields?: Array<{ id?: string; name?: string; type?: string; value?: unknown }>;
  tags?: Array<{ name?: string; tag_fg?: string }>;
  attachments?: ClickUpAttachment[];
  priority?: { priority?: string; color?: string };
  due_date?: string | null;
  start_date?: string | null;
  time_estimate?: number | null;
  parent?: string | null;
  list?: { id?: string; name?: string };
  folder?: { id?: string; name?: string };
  space?: { id?: string; name?: string };
  assignees?: Array<{ id?: number; username?: string }>;
  [key: string]: unknown;
}

export interface ClickUpTaskOutput {
  id: string;
  name: string;
  listId?: string;
  listName?: string;
  spaceName?: string;
  status?: string;
  description?: string;
  url?: string;
  tags?: string[];
  attachments?: ClickUpAttachment[];
  customFields?: Array<{ id?: string; name?: string; type?: string; value?: unknown }>;
  dueDate?: string | null;
  priority?: string;
}

/** Destructure raw task to output format, log every field until document/attachment level */
function destructureTask(
  raw: ClickUpRawTask,
  listId: string,
  listName: string,
  spaceName: string,
  taskIndex: number
): ClickUpTaskOutput {
  const {
    id,
    name,
    description,
    markdown_description,
    status,
    url,
    custom_fields,
    tags,
    attachments,
    priority,
    due_date,
    start_date,
    time_estimate,
    parent,
    list,
    folder,
    space,
    assignees,
    ...rest
  } = raw;

  // Log full structure for first task (or any with attachments) and log attachment documents
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (taskIndex === 0 || hasAttachments) {
    const logObj: Record<string, unknown> = {
      id,
      name,
      description: description ? '(present)' : undefined,
      markdown_description: markdown_description ? '(present)' : undefined,
      status,
      url,
      custom_fields,
      tags,
      attachments: attachments?.map((a) => ({ id: a.id, title: a.title, url: a.url, type: a.type, source: a.source })),
      priority,
      due_date,
      start_date,
      time_estimate,
      parent,
      list,
      folder,
      space,
      assignees,
      restKeys: Object.keys(rest),
    };
    console.log('[ClickUp Data] Task destructured:', JSON.stringify(logObj, null, 2));
    if (hasAttachments) {
      attachments.forEach((a, i) => {
        console.log(`[ClickUp Data] Attachment [${i}]:`, { id: a.id, title: a.title, url: a.url, type: a.type, source: a.source });
      });
    }
  }

  return {
    id: id ?? '',
    name: name ?? '',
    listId,
    listName,
    spaceName,
    status: status?.status,
    description: description ?? markdown_description,
    url,
    tags: tags?.map((t) => t.name ?? '').filter(Boolean),
    attachments,
    customFields: custom_fields,
    dueDate: due_date ?? null,
    priority: priority?.priority,
  };
}

/** Raw ClickUp Doc from v3 Docs API. */
interface ClickUpDocRaw {
  id?: string;
  name?: string;
  date_created?: string;
  date_updated?: string;
  created_by?: { id?: number; username?: string };
  updated_by?: { id?: number; username?: string };
  url?: string;
  [key: string]: unknown;
}

/** Normalized Doc we return to the frontend. */
interface ClickUpDocOutput {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  creatorName?: string;
  url?: string;
  parentId?: string | number;
  parentType?: number;
}

/** Destructure and log Docs so Week 9 and others are visible. */
function destructureDoc(raw: ClickUpDocRaw, index: number): ClickUpDocOutput {
  const { id, name, date_created, date_updated, created_by, updated_by, url, parent, ...rest } = raw as ClickUpDocRaw & {
    parent?: { id?: string | number; type?: number };
  };

  if (index === 0) {
    const logObj: Record<string, unknown> = {
      id,
      name,
      date_created,
      date_updated,
      url,
      parent,
      created_by,
      updated_by,
      restKeys: Object.keys(rest),
    };
    console.log('[ClickUp Data] Doc destructured (first):', JSON.stringify(logObj, null, 2));
  }

  return {
    id: id ?? '',
    name: name ?? '',
    createdAt: date_created,
    updatedAt: date_updated,
    creatorName: created_by?.username,
    url,
    parentId: parent?.id,
    parentType: parent?.type,
  };
}

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

    const tasks: ClickUpTaskOutput[] = [];
    const meta: { spacesChecked: number; listsChecked: number } = { spacesChecked: 0, listsChecked: 0 };
    let loggedRawKeys = false;
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
          const tasksRes = await fetch(
            `https://api.clickup.com/api/v2/list/${list.id}/task?archived=false&include_closed=true&include_markdown_description=true&subtasks=true&include_timl=true`,
            { headers: { Authorization: accessToken } }
          );
          const listTasks = tasksRes.ok ? (JSON.parse(await tasksRes.text()) as { tasks?: ClickUpRawTask[] })?.tasks || [] : [];
          spaceNode.folderlessLists.push({ id: list.id, name: list.name, taskCount: listTasks.length });
          if (listTasks.length > 0 && !loggedRawKeys) {
            console.log('[ClickUp Data] Raw task keys (first task):', Object.keys(listTasks[0]));
            loggedRawKeys = true;
          }
          for (let i = 0; i < listTasks.length; i++) {
            tasks.push(destructureTask(listTasks[i], list.id, list.name, spaceName, tasks.length + i));
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
            const tasksRes = await fetch(
              `https://api.clickup.com/api/v2/list/${list.id}/task?archived=false&include_closed=true&include_markdown_description=true&subtasks=true&include_timl=true`,
              { headers: { Authorization: accessToken } }
            );
            const listTasks = tasksRes.ok ? (JSON.parse(await tasksRes.text()) as { tasks?: ClickUpRawTask[] })?.tasks || [] : [];
            folderNode.lists.push({ id: list.id, name: list.name, taskCount: listTasks.length });
            if (listTasks.length > 0 && !loggedRawKeys) {
              console.log('[ClickUp Data] Raw task keys (first task):', Object.keys(listTasks[0]));
              loggedRawKeys = true;
            }
            for (let i = 0; i < listTasks.length; i++) {
              tasks.push(destructureTask(listTasks[i], list.id, list.name, spaceName, tasks.length + i));
            }
          }
          spaceNode.folders!.push(folderNode);
        }
      }

      hierarchy.push(spaceNode);
    }

    // Docs (ClickUp v3) – list Docs in this workspace so we can see Week 9 and others
    let docs: ClickUpDocOutput[] = [];
    try {
      const docsRes = await fetch(`https://api.clickup.com/api/v3/workspaces/${teamId}/docs`, {
        headers: { Authorization: accessToken },
      });
      const docsRaw = await docsRes.text();
      console.log(
        '[ClickUp Data] GET /v3/docs status:',
        docsRes.status,
        'raw (first 400):',
        docsRaw.slice(0, 400)
      );
      if (docsRes.ok) {
        const parsed = JSON.parse(docsRaw) as { docs?: ClickUpDocRaw[] };
        const rawDocs = parsed.docs || [];
        docs = rawDocs.map((d, idx) => destructureDoc(d, idx));
        console.log('[ClickUp Data] Docs count:', docs.length);
      } else {
        console.log('[ClickUp Data] Docs API failed');
      }
    } catch (err) {
      console.log('[ClickUp Data] Docs fetch error:', err);
    }

    const tasksWithAttachments = tasks.filter((t) => (t.attachments?.length ?? 0) > 0);
    console.log(
      '[ClickUp Data] Total tasks:',
      tasks.length,
      'hierarchy spaces:',
      hierarchy.length,
      'docs:',
      docs.length
    );
    if (tasksWithAttachments.length > 0) {
      console.log('[ClickUp Data] Tasks with attachments (documents to convert):', tasksWithAttachments.map((t) => ({ id: t.id, name: t.name, attachmentCount: t.attachments?.length ?? 0 })));
    }
    return NextResponse.json({ success: true, data: tasks, hierarchy, meta, docs });
  } catch (e) {
    console.error('[ClickUp] Data fetch error:', e);
    return NextResponse.json({ success: false, data: [] });
  }
}
