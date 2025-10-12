import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectToDatabase();
    const ledgerCollection = db.collection('financial_ledger');

    // Build query based on user type
    const isOrganization = !!session.user.organizationId;
    const baseQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Get all ledger entries
    const ledgerEntries = await ledgerCollection.find(baseQuery).sort({ createdAt: -1 }).limit(10).toArray();

    // Get paid receivables
    const paidReceivables = await ledgerCollection.find({
      ...baseQuery,
      type: 'receivable',
      status: 'paid'
    }).toArray();

    // Get approved payables
    const approvedPayables = await ledgerCollection.find({
      ...baseQuery,
      type: 'payable',
      status: 'approved'
    }).toArray();

    // Calculate net balance manually
    const totalPaidReceivables = paidReceivables.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalApprovedPayables = approvedPayables.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const netBalance = totalPaidReceivables - totalApprovedPayables;

    return NextResponse.json({
      success: true,
      data: {
        totalEntries: ledgerEntries.length,
        recentEntries: ledgerEntries.map(entry => ({
          _id: entry._id,
          type: entry.type,
          status: entry.status,
          amount: entry.amount,
          entryId: entry.entryId,
          createdAt: entry.createdAt
        })),
        paidReceivables: {
          count: paidReceivables.length,
          total: totalPaidReceivables,
          entries: paidReceivables.map(entry => ({
            _id: entry._id,
            amount: entry.amount,
            entryId: entry.entryId,
            status: entry.status
          }))
        },
        approvedPayables: {
          count: approvedPayables.length,
          total: totalApprovedPayables,
          entries: approvedPayables.map(entry => ({
            _id: entry._id,
            amount: entry.amount,
            entryId: entry.entryId,
            status: entry.status
          }))
        },
        netBalance
      }
    });

  } catch (error) {
    console.error('Error fetching ledger debug data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ledger data' }, { status: 500 });
  }
}