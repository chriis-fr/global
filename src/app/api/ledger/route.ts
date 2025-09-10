import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { FinancialLedgerEntry, LedgerEntryType, LedgerEntryStatus, LedgerStats, LedgerFilters, LedgerPagination } from '@/models/FinancialLedger';

// Generate unique entry ID
const generateEntryId = async (db: any, type: LedgerEntryType, organizationId: string, ownerId: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Create a short, secure identifier
  let secureId: string;
  if (organizationId) {
    secureId = organizationId.slice(-4);
  } else {
    const emailParts = ownerId.split('@');
    const username = emailParts[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const domain = emailParts[1]?.replace(/[^a-zA-Z0-9]/g, '').slice(-2) || 'XX';
    secureId = `${username}${domain}`.toUpperCase();
  }
  
  // Query for the last entry number
  let query: { organizationId?: string } | { ownerId: string };
  if (organizationId) {
    query = { organizationId: organizationId, type };
  } else {
    query = { ownerId: ownerId, type };
  }
  
  const lastEntry = await db.collection('financial_ledger').findOne(
    query,
    { 
      sort: { entryId: -1 },
      projection: { entryId: 1 }
    }
  );

  let sequence = 1;
  
  if (lastEntry?.entryId) {
    const match = lastEntry.entryId.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  const prefix = type === 'receivable' ? 'INV' : 'PAY';
  return `${prefix}-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') as LedgerEntryType;
    const status = searchParams.get('status') as LedgerEntryStatus;
    const currency = searchParams.get('currency');
    const counterparty = searchParams.get('counterparty');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const amountMin = searchParams.get('amountMin');
    const amountMax = searchParams.get('amountMax');

    const db = await connectToDatabase();
    const ledgerCollection = db.collection('financial_ledger');

    // Build query
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    let query: any = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    // Apply filters
    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (currency) {
      query.currency = currency;
    }

    if (counterparty) {
      query['counterparty.name'] = { $regex: counterparty, $options: 'i' };
    }

    if (category) {
      query.category = category;
    }

    if (priority) {
      query.priority = priority;
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (dateFrom) {
        dateFilter.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.$lte = new Date(dateTo + 'T23:59:59.999Z');
      }
      query.createdAt = dateFilter;
    }

    // Amount range filtering
    if (amountMin || amountMax) {
      const amountFilter: { $gte?: number; $lte?: number } = {};
      if (amountMin) {
        amountFilter.$gte = parseFloat(amountMin);
      }
      if (amountMax) {
        amountFilter.$lte = parseFloat(amountMax);
      }
      query.amount = amountFilter;
    }

    // Get total count
    const total = await ledgerCollection.countDocuments(query);

    // Calculate stats for all entries (not just filtered ones)
    const statsQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const allEntries = await ledgerCollection.find(statsQuery).toArray();
    
    const stats: LedgerStats = {
      totalReceivables: allEntries.filter(e => e.type === 'receivable').length,
      totalPayables: allEntries.filter(e => e.type === 'payable').length,
      netBalance: 0,
      pendingReceivables: allEntries.filter(e => e.type === 'receivable' && (e.status === 'pending' || e.status === 'sent')).length,
      pendingPayables: allEntries.filter(e => e.type === 'payable' && (e.status === 'pending' || e.status === 'approved')).length,
      overdueReceivables: allEntries.filter(e => e.type === 'receivable' && e.status !== 'paid' && new Date(e.dueDate) < new Date()).length,
      overduePayables: allEntries.filter(e => e.type === 'payable' && e.status !== 'paid' && new Date(e.dueDate) < new Date()).length,
      paidReceivables: allEntries.filter(e => e.type === 'receivable' && e.status === 'paid').length,
      paidPayables: allEntries.filter(e => e.type === 'payable' && e.status === 'paid').length,
      totalReceivablesAmount: allEntries.filter(e => e.type === 'receivable').reduce((sum, e) => sum + e.amount, 0),
      totalPayablesAmount: allEntries.filter(e => e.type === 'payable').reduce((sum, e) => sum + e.amount, 0),
      currency: 'USD' // Default currency, can be enhanced later
    };

    stats.netBalance = stats.totalReceivablesAmount - stats.totalPayablesAmount;

    // Get entries with pagination
    const skip = (page - 1) * limit;
    const entries = await ledgerCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const pagination: LedgerPagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    return NextResponse.json({
      success: true,
      data: {
        entries,
        pagination,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching ledger entries:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch ledger entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      counterparty,
      amount,
      currency,
      subtotal,
      totalTax,
      items,
      paymentDetails,
      issueDate,
      dueDate,
      status,
      priority,
      category,
      notes,
      memo,
      relatedInvoiceId,
      relatedPayableId,
      counterpartyId
    } = body;

    if (!type || !counterparty || !amount || !currency) {
      return NextResponse.json(
        { success: false, message: 'Type, counterparty, amount, and currency are required' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    // Check if approval is required
    let requiresApproval = false;
    let initialStatus = status || 'draft';

    if (isOrganization && ownerId) {
      requiresApproval = true;
      initialStatus = 'pending';
    }

    // Generate unique entry ID
    const entryId = await generateEntryId(
      db, 
      type, 
      session.user.organizationId || '', 
      ownerId || ''
    );

    console.log('💾 [API Ledger] Creating ledger entry:', {
      entryId,
      type,
      ownerType,
      ownerId,
      amount,
      requiresApproval,
      initialStatus
    });

    // Create ledger entry
    const ledgerEntry: FinancialLedgerEntry = {
      entryId,
      type,
      ownerId,
      ownerType,
      userId: session.user.email,
      organizationId: session.user.organizationId || undefined,
      issuerId: session.user.id || new ObjectId().toString(),
      relatedInvoiceId: relatedInvoiceId ? new ObjectId(relatedInvoiceId) : undefined,
      relatedPayableId: relatedPayableId ? new ObjectId(relatedPayableId) : undefined,
      counterpartyId: counterpartyId ? new ObjectId(counterpartyId) : undefined,
      counterparty,
      amount,
      currency,
      subtotal,
      totalTax,
      items: items || [],
      paymentDetails,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      status: initialStatus,
      priority: priority || 'medium',
      category: category || 'General',
      notes,
      memo,
      approvalWorkflow: requiresApproval ? {
        requiresApproval: true,
        submittedBy: session.user.id || new ObjectId().toString(),
        submittedAt: new Date()
      } : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('financial_ledger').insertOne(ledgerEntry);

    if (!result.insertedId) {
      throw new Error('Failed to insert ledger entry - no result returned');
    }
    
    console.log('✅ [API Ledger] Ledger entry created successfully');

    return NextResponse.json({
      success: true,
      message: 'Ledger entry created successfully',
      data: { _id: result.insertedId, ...ledgerEntry }
    });

  } catch (error) {
    console.error('❌ [API Ledger] Error creating ledger entry:', error);
    
    let errorMessage = 'Failed to create ledger entry';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
