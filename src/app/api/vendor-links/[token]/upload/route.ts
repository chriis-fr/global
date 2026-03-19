import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

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

    const bytes = Buffer.from(await file.arrayBuffer());

    const files = db.collection('fileUploads');
    // Ensure TTL index (expires after 0 seconds past expiresAt)
    await files.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // ~2 weeks
    const doc = {
      ownerType: 'vendor-link',
      ownerId: (vendor._id as ObjectId) || null,
      originalName: file.name,
      contentType: type || 'application/octet-stream',
      size: bytes.length,
      data: bytes,
      createdAt: now,
      expiresAt,
    };

    const result = await files.insertOne(doc);
    const url = `/api/files/${result.insertedId.toString()}?t=${encodeURIComponent(type)}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[Vendor upload] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
