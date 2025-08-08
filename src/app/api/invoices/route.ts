import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { UserService } from '@/lib/services/userService';
import { OrganizationService } from '@/lib/services/organizationService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoiceNumber,
      issueDate,
      dueDate,
      companyLogo,
      companyName,
      companyAddress,
      companyTaxNumber,
      clientName,
      clientEmail,
      clientAddress,
      currency,
      paymentMethod,
      paymentNetwork,
      paymentAddress,
      bankName,
      accountNumber,
      routingNumber,
      enableMultiCurrency,
      invoiceType,
      items,
      subtotal,
      totalTax,
      total,
      memo,
      status,
      createdAt,
      updatedAt,
      invoiceName,
      companyEmail,
      companyPhone,
      clientPhone
    } = body;

    await connectToDatabase();

    // Get user details for approval workflow
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    // Check if approval is required
    let requiresApproval = false;
    let initialStatus = status || 'pending';

    if (isOrganization && user.organizationId) {
      // Check if user is admin/owner
      const isAdmin = await OrganizationService.isUserAdmin(
        user.organizationId.toString(), 
        user._id!.toString()
      );
      
      if (!isAdmin) {
        // Non-admin users need approval
        requiresApproval = true;
        initialStatus = 'pending_approval';
      }
    }

    console.log('💾 [API Invoices] Saving invoice:', {
      invoiceNumber,
      ownerType,
      ownerId,
      total,
      requiresApproval,
      initialStatus
    });

    // Transform data to match InvoiceFormData structure exactly
    const invoiceData = {
      // Basic invoice info
      invoiceNumber: invoiceNumber || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceName: invoiceName || `Invoice ${invoiceNumber || 'Document'}`,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      
      // Owner information
      ownerId, // Dynamic owner ID (email for individual, organizationId for org)
      ownerType, // 'individual' or 'organization'
      userId: session.user.email, // Keep for backward compatibility
      organizationId: session.user.organizationId || null, // Don't assign random ObjectId for individuals
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
      
      // Client information
      clientName: clientName,
      clientEmail: clientEmail,
      clientPhone: clientPhone,
      clientAddress: {
        street: clientAddress?.street || '',
        city: clientAddress?.city || '',
        state: clientAddress?.state || '',
        zipCode: clientAddress?.zipCode || '',
        country: clientAddress?.country || ''
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
      
      // Invoice details
      invoiceType: invoiceType || 'regular',
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
        submittedBy: user._id,
        submittedAt: new Date()
      } : undefined,
      
      // Backward compatibility - keep nested structure for existing code
      type: invoiceType || 'regular',
      companyDetails: {
        name: companyName,
        firstName: '',
        lastName: '',
        country: companyAddress?.country || '',
        region: companyAddress?.state || '',
        city: companyAddress?.city || '',
        postalCode: companyAddress?.zipCode || '',
        addressLine1: companyAddress?.street || '',
        addressLine2: '',
        taxNumber: companyTaxNumber,
        logo: companyLogo
      },
      clientDetails: {
        email: clientEmail,
        companyName: clientName,
        firstName: '',
        lastName: '',
        country: clientAddress?.country || '',
        region: clientAddress?.state || '',
        city: clientAddress?.city || '',
        postalCode: clientAddress?.zipCode || '',
        addressLine1: clientAddress?.street || '',
        addressLine2: '',
        taxNumber: ''
      },
      taxes: [{
        name: 'Tax',
        rate: totalTax / subtotal,
        amount: totalTax
      }],
      totalAmount: total,
      paymentSettings: {
        method: paymentMethod,
        currency,
        enableMultiCurrency,
        cryptoNetwork: paymentNetwork,
        walletAddress: paymentAddress,
        bankAccount: bankName ? {
          accountNumber: accountNumber || '',
          routingNumber: routingNumber || '',
          bankName,
          accountType: 'checking'
        } : undefined
      },
      notes: memo,
      pdfUrl: '',
      isTemplate: false
    };

    // Use MongoDB directly since the model structure is complex
    const db = await connectToDatabase();
    const result = await db.collection('invoices').insertOne(invoiceData);

    console.log('✅ [API Invoices] Invoice saved successfully:', {
      id: result.insertedId,
      invoiceNumber: invoiceData.invoiceNumber,
      ownerType,
      ownerId
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      invoice: { _id: result.insertedId, ...invoiceData }
    });

  } catch (error) {
    console.error('❌ [API Invoices] Error saving invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save invoice' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Determine if user is individual or organization
    const isOrganization = session.user.organizationId && session.user.organizationId !== session.user.id;
    const ownerId = isOrganization ? session.user.organizationId : session.user.email;
    const ownerType = isOrganization ? 'organization' : 'individual';

    console.log('📊 [API Invoices] Fetching invoices for:', {
      ownerType,
      ownerId,
      userEmail: session.user.email
    });

    const db = await connectToDatabase();

    // Query invoices based on owner type
    const query = isOrganization 
      ? { organizationId: session.user.organizationId }
      : { 
          $or: [
            { issuerId: session.user.id },
            { userId: session.user.email }
          ]
        };

    const invoices = await db.collection('invoices')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    console.log('✅ [API Invoices] Found invoices:', {
      count: invoices.length,
      ownerType,
      ownerId,
      query: JSON.stringify(query)
    });

    // Log first few invoices for debugging
    if (invoices.length > 0) {
      console.log('📋 [API Invoices] Sample invoices:', invoices.slice(0, 3).map(inv => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        issuerId: inv.issuerId,
        userId: inv.userId,
        organizationId: inv.organizationId,
        total: inv.total
      })));
    }

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices,
        pagination: {
          page: 1,
          limit: 50,
          total: invoices.length,
          pages: 1
        }
      }
    });

  } catch (error) {
    console.error('❌ [API Invoices] Error fetching invoices:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
} 