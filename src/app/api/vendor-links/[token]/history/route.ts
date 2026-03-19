import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(
  _request: Request,
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

    const rawOrgId = vendor.organizationId;
    const organizationId =
      rawOrgId != null
        ? typeof rawOrgId === 'string'
          ? new ObjectId(rawOrgId)
          : (rawOrgId as ObjectId)
        : undefined;
    const ownerId = organizationId
      ? organizationId.toString()
      : (vendor.userId as string | undefined);

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Vendor is not linked to an owner.' },
        { status: 400 }
      );
    }

    // Build "company" (payer) summary, mirroring the main vendor link GET
    let company: {
      name: string;
      email: string;
      phone?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
      };
    } = { name: '', email: '' };

    if (organizationId) {
      const org = await db.collection('organizations').findOne({
        _id: organizationId,
      });
      if (org) {
        const orgName = (org.name as string)?.trim();
        const orgEmail =
          (org.billingEmail as string) || (org.email as string) || '';
        company = {
          name:
            orgName || (orgEmail ? orgEmail.trim() : '') || 'Organization',
          email: orgEmail,
          phone: (org.phone as string) || undefined,
          address: (org.address as Record<string, string>) || undefined,
        };
      }
    } else {
      const user = await db.collection('users').findOne({
        email: ownerId,
      });
      if (user) {
        const userName = (user.name as string)?.trim();
        const userEmail = (user.email as string) || '';
        company = {
          name:
            userName || (userEmail ? userEmail.trim() : '') || 'Account',
          email: userEmail,
          phone: (user.phone as string) || undefined,
          address: (user.address as Record<string, string>) || undefined,
        };
      }
    }

    const payablesCollection = db.collection('payables');
    const vendorId = vendor._id as ObjectId;

    // Only payables that belong to this vendor and this owner/org
    const payableQuery: Record<string, unknown> = {
      vendorId,
    };

    if (organizationId) {
      payableQuery.organizationId = {
        $in: [organizationId, organizationId.toString()],
      };
    } else {
      payableQuery.userId = ownerId;
    }

    const payables = await payablesCollection
      .find(payableQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const history = payables.map((p) => {
      const createdAt =
        (p.createdAt as Date | undefined)?.toISOString() ??
        new Date().toISOString();
      const dueDate = (p.dueDate as Date | undefined)?.toISOString();

      const total =
        typeof p.total === 'number'
          ? p.total
          : typeof p.amount === 'number'
          ? p.amount
          : 0;

      const paymentDetails = (p.paymentDetails || {}) as Record<
        string,
        unknown
      >;

      const hasPaymentProof =
        Boolean(paymentDetails?.proofUrl) ||
        Boolean(paymentDetails?.proof) ||
        Boolean(paymentDetails?.txHash);

      return {
        id: (p._id as ObjectId).toString(),
        payableNumber: (p.payableNumber as string) || '',
        invoiceNumber: (p.externalInvoiceNumber as string) || '',
        description:
          (p.payableName as string) ||
          (p.memo as string) ||
          (p.description as string) ||
          '',
        currency: (p.currency as string) || 'USD',
        total,
        status: (p.status as string) || 'submitted',
        paymentStatus: (p.paymentStatus as string) || 'pending',
        createdAt,
        dueDate: dueDate || null,
        invoiceFileUrl: (p.invoiceFileUrl as string) || null,
        paymentDate:
          (p.paymentDate as Date | undefined)?.toISOString() || null,
        paymentMethod: (p.paymentMethod as string) || null,
        hasPaymentProof,
        paymentReference: (p.paymentReference as string) || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        vendor: {
          name: (vendor.name as string) || 'Vendor',
          email: (vendor.email as string) || '',
        },
        company,
        payables: history,
      },
    });
  } catch (error) {
    console.error('[Vendor History GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load vendor history' },
      { status: 500 }
    );
  }
}

