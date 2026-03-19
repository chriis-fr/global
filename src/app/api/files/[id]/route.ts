import { NextRequest } from 'next/server';
import { ObjectId, Binary } from 'mongodb';
import { connectToDatabase } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return new Response('Invalid file id', { status: 400 });
    }

    const db = await connectToDatabase();
    const files = db.collection('fileUploads');
    const doc = await files.findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return new Response('File not found', { status: 404 });
    }

    const contentType = (doc.contentType as string | undefined) || 'application/octet-stream';

    // MongoDB returns binary data as a BSON Binary object, not a plain Buffer.
    // We must unwrap it to get the actual bytes.
    const raw = doc.data;
    let bytes: Buffer;
    if (Buffer.isBuffer(raw)) {
      bytes = raw;
    } else if (raw instanceof Binary) {
      bytes = Buffer.from(raw.buffer);
    } else if (raw?.buffer instanceof Uint8Array || raw?.buffer instanceof ArrayBuffer) {
      bytes = Buffer.from(raw.buffer);
    } else if (raw != null) {
      // Last resort: try coercing to Buffer (handles edge cases across driver versions)
      bytes = Buffer.from(raw as unknown as ArrayBuffer);
    } else {
      return new Response('File data missing', { status: 500 });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[Files GET] Error:', error);
    return new Response('Failed to fetch file', { status: 500 });
  }
}

