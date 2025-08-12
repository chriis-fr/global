import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { UserService } from '@/lib/services/userService';

// Generate CC invoice number based on primary invoice
const generateCcInvoiceNumber = (primaryInvoiceNumber: string, index: number): string => {
  return `${primaryInvoiceNumber}-CC${String(index + 1).padStart(3, '0')}`;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      primaryInvoiceId,
      primaryInvoiceNumber,
      ccClients,
      invoiceData
    } = body;

    if (!primaryInvoiceId || !primaryInvoiceNumber || !ccClients || !Array.isArray(ccClients)) {
      return NextResponse.json({ success: false, message: 'Invalid request data' }, { status: 400 });
    }

    await connectToDatabase();

    // Get user details
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    const db = await connectToDatabase();
    const ccInvoices = [];

    // Create CC invoices for each recipient
    for (let i = 0; i < ccClients.length; i++) {
      const ccClient = ccClients[i];
      const ccInvoiceNumber = generateCcInvoiceNumber(primaryInvoiceNumber, i);

      const ccInvoiceData = {
        ...invoiceData,
        invoiceNumber: ccInvoiceNumber,
        invoiceName: `${invoiceData.invoiceName} (CC ${i + 1})`,
        
        // Update client information for CC recipient
        clientName: ccClient.name,
        clientCompany: ccClient.company,
        clientEmail: ccClient.email,
        clientPhone: ccClient.phone,
        
        // Link to primary invoice
        primaryInvoiceId: new ObjectId(primaryInvoiceId),
        isCcInvoice: true,
        ccIndex: i,
        
        // Owner information
        ownerId,
        ownerType,
        userId: session.user.email,
        organizationId: session.user.organizationId || null,
        issuerId: session.user.id || new ObjectId(),
        
        // Status and metadata
        status: 'sent',
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Update client details
        clientDetails: {
          ...invoiceData.clientDetails,
          email: ccClient.email,
          companyName: ccClient.company || ccClient.name,
        }
      };

      const result = await db.collection('invoices').insertOne(ccInvoiceData);
      ccInvoices.push({
        _id: result.insertedId,
        invoiceNumber: ccInvoiceNumber,
        clientEmail: ccClient.email,
        clientName: ccClient.name
      });

      console.log('✅ [API CC Invoices] Created CC invoice:', {
        id: result.insertedId,
        invoiceNumber: ccInvoiceNumber,
        clientEmail: ccClient.email
      });
    }

    // Update primary invoice to mark it as having CC recipients
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(primaryInvoiceId) },
      { 
        $set: { 
          hasCcRecipients: true,
          ccRecipientCount: ccClients.length,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ [API CC Invoices] Created CC invoices successfully:', {
      primaryInvoiceId,
      ccInvoicesCount: ccInvoices.length,
      ccInvoices: ccInvoices.map(inv => inv.invoiceNumber)
    });

    return NextResponse.json({
      success: true,
      message: 'CC invoices created successfully',
      ccInvoices
    });

  } catch (error) {
    console.error('❌ [API CC Invoices] Error creating CC invoices:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create CC invoices' },
      { status: 500 }
    );
  }
} 