import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  let uploadId: string | null = null;
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    uploadId = body.uploadId;

    if (!uploadId) {
      return NextResponse.json({ success: false, error: 'Upload ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    const db = await connectToDatabase();
    const pdfUploadsCollection = db.collection('pdfUploads');
    
    const pdfUpload = await pdfUploadsCollection.findOne({
      _id: new ObjectId(uploadId),
    });

    if (!pdfUpload) {
      return NextResponse.json({ success: false, error: 'PDF upload not found' }, { status: 404 });
    }

    // Update status to processing
    await pdfUploadsCollection.updateOne(
      { _id: new ObjectId(uploadId) },
      { $set: { status: 'processing', updatedAt: new Date() } }
    );

    // Call Python parsing service
    const pythonServiceUrl = process.env.PDF_PARSING_SERVICE_URL || 'http://localhost:8000';
    
    // Read the PDF file
    const pdfPath = join(process.cwd(), 'public', pdfUpload.filePath);
    const pdfBuffer = await readFile(pdfPath);

    // Create FormData for Python service
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', pdfBuffer, {
      filename: pdfUpload.originalName,
      contentType: 'application/pdf',
    });

    const parseResponse = await fetch(`${pythonServiceUrl}/parse`, {
      method: 'POST',
      body: formData as any,
      headers: formData.getHeaders(),
    });

    if (!parseResponse.ok) {
      throw new Error(`Python service error: ${parseResponse.statusText}`);
    }

    const parseResult = await parseResponse.json();

    if (!parseResult.success || !parseResult.fields) {
      throw new Error('Failed to parse PDF');
    }

    // Convert Python service response to our format
    const extractedFields = parseResult.fields.map((field: any, index: number) => ({
      key: `field_${index + 1}`,
      value: field.value || field.text || '',
      confidence: field.confidence || 0.5,
      source: field.source || 'layout',
      position: field.position,
    }));

    // Get user
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Create invoice draft
    const draftInput = {
      userId: user._id!,
      organizationId: user.organizationId,
      sourcePdfId: new ObjectId(uploadId),
      sourcePdfUrl: pdfUpload.filePath,
      extractedFields,
      status: 'mapping',
      invoiceData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const draftsCollection = db.collection('invoiceDrafts');
    const draftResult = await draftsCollection.insertOne(draftInput);

    // Update PDF upload status
    await pdfUploadsCollection.updateOne(
      { _id: new ObjectId(uploadId) },
      { $set: { status: 'completed', updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      data: {
        draftId: draftResult.insertedId.toString(),
        extractedFields,
      },
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    
    // Update PDF upload status to error
    if (uploadId) {
      try {
        const db = await connectToDatabase();
        const pdfUploadsCollection = db.collection('pdfUploads');
        await pdfUploadsCollection.updateOne(
          { _id: new ObjectId(uploadId) },
          {
            $set: {
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              updatedAt: new Date(),
            },
          }
        );
      } catch (updateError) {
        console.error('Error updating PDF upload status:', updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse PDF',
      },
      { status: 500 }
    );
  }
}
