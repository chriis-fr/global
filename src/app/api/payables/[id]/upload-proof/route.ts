import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid payable ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File must be less than 8MB' }, { status: 400 });
    }

    const type = (file.type || '').toLowerCase();
    if (!ALLOWED_TYPES.includes(type) && !type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Allowed: images or PDF' }, { status: 400 });
    }

    // Permission check: user must have access to this payable (org member or owner)
    const db = await connectToDatabase();
    const payables = db.collection('payables');
    const payable = await payables.findOne({ _id: new ObjectId(id) });
    if (!payable) {
      return NextResponse.json({ success: false, error: 'Payable not found' }, { status: 404 });
    }

    const isOrgUser = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    const hasAccess = isOrgUser
      ? payable.organizationId?.toString() === session.user.organizationId
      : payable.userId === session.user.email || payable.issuerId?.toString() === session.user.id;

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const safeId = id.slice(-8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
    const fileName = `payproof-${safeId}-${Date.now()}-${safeName}`;
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'payable-proofs');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadsDir, fileName), Buffer.from(bytes));

    const url = `/uploads/payable-proofs/${fileName}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[Payable proof upload] Error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

