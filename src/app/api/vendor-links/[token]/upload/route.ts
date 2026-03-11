import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// POST /api/vendor-links/[token]/upload - Optional document upload for vendor invoice (public, token-validated)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const vendor = await db.collection('vendors').findOne({
      paymentLinkToken: token,
      status: { $ne: 'disabled' },
    });
    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Invalid or inactive link' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File must be less than 10MB' },
        { status: 400 }
      );
    }

    const type = (file.type || '').toLowerCase();
    const allowed =
      type === 'application/pdf' ||
      type.startsWith('image/') ||
      ALLOWED_TYPES.includes(type);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Allowed: PDF, images, or Word documents' },
        { status: 400 }
      );
    }

    const safeToken = token.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
    const fileName = `${safeToken}-${Date.now()}-${safeName}`;
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'vendor-invoices');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const url = `/uploads/vendor-invoices/${fileName}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[Vendor upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
