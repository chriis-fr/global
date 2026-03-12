import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { InvoiceProfile } from '@/models/InvoiceProfile';

// Synthetic organization id used when a super admin (adminTag) has no organizationId,
// so their profiles are still grouped consistently.
const ADMIN_GLOBAL_ORG_ID = new ObjectId('000000000000000000000000');

// Helper: resolve organization context for current user
function getOrganizationObjectIdForProfiles(user: {
  organizationId?: string;
  adminTag?: boolean;
}): ObjectId | null {
  if (user.organizationId) {
    return new ObjectId(user.organizationId);
  }
  if (user.adminTag) {
    return ADMIN_GLOBAL_ORG_ID;
  }
  return null;
}

// GET /api/invoice-profiles - list profiles for current organization (org-only feature, with admin bypass)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Allow organization members or admin-tagged super admins to access,
    // but require an organization context in practice.
    if (!session?.user?.id || (!session.user.organizationId && !session.user.adminTag)) {
      return NextResponse.json(
        { success: false, message: 'Invoice profiles are only available for organization accounts' },
        { status: 403 }
      );
    }

    const db = await connectToDatabase();
    const profilesCollection = db.collection<InvoiceProfile>('invoiceProfiles');

    const organizationId = getOrganizationObjectIdForProfiles(session.user);
    if (!organizationId) {
      return NextResponse.json(
        { success: false, message: 'Invoice profiles are only available for organization accounts' },
        { status: 403 }
      );
    }

    // Support both ObjectId and string organizationId for backward compatibility
    const orgIdString = organizationId.toString();
    const profiles = await profilesCollection
      .find({
        $or: [
          { organizationId },
          { organizationId: orgIdString },
        ],
      })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: profiles.map((p) => ({
        ...p,
        _id: p._id?.toString(),
        organizationId: p.organizationId.toString(),
        createdBy: p.createdBy.toString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching invoice profiles:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch invoice profiles' },
      { status: 500 }
    );
  }
}

// POST /api/invoice-profiles - create a new profile (org-only, with admin bypass)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Allow organization members or admin-tagged super admins to create,
    // but still require an organization context.
    if (!session?.user?.id || (!session.user.organizationId && !session.user.adminTag)) {
      return NextResponse.json(
        { success: false, message: 'Invoice profiles are only available for organization accounts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      businessInfo,
      invoiceSettings,
      isDefault,
    }: {
      name?: string;
      businessInfo?: InvoiceProfile['businessInfo'];
      invoiceSettings?: InvoiceProfile['invoiceSettings'];
      isDefault?: boolean;
    } = body;

    if (!name || !businessInfo?.name || !businessInfo.email) {
      return NextResponse.json(
        {
          success: false,
          message: 'Profile name, business name, and email are required',
        },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const profilesCollection = db.collection<InvoiceProfile>('invoiceProfiles');

    const organizationId = getOrganizationObjectIdForProfiles(session.user);
    if (!organizationId) {
      return NextResponse.json(
        { success: false, message: 'Invoice profiles are only available for organization accounts' },
        { status: 403 }
      );
    }
    const createdBy = new ObjectId(session.user.id);

    const now = new Date();

    const profile: InvoiceProfile = {
      name: name.trim(),
      businessInfo: {
        name: businessInfo.name.trim(),
        email: businessInfo.email.trim(),
        phone: businessInfo.phone || '',
        website: businessInfo.website || '',
        taxId: businessInfo.taxId || '',
        logo: businessInfo.logo || '',
        address: {
          street: businessInfo.address?.street || '',
          city: businessInfo.address?.city || '',
          state: businessInfo.address?.state || '',
          zipCode: businessInfo.address?.zipCode || '',
          country: businessInfo.address?.country || 'US',
        },
      },
      invoiceSettings: invoiceSettings
        ? {
            defaultCurrency: invoiceSettings.defaultCurrency,
            paymentTerms: invoiceSettings.paymentTerms ?? 30,
            showWithholdingTaxOnInvoices:
              invoiceSettings.showWithholdingTaxOnInvoices ?? false,
            withholdingTaxRatePercent:
              invoiceSettings.withholdingTaxRatePercent ?? 5,
          }
        : undefined,
      organizationId,
      createdBy,
      isDefault: !!isDefault,
      createdAt: now,
      updatedAt: now,
    };

    // If this profile should be default, clear previous defaults for this org
    if (profile.isDefault) {
      await profilesCollection.updateMany(
        { organizationId },
        { $set: { isDefault: false } }
      );
    }

    const result = await profilesCollection.insertOne(profile);

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        _id: result.insertedId.toString(),
        organizationId: profile.organizationId.toString(),
        createdBy: profile.createdBy.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating invoice profile:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create invoice profile' },
      { status: 500 }
    );
  }
}

