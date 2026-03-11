import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// Public GET: return vendor + company (payer) info + payment methods for the vendor submission page
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
    const organizationId = rawOrgId != null ? (typeof rawOrgId === 'string' ? new ObjectId(rawOrgId) : rawOrgId) : undefined;
    const ownerId = organizationId
      ? organizationId.toString()
      : (vendor.userId as string | undefined);

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Vendor is not linked to an owner.' },
        { status: 400 }
      );
    }

    let company: {
      name: string;
      email: string;
      phone?: string;
      address?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
    } = { name: '', email: '' };

    if (organizationId) {
      const org = await db.collection('organizations').findOne({
        _id: organizationId,
      });
      if (org) {
        const orgName = (org.name as string)?.trim();
        const orgEmail = (org.billingEmail as string) || (org.email as string) || '';
        company = {
          name: orgName || (orgEmail ? orgEmail.trim() : '') || 'Organization',
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
          name: userName || (userEmail ? userEmail.trim() : '') || 'Account',
          email: userEmail,
          phone: (user.phone as string) || undefined,
          address: (user.address as Record<string, string>) || undefined,
        };
      }
    }

    // Payment methods: by organizationId or by userId (for individual we need user._id)
    const paymentMethodsCollection = db.collection('paymentMethods');
    let paymentQuery: Record<string, unknown>;
    if (organizationId) {
      paymentQuery = { organizationId };
    } else {
      const user = await db.collection('users').findOne({ email: ownerId });
      if (user?._id) {
        paymentQuery = { userId: user._id };
      } else {
        paymentQuery = { _id: null };
      }
    }

    const paymentMethods = await paymentMethodsCollection
      .find(paymentQuery)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        vendor: {
          name: vendor.name || 'Vendor',
          email: vendor.email || '',
        },
        company,
        paymentMethods: paymentMethods.map((pm) => ({
          _id: pm._id?.toString(),
          name: pm.name,
          type: pm.type,
          isDefault: pm.isDefault,
          fiatDetails: pm.fiatDetails,
          cryptoDetails: pm.cryptoDetails,
        })),
      },
    });
  } catch (error) {
    console.error('[Vendor Link GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load vendor link' },
      { status: 500 }
    );
  }
}
