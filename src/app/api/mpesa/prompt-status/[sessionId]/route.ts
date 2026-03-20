import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET /api/mpesa/prompt-status/[sessionId]
// Returns the status of a specific STK push session owned by the calling user.
// Using a session-specific ID (not "latest") prevents cross-prompt feedback on the same device.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id as string | undefined;
    const organizationId = session?.user?.organizationId as string | undefined;

    if (!userId || !organizationId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ success: false, error: 'Invalid session ID' }, { status: 400 });
    }

    const db = await connectToDatabase();
    const doc = await db.collection('mpesa_stk_sessions').findOne({
      _id: new ObjectId(sessionId),
      // Ownership check: must belong to this waiter AND this org
      waiterUserId: new ObjectId(userId),
      organizationId: new ObjectId(organizationId),
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const status = doc.status as 'pending' | 'success' | 'failed';
    const firstName  = (doc.customerFirstName  as string | undefined) || '';
    const middleName = (doc.customerMiddleName as string | undefined) || '';
    const lastName   = (doc.customerLastName   as string | undefined) || '';

    // Build a single display name — e.g. "JOHN DOE" or "JOHN" or null if not yet arrived
    const nameParts = [firstName, middleName, lastName].filter(Boolean);
    const customerName = nameParts.length > 0 ? nameParts.join(' ') : null;

    // nameReady = C2B confirmation has arrived (we have at least a first name)
    const nameReady = !!firstName;

    return NextResponse.json({
      success: true,
      prompt: {
        status,
        resultCode: doc.resultCode as string | undefined,
        resultDescription: doc.resultDescription as string | undefined,
        amount: doc.amount as number,
        phoneNumber: doc.phoneNumber as string,
        mpesaReceiptNumber: doc.mpesaReceiptNumber as string | undefined,
        transactionDate: doc.transactionDate ? (doc.transactionDate as Date).toISOString() : undefined,
        customerName,
        nameReady,
      },
    });
  } catch (error) {
    console.error('[prompt-status GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
