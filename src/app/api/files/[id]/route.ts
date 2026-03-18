import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
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

    const data = doc.data as Buffer | undefined;
    const contentType = (doc.contentType as string | undefined) || 'application/octet-stream';

    if (!data) {
      return new Response('File data missing', { status: 500 });
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    console.error('[Files GET] Error:', error);
    return new Response('Failed to fetch file', { status: 500 });
  }
}

