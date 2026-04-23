import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { PayableEvent } from '@/models/PayableEvent';

// Generate short sequential payable number (same format as main payables API)
async function generateSecurePayableNumber(
  db: { collection: (name: string) => { findOne: (q: Record<string, unknown>, o?: Record<string, unknown>) => Promise<Record<string, unknown> | null>; find: (q: Record<string, unknown>) => { toArray: () => Promise<Record<string, unknown>[]> } } },
  organizationId: string | null,
  ownerId: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth(); // 0-based
  const startOfMonth = new Date(currentYear, currentMonthIndex, 1);
  const startOfNextMonth = new Date(currentYear, currentMonthIndex + 1, 1);
  let secureId: string;
  if (organizationId) {
    secureId = organizationId.slice(-4);
  } else {
    const emailParts = ownerId.split('@');
    const username = emailParts[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    const domain = emailParts[1]?.replace(/[^a-zA-Z0-9]/g, '').slice(-2) || 'XX';
    secureId = `${username}${domain}`.toUpperCase();
  }
  const query = organizationId ? { organizationId } : { ownerId };
  const lastPayable = await db.collection('payables').findOne(
    { ...query, createdAt: { $gte: startOfMonth, $lt: startOfNextMonth } },
    {
      sort: { createdAt: -1 },
      projection: { payableNumber: 1 },
    }
  );
  let sequence = 1;
  if (lastPayable?.payableNumber) {
    const match = (lastPayable.payableNumber as string).match(/-(\d{4})$/);
    if (match) sequence = parseInt(match[1], 10) + 1;
  }
  let payableNumber = `PAY-${secureId}-${String(sequence).padStart(4, '0')}`;
  const existingPayable = await db.collection('payables').findOne({ payableNumber });
  if (existingPayable) {
    const allPayables = await db
      .collection('payables')
      .find({
        ...query,
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
        payableNumber: { $regex: `^PAY-${secureId}-` },
      })
      .toArray();
    const usedSequences = allPayables.map((p) => {
      const m = (p.payableNumber as string).match(/-(\d{4})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    sequence = Math.max(...usedSequences, 0) + 1;
    payableNumber = `PAY-${secureId}-${String(sequence).padStart(4, '0')}`;
  }
  return payableNumber;
}

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
    const users = db.collection('users');

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
      vendorPaymentDetails,
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

    const vendorOrgRaw = vendor.organizationId as string | ObjectId | undefined;
    const vendorOwnerEmail = vendor.userId as string | undefined;

    let organizationIdString =
      typeof vendorOrgRaw === 'string'
        ? vendorOrgRaw
        : vendorOrgRaw
        ? vendorOrgRaw.toString()
        : undefined;

    // Legacy safety: if vendor lacks organizationId, recover it from owner user record.
    if (!organizationIdString && vendorOwnerEmail) {
      const ownerUser = await users.findOne(
        { email: vendorOwnerEmail },
        { projection: { organizationId: 1 } }
      );
      const ownerOrg = ownerUser?.organizationId as string | ObjectId | undefined;
      if (ownerOrg) {
        organizationIdString =
          typeof ownerOrg === 'string' ? ownerOrg : ownerOrg.toString();
      }
    }

    const organizationId =
      organizationIdString && ObjectId.isValid(organizationIdString)
        ? new ObjectId(organizationIdString)
        : undefined;
    const ownerId = organizationIdString || vendorOwnerEmail;

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

    const normalizedItems =
      Array.isArray(lineItems) && lineItems.length > 0
        ? lineItems.map((item: { description?: string; quantity?: number; unitPrice?: number; tax?: number; discount?: number; amount?: number }) => {
            const qty = Number(item.quantity) || 0;
            const unit = Number(item.unitPrice) || 0;
            const taxRate = Number(item.tax) || 0;
            const discountRate = Number(item.discount) || 0;
            const lineSubtotal = qty * unit;
            const taxAmount = (lineSubtotal * taxRate) / 100;
            const discountAmount = (lineSubtotal * discountRate) / 100;
            const lineTotal = lineSubtotal + taxAmount - discountAmount;
            return {
              id: (item as { id?: string }).id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              description: item.description || 'Item',
              quantity: qty,
              unitPrice: unit,
              tax: taxRate,
              discount: discountRate,
              amount: Math.round(lineTotal * 100) / 100,
            };
          })
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
          ];

    const subtotal = normalizedItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number }) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    const totalTax = normalizedItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number; tax?: number }) => {
      const lineSub = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + (lineSub * (item.tax || 0)) / 100;
    }, 0);
    const total = normalizedItems.reduce((sum: number, item: { amount?: number }) => sum + (Number(item.amount) || 0), 0);

    const payableNumber = await generateSecurePayableNumber(
      db,
      organizationIdString ?? null,
      ownerId
    );

    const payableDoc: Record<string, unknown> = {
      payableNumber,
      payableName: description || `Invoice ${invoiceNumber}`,
      issueDate: now,
      dueDate: new Date(dueDate),

      ownerId,
      ownerType: organizationIdString ? 'organization' : 'individual',
      organizationId: organizationId ?? organizationIdString ?? null,
      userId: vendorOwnerEmail ?? null,

      vendorId: vendor._id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      vendorPhone: vendor.phone,
      vendorAddress: vendor.address,

      currency,
      items: normalizedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      total: Math.round(total * 100) / 100,
      memo: note || '',

      externalInvoiceNumber: invoiceNumber,
      invoiceFileUrl: invoiceFileUrl || null,
      vendorPaymentDetails: vendorPaymentDetails || null,

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
          payableNumber,
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

