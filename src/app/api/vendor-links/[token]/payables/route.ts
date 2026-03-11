import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { PayableEvent } from '@/models/PayableEvent';

// Public endpoint: vendor submits an invoice using their reusable link token.
// URL pattern: /api/vendor-links/[token]/payables

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing vendor token' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const vendors = db.collection('vendors');
    const payables = db.collection('payables');
    const events = db.collection<PayableEvent>('payable_events');

    // Look up vendor by paymentLinkToken and ensure it's active
    const vendor = await vendors.findOne({
      paymentLinkToken: token,
      status: { $ne: 'disabled' },
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive vendor link' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      invoiceNumber,
      description,
      amount,
      currency,
      dueDate,
      lineItems,
      invoiceFileUrl,
      note,
    } = body;

    if (!invoiceNumber || !amount || !currency || !dueDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            'invoiceNumber, amount, currency and dueDate are required for vendor submissions.',
        },
        { status: 400 }
      );
    }

    const organizationId =
      (vendor.organizationId as ObjectId | undefined) || undefined;
    const ownerId = organizationId
      ? organizationId.toString()
      : (vendor.userId as string | undefined);

    if (!ownerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vendor is not linked to an owner account.',
        },
        { status: 400 }
      );
    }

    // Prevent duplicate invoiceNumber per vendor
    const existing = await payables.findOne({
      vendorId: vendor._id,
      externalInvoiceNumber: invoiceNumber,
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            'An invoice with this number has already been submitted for this vendor.',
        },
        { status: 409 }
      );
    }

    const now = new Date();

    // Minimal payable payload compatible with existing structure
    const payableDoc: Record<string, unknown> = {
      payableNumber: undefined, // will be filled by internal flows if needed
      payableName: description || `Invoice ${invoiceNumber}`,
      issueDate: now,
      dueDate: new Date(dueDate),

      ownerId,
      ownerType: organizationId ? 'organization' : 'individual',
      organizationId: organizationId ?? null,

      vendorId: vendor._id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      vendorPhone: vendor.phone,
      vendorAddress: vendor.address,

      currency,
      items:
        Array.isArray(lineItems) && lineItems.length > 0
          ? lineItems
          : [
              {
                id: `item-${Date.now()}`,
                description: description || `Invoice ${invoiceNumber}`,
                quantity: 1,
                unitPrice: amount,
                tax: 0,
                discount: 0,
                amount,
              },
            ],
      subtotal: amount,
      totalTax: 0,
      total: amount,
      memo: note || '',

      externalInvoiceNumber: invoiceNumber,
      invoiceFileUrl: invoiceFileUrl || null,

      status: 'submitted',
      paymentStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await payables.insertOne(payableDoc);
    const payableId = insertResult.insertedId;

    // Create PayableEvent: invoice_submitted
    const event: PayableEvent = {
      payableId,
      organizationId: organizationId,
      vendorId: vendor._id as ObjectId,
      eventType: 'invoice_submitted',
      metadata: {
        invoiceNumber,
        amount,
        currency,
        description,
      },
      createdAt: now,
    };

    await events.insertOne(event);

    return NextResponse.json(
      {
        success: true,
        data: {
          payableId: payableId.toString(),
          vendorName: vendor.name,
          status: 'submitted',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Vendor Payable Submit] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit vendor invoice' },
      { status: 500 }
    );
  }
}

