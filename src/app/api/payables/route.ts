import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LedgerSyncService } from '@/lib/services/ledgerSyncService';

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

    // Check if approval is required (only when org has Accounts Payable - sync with organization settings)
    let requiresApproval = false;
    let initialStatus = status || 'draft';

    if (isOrganization && ownerId) {
      const organization = await db.collection('organizations').findOne({
        _id: new ObjectId(ownerId)
      });
      const orgServices = organization?.services as { accountsPayable?: boolean } | undefined;
      const hasAccountsPayable = orgServices?.accountsPayable === true;
      const requireApprovalSetting = organization?.approvalSettings?.requireApproval === true;
      if (hasAccountsPayable && requireApprovalSetting) {
        requiresApproval = true;
        initialStatus = 'pending_approval';
      }
    }

    // Generate secure payable number if not provided
    let finalPayableNumber = payableNumber;
    
    if (finalPayableNumber) {
      // Check if the provided payable number already exists
      const existingPayable = await (db as { collection: (name: string) => { findOne: (query: Record<string, unknown>) => Promise<Record<string, unknown> | null> } }).collection('payables').findOne(
        { payableNumber: finalPayableNumber }
      );
      
      if (existingPayable) {
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
    

    // Sync to financial ledger
    try {
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
    } catch {
      // Don't fail the request if sync fails
    }

    return NextResponse.json({
      success: true,
      message: 'Payable saved successfully',
      payable: { _id: result.insertedId, ...payableData }
    });

  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to save payable' },
      { status: 500 }
    );
  }
}

