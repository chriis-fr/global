import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId, Db } from 'mongodb';
import { UserService } from '@/lib/services/userService';
import { sendInvoiceNotification } from '@/lib/services/emailService';

// Generate CC invoice number based on primary invoice
const generateCcInvoiceNumber = async (db: Db, primaryInvoiceNumber: string, index: number, organizationId: string, ownerId: string): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Create a short, secure identifier from organization/user ID
  let secureId: string;
  if (organizationId) {
    // For organizations, use last 4 chars of org ID
    secureId = organizationId.slice(-4);
  } else {
    // For individual users, create a unique identifier from email
    // Take first 4 chars of username + first 2 chars of domain (more readable)
    const emailParts = ownerId.split('@');
    const username = emailParts[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const domain = emailParts[1]?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'XX';
    secureId = `${username}${domain}`.toUpperCase();
  }
  
  // Query for the last invoice number for this organization/user (including both regular and CC invoices)
  const lastInvoice = await db.collection('invoices').findOne(
    { 
      $or: [
        { organizationId: organizationId || null },
        { ownerId: ownerId }
      ]
    },
    { 
      sort: { invoiceNumber: -1 },
      projection: { invoiceNumber: 1 }
    }
  );

  let sequence = 1;
  
  if (lastInvoice?.invoiceNumber) {
    // Extract sequence from existing invoice number
    const match = lastInvoice.invoiceNumber.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  // Generate the invoice number
  const generatedNumber = `INV-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
  
  // Check if this number already exists and increment if necessary
  let finalNumber = generatedNumber;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const existingInvoice = await db.collection('invoices').findOne(
      { invoiceNumber: finalNumber }
    );
    
    if (!existingInvoice) {
      break; // Number is unique, use it
    }
    
    // Number exists, increment sequence and try again
    sequence++;
    finalNumber = `INV-${secureId}-${currentYear}${currentMonth}-${String(sequence).padStart(4, '0')}`;
    attempts++;
  }
  
  return finalNumber;
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
    const ownerId = isOrganization ? (session.user.organizationId ?? '') : (session.user.email ?? '');
    const ownerType = isOrganization ? 'organization' : 'individual';

    const db = await connectToDatabase();
    const ccInvoices = [];

    // Create CC invoices for each recipient
    for (let i = 0; i < ccClients.length; i++) {
      const ccClient = ccClients[i];
      const organizationId = session.user.organizationId ?? '';
      const ccInvoiceNumber = await generateCcInvoiceNumber(db, primaryInvoiceNumber, i, organizationId, ownerId);

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
        
        // Ensure amounts are properly copied
        subtotal: invoiceData.subtotal,
        totalTax: invoiceData.totalTax,
        total: invoiceData.total,
        totalAmount: invoiceData.total, // Ensure totalAmount is set
        
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

      // Send email to CC recipient
      try {
        const greetingName = ccClient.company ? ccClient.name : (ccClient.name || 'Client');
        const recipientName = ccClient.company || ccClient.name || 'Client';
        
        const emailResult = await sendInvoiceNotification(
          ccClient.email,
          greetingName,
          ccInvoiceNumber,
          invoiceData.total,
          invoiceData.currency,
          invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A',
          invoiceData.companyName || 'Chains ERP-Global',
          recipientName,
          `${(process.env.FRONTEND_URL?.startsWith('http') ? process.env.FRONTEND_URL : `https://${process.env.FRONTEND_URL}`) || 'http://localhost:3000'}/invoice/${ccInvoiceNumber}`,
          [invoiceData.paymentMethod === 'crypto' ? 'Cryptocurrency' : 'Bank Transfer'],
          undefined, // No PDF attachment for CC emails
          [] // No additional attachments
        );

        if (emailResult.success) {
          console.log('✅ [API CC Invoices] Email sent to CC recipient:', ccClient.email);
        } else {
          console.error('❌ [API CC Invoices] Failed to send email to CC recipient:', ccClient.email);
        }
      } catch {
        console.error('❌ [API CC Invoices] Error sending email to CC recipient:', ccClient.email);
      }
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