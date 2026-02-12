import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

/**
 * GET /api/integrations/clickup/doc-pages?workspaceId=...&docId=...
 *
 * Fetches v3 Doc pages for a single ClickUp Doc:
 * - Page listing (titles / hierarchy)
 * - First page content (raw) for preview
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || undefined;
  const docId = searchParams.get('docId') || undefined;
  const pageId = searchParams.get('pageId') || undefined;

  if (!workspaceId || !docId) {
    return NextResponse.json(
      { success: false, error: 'workspaceId and docId are required' },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json(
      { success: false, error: 'Not connected to ClickUp' },
      { status: 401 }
    );
  }

  try {
    // 1) Page listing for this doc (titles / hierarchy)
    const listingRes = await fetch(
      `https://api.clickup.com/api/v3/workspaces/${workspaceId}/docs/${docId}/page_listing`,
      {
        headers: { Authorization: accessToken },
      }
    );
    const listingRaw = await listingRes.text();
    console.log(
      '[ClickUp DocPages] GET page_listing status:',
      listingRes.status,
      'raw (first 300):',
      listingRaw.slice(0, 300)
    );

    if (!listingRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch page listing' },
        { status: listingRes.status }
      );
    }

    // The Docs API sometimes returns an array directly (as your logs show),
    // and sometimes returns an object wrapper. Normalize both.
    const listingParsed = JSON.parse(listingRaw) as unknown;
    type RawPage = { id?: string; title?: string; name?: string };
    let rawPages: RawPage[] = [];
    if (Array.isArray(listingParsed)) {
      rawPages = listingParsed as RawPage[];
    } else if (listingParsed && typeof listingParsed === 'object') {
      const obj = listingParsed as { pages?: RawPage[]; page_listing?: RawPage[] };
      rawPages = obj.pages ?? obj.page_listing ?? [];
    }

    const pages = rawPages
      .map((p) => ({ id: p.id ? String(p.id) : undefined, title: (p.title ?? p.name) ? String(p.title ?? p.name) : undefined }))
      .filter((p): p is { id: string; title?: string } => !!p.id);

    // 2) Fetch page content for either a requested pageId, or the first page.
    const targetPageId = pageId || pages[0]?.id;
    let page: unknown = null;
    if (targetPageId) {
      const pageRes = await fetch(
        `https://api.clickup.com/api/v3/workspaces/${workspaceId}/docs/${docId}/pages/${targetPageId}`,
        {
          headers: { Authorization: accessToken },
        }
      );
      const pageRaw = await pageRes.text();
      console.log(
        '[ClickUp DocPages] GET page status:',
        pageRes.status,
        'raw (first 300):',
        pageRaw.slice(0, 300)
      );
      if (pageRes.ok) {
        try {
          page = JSON.parse(pageRaw);
        } catch {
          page = pageRaw;
        }
      }
    }

    return NextResponse.json({
      success: true,
      pages,
      pageId: targetPageId ?? null,
      page,
    });
  } catch (err) {
    console.error('[ClickUp DocPages] Error:', err);
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 });
  }
}

