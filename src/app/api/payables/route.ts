import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';
import { CurrencyService } from '@/lib/services/currencyService';

// Secure payable number generation function
const generateSecurePayableNumber = async (db: Record<string, unknown>, organizationId: string, ownerId: string, excludeNumber?: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Create a short, secure identifier from organization/user ID
  let secureId: string;
  if (organizationId) {
    // For organizations, use last 4 chars of org ID
    secureId = organizationId.slice(-4);
  } else {
    // For individual users, create a unique identifier from email
    const emailParts = ownerId.split('@');
    const username = emailParts[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const domain = emailParts[1]?.replace(/[^a-zA-Z0-9]/g, '').slice(-2) || 'XX';
    secureId = `${username}${domain}`.toUpperCase();
  }
  
  // Query for the last payable number for this organization/user
  let query: { organizationId?: string } | { ownerId: string };
  if (organizationId) {
    query = { organizationId: organizationId };
  } else {
    query = { ownerId: ownerId };
  }
  
  const lastPayable = await (db as { collection: (name: string) => { findOne: (query: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Record<string, unknown> | null> } }).collection('payables').findOne(
    query,
    { 
      sort: { payableNumber: -1 },
      projection: { payableNumber: 1 }
    }
  );

  let sequence = 1;
  
  if (lastPayable?.payableNumber) {
    // Extract sequence from existing payable number
    const match = (lastPayable.payableNumber as string).match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  // Generate the payable number
  let payableNumber = `PAY-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  
  // If we need to exclude a specific number, check if it matches and increment if needed
  if (excludeNumber && payableNumber === excludeNumber) {
    sequence++;
    payableNumber = `PAY-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Double-check that the generated number doesn't exist
  const existingPayable = await (db as { collection: (name: string) => { findOne: (query: Record<string, unknown>) => Promise<Record<string, unknown> | null> } }).collection('payables').findOne(
    { payableNumber: payableNumber }
  );
  
  if (existingPayable) {
    // If it exists, find all payables for this month and get the highest sequence
    const allPayables = await (db as { collection: (name: string) => { find: (query: Record<string, unknown>) => { toArray: () => Promise<Record<string, unknown>[]> } } }).collection('payables').find(
      { 
        payableNumber: { $regex: `^PAY-${secureId}-${currentYear}${currentMonth}-` }
      }
    ).toArray();
    
    // Get all sequences and find the highest one
    const usedSequences = allPayables.map(pay => {
      const match = (pay.payableNumber as string).match(/-(\d{4})$/);
      return match ? parseInt(match[1]) : 0;
    });
    
    // Find the highest sequence and increment by 1
    const highestSequence = Math.max(...usedSequences, 0);
    sequence = highestSequence + 1;
    
    payableNumber = `PAY-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  }

  return payableNumber;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      payableNumber,
      issueDate,
      dueDate,
      companyLogo,
      companyName,
      companyAddress,
      companyTaxNumber,
      vendorName,
      vendorCompany,
      vendorEmail,
      vendorAddress,
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      payableType,
      items,
      subtotal,
      totalTax,
      total,
      memo,
      status,
      category,
      priority,
      createdAt,
      updatedAt,
      companyEmail,
      companyPhone,
      vendorPhone
    } = body;

    const db = await connectToDatabase();

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    // Check if approval is required
    let requiresApproval = false;
    let initialStatus = status || 'draft';

    if (isOrganization && ownerId) {
      // Non-admin users need approval for payables
      requiresApproval = true;
      initialStatus = 'pending_approval';
    }

    // Generate secure payable number if not provided
    let finalPayableNumber = payableNumber;
    
    if (finalPayableNumber) {
      // Check if the provided payable number already exists
      const existingPayable = await (db as { collection: (name: string) => { findOne: (query: Record<string, unknown>) => Promise<Record<string, unknown> | null> } }).collection('payables').findOne(
        { payableNumber: finalPayableNumber }
      );
      
      if (existingPayable) {
        console.log('⚠️ [API Payables] Provided payable number already exists, generating new one:', finalPayableNumber);
        finalPayableNumber = await generateSecurePayableNumber(
          db as unknown as Record<string, unknown>, 
          session.user.organizationId || '', 
          ownerId || ''
        );
      }
    } else {
      // No payable number provided, generate a new one
      finalPayableNumber = await generateSecurePayableNumber(
        db as unknown as Record<string, unknown>, 
        session.user.organizationId || '', 
        ownerId || ''
      );
    }

    console.log('💾 [API Payables] Saving payable:', {
      payableNumber: finalPayableNumber,
      ownerType,
      ownerId,
      total,
      requiresApproval,
      initialStatus
    });

    // Transform data to match PayableFormData structure
    const payableData = {
      // Basic payable info
      payableNumber: finalPayableNumber,
      payableName: `Payable ${finalPayableNumber}`,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      
      // Owner information
      ownerId,
      ownerType,
      userId: session.user.email,
      organizationId: session.user.organizationId || null,
      issuerId: session.user.id || new ObjectId(),
      
      // Company information
      companyLogo: companyLogo,
      companyName: companyName,
      companyEmail: companyEmail,
      companyPhone: companyPhone,
      companyAddress: {
        street: companyAddress?.street || '',
        city: companyAddress?.city || '',
        state: companyAddress?.state || '',
        zipCode: companyAddress?.zipCode || '',
        country: companyAddress?.country || ''
      },
      companyTaxNumber: companyTaxNumber,
      
      // Vendor information
      vendorName: vendorName,
      vendorCompany: vendorCompany,
      vendorEmail: vendorEmail,
      vendorPhone: vendorPhone,
      vendorAddress: {
        street: vendorAddress?.street || '',
        city: vendorAddress?.city || '',
        state: vendorAddress?.state || '',
        zipCode: vendorAddress?.zipCode || '',
        country: vendorAddress?.country || ''
      },
      
      // Payment information
      currency: currency,
      paymentMethod: paymentMethod,
      paymentNetwork: paymentNetwork,
      paymentAddress: paymentAddress,
      bankName: bankName,
      accountNumber: accountNumber,
      routingNumber: routingNumber,
      enableMultiCurrency: enableMultiCurrency,
      
      // Payable details
      payableType: payableType || 'regular',
      category: category || 'General',
      priority: priority || 'medium',
      items: items.map((item: { id?: string; description: string; quantity: number; unitPrice: number; amount: number; tax: number; discount?: number }) => ({
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        amount: item.amount
      })),
      subtotal: subtotal,
      totalTax: totalTax,
      total: total,
      memo: memo,
      
      // Status and metadata
      status: initialStatus,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
      updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      
      // Approval workflow
      approvalWorkflow: requiresApproval ? {
        requiresApproval: true,
        submittedBy: session.user.id,
        submittedAt: new Date()
      } : undefined
    };

    // Insert payable
    let result: { insertedId: ObjectId } | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    let currentPayableNumber = finalPayableNumber;
    
    while (attempts < maxAttempts) {
      try {
        result = await db.collection('payables').insertOne(payableData);
        break;
      } catch (error: unknown) {
        attempts++;
        
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
          // Duplicate key error - generate a new payable number and try again
          const newPayableNumber = await generateSecurePayableNumber(
            db as unknown as Record<string, unknown>, 
            session.user.organizationId || '', 
            ownerId || '',
            currentPayableNumber
          );
          
          currentPayableNumber = newPayableNumber;
          payableData.payableNumber = newPayableNumber;
          payableData.payableName = `Payable ${newPayableNumber}`;
          
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique payable number after multiple attempts');
          }
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error('Failed to insert payable - no result returned');
    }
    
    console.log('✅ [API Payables] Payable saved successfully');

    // Sync to financial ledger
    try {
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
      console.log('✅ [API Payables] Payable synced to ledger');
    } catch (syncError) {
      console.error('⚠️ [API Payables] Failed to sync payable to ledger:', syncError);
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      message: 'Payable saved successfully',
      payable: { _id: result.insertedId, ...payableData }
    });

  } catch (error) {
    console.error('❌ [API Payables] Error saving payable:', error);
    
    let errorMessage = 'Failed to save payable';
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const convertToPreferred = searchParams.get('convertToPreferred') === 'true';

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Get user's preferred currency
    const userPreferences = await CurrencyService.getUserPreferredCurrency(session.user.email);
    const preferredCurrency = userPreferences.preferredCurrency;
    
    // Currency preferences loaded

    // Build query
    const isOrganization = !!(session.user.organizationId && session.user.organizationId !== session.user.id);
    
    // Handle both MongoDB ObjectIds and OAuth IDs
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(session.user.id);
    const issuerIdQuery = isObjectId 
      ? { issuerId: new ObjectId(session.user.id) }
      : { issuerId: session.user.id };
    
    // Query details prepared
    
    let query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };

    // Query built successfully

    if (status) {
      query = { ...query, status } as typeof query & { status: string };
    }

    if (category) {
      query = { ...query, category } as typeof query & { category: string };
    }

    if (priority) {
      query = { ...query, priority } as typeof query & { priority: string };
    }

    // Add date range filtering
    if (dateFrom || dateTo) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (dateFrom) {
        dateFilter.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.$lte = new Date(dateTo + 'T23:59:59.999Z');
      }
      query = { ...query, createdAt: dateFilter } as typeof query & { createdAt: { $gte?: Date; $lte?: Date } };
    }

    // Get total count
    const total = await payablesCollection.countDocuments(query);

    // Get status counts for all payables
    const statusCounts = await Promise.all([
      payablesCollection.countDocuments({ ...query, status: 'draft' }),
      payablesCollection.countDocuments({ ...query, status: 'pending' }),
      payablesCollection.countDocuments({ ...query, status: 'approved' }),
      payablesCollection.countDocuments({ ...query, status: 'paid' }),
      payablesCollection.countDocuments({ ...query, status: 'overdue' })
    ]);

    const [draftCount, pendingCount, approvedCount, paidCount, overdueCount] = statusCounts;

    // Get payables with pagination
    const skip = (page - 1) * limit;
    let payables = await payablesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Payables fetched successfully

    // Convert currencies if requested
    if (convertToPreferred) {
      const convertedPayables = await Promise.all(
        payables.map(payable => 
          CurrencyService.convertPayableForReporting(payable as { [key: string]: unknown }, preferredCurrency)
        )
      );
      payables = convertedPayables as typeof payables;
    }

    // Calculate total amount for all payables
    const totalQuery = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            issuerIdQuery,
            { userId: session.user.email }
          ]
        };
    const allPayables = await payablesCollection.find(totalQuery).toArray();
    
    let totalAmount = allPayables.reduce((sum, payable) => sum + (payable.total || 0), 0);
    
    // Convert total amount if currency conversion is requested
    if (convertToPreferred && allPayables.length > 0) {
      // Get the first payable's currency as reference (assuming all have same currency for now)
      const referenceCurrency = allPayables[0]?.currency || 'USD';
      if (referenceCurrency !== preferredCurrency) {
        const convertedTotal = await CurrencyService.convertCurrency(totalAmount, referenceCurrency, preferredCurrency);
        totalAmount = convertedTotal;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        payables,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: {
          totalAmount,
          totalPayables: total,
          statusCounts: {
            draft: draftCount,
            pending: pendingCount,
            approved: approvedCount,
            paid: paidCount,
            overdue: overdueCount
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching payables:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch payables' },
      { status: 500 }
    );
  }
}
