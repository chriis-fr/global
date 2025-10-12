import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    
    // Get all ledger entries
    const allLedgerEntries = await db.collection('financial_ledger').find({}).toArray();
    
    // Get all payables
    const allPayables = await db.collection('payables').find({}).toArray();
    
    // Get organization info
    const organization = session.user.organizationId ? await db.collection('organizations').findOne({
      _id: session.user.organizationId
    }) : null;
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          email: session.user.email,
          organizationId: session.user.organizationId
        },
        organization: organization ? {
          _id: organization._id,
          name: organization.name,
          billingEmail: organization.billingEmail
        } : null,
        ledgerEntries: allLedgerEntries.map(entry => ({
          _id: entry._id,
          type: entry.type,
          status: entry.status,
          amount: entry.amount,
          organizationId: entry.organizationId,
          ownerId: entry.ownerId,
          relatedPayableId: entry.relatedPayableId,
          relatedInvoiceId: entry.relatedInvoiceId
        })),
        payables: allPayables.map(payable => ({
          _id: payable._id,
          payableNumber: payable.payableNumber,
          status: payable.status,
          amount: payable.total || payable.amount,
          organizationId: payable.organizationId,
          ledgerEntryId: payable.ledgerEntryId,
          relatedInvoiceId: payable.relatedInvoiceId
        }))
      }
    });

  } catch (error) {
    console.error('❌ [Debug Ledger] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get ledger data' },
      { status: 500 }
    );
  }
}
