import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { UserService } from '@/lib/services/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token is required' },
        { status: 400 }
      );
    }


    const db = await connectToDatabase();
    const accessTokensCollection = db.collection('invoice_access_tokens');
    const invoicesCollection = db.collection('invoices');

    // Find and validate token
    const tokenData = await accessTokensCollection.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenData) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Get invoice details
    const invoice = await invoicesCollection.findOne({
      _id: tokenData.invoiceId
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if recipient email is registered
    let isRegistered = false;
    let user = null;

    try {
      user = await UserService.getUserByEmail(tokenData.recipientEmail);
      isRegistered = !!user;
    } catch {
      // User not found, isRegistered remains false
    }

    const paymentSettings = invoice.paymentSettings as { method?: string; currency?: string; chainId?: number; tokenAddress?: string; walletAddress?: string; cryptoNetwork?: string; bankAccount?: { bankName?: string; accountNumber?: string; routingNumber?: string; swiftCode?: string; bankCode?: string } } | undefined;
    const inv = invoice as { routingNumber?: string; swiftCode?: string; bankCode?: string };
    const routingNumber = inv.routingNumber ?? paymentSettings?.bankAccount?.routingNumber ?? inv.swiftCode ?? inv.bankCode ?? paymentSettings?.bankAccount?.swiftCode ?? paymentSettings?.bankAccount?.bankCode;
    const totalAmount = invoice.total ?? invoice.totalAmount ?? 0;

    const companyDetails = invoice.companyDetails as { address?: unknown; addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string; name?: string; email?: string; phone?: string; taxNumber?: string } | undefined;
    const companyAddress = invoice.companyAddress as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | undefined;
    const companyAddressResolved = companyDetails?.address ?? companyAddress ?? (companyDetails && (companyDetails.addressLine1 || companyDetails.city || companyDetails.country)
      ? { street: companyDetails.addressLine1, city: companyDetails.city, state: companyDetails.region, zipCode: companyDetails.postalCode, country: companyDetails.country }
      : undefined);

    return NextResponse.json({
      success: true,
      data: {
        token,
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceName: invoice.invoiceName,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          companyDetails: {
            name: companyDetails?.name || invoice.companyName,
            email: companyDetails?.email || invoice.companyEmail,
            phone: companyDetails?.phone || invoice.companyPhone,
            address: companyAddressResolved,
            logo: (invoice as { companyLogo?: string }).companyLogo,
            taxNumber: companyDetails?.taxNumber || (invoice as { companyTaxNumber?: string }).companyTaxNumber
          },
          clientDetails: {
            name: invoice.clientDetails?.name || invoice.clientName,
            email: invoice.clientDetails?.email || invoice.clientEmail,
            phone: invoice.clientDetails?.phone || invoice.clientPhone,
            companyName: invoice.clientDetails?.companyName || invoice.clientCompany,
            address: invoice.clientDetails?.address || invoice.clientAddress
          },
          currency: invoice.currency,
          paymentMethod: invoice.paymentMethod,
          paymentNetwork: invoice.paymentNetwork ?? paymentSettings?.cryptoNetwork,
          paymentAddress: invoice.paymentAddress ?? paymentSettings?.walletAddress ?? invoice.payeeAddress,
          payeeAddress: invoice.payeeAddress ?? invoice.paymentAddress ?? paymentSettings?.walletAddress,
          bankName: invoice.bankName ?? paymentSettings?.bankAccount?.bankName,
          accountNumber: invoice.accountNumber ?? paymentSettings?.bankAccount?.accountNumber,
          routingNumber,
          chainId: (invoice as { chainId?: number }).chainId ?? paymentSettings?.chainId,
          txHash: (invoice as { txHash?: string }).txHash,
          tokenAddress: (invoice as { tokenAddress?: string }).tokenAddress ?? paymentSettings?.tokenAddress,
          paymentSettings: paymentSettings ?? undefined,
          items: invoice.items || [],
          subtotal: invoice.subtotal || 0,
          totalTax: invoice.totalTax || 0,
          totalAmount,
          total: totalAmount,
          withholdingTaxAmount: (invoice as { withholdingTaxAmount?: number }).withholdingTaxAmount,
          withholdingTaxRatePercent: (invoice as { withholdingTaxRatePercent?: number }).withholdingTaxRatePercent,
          memo: invoice.memo,
          status: invoice.status,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
          paidAt: (invoice as { paidAt?: string }).paidAt
        },
        recipientEmail: tokenData.recipientEmail,
        isRegistered,
        requiresSignup: !isRegistered
      }
    });

  } catch {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to validate token',
        error: 'Unknown error'
      },
      { status: 500 }
    );
  }
}
