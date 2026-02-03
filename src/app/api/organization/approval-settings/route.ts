import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApprovalService } from '@/lib/services/approvalService';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import { ApprovalSettings } from '@/types/approval';

// GET /api/organization/approval-settings - Get approval settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can manage approval settings
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: { userId: string }) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canManageSettings(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Approval settings only apply when org has Smart Invoicing and/or Accounts Payable
    const orgServices = organization.services as { smartInvoicing?: boolean; accountsPayable?: boolean } | undefined;
    const hasApprovalRelevantService = orgServices && (orgServices.smartInvoicing === true || orgServices.accountsPayable === true);
    if (!hasApprovalRelevantService) {
      return NextResponse.json(
        { success: false, message: 'Approval settings are only available for organizations with Smart Invoicing or Accounts Payable enabled. Enable these in Services first.' },
        { status: 403 }
      );
    }

    // Get approval settings
    const settings = await ApprovalService.getApprovalSettings(user.organizationId.toString());

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Approval settings retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting approval settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to get approval settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/organization/approval-settings - Update approval settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { success: false, message: 'Settings data is required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can manage approval settings
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: { userId: string }) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canManageSettings(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Approval settings only apply when org has Smart Invoicing and/or Accounts Payable
    const orgServicesPut = organization.services as { smartInvoicing?: boolean; accountsPayable?: boolean } | undefined;
    const hasApprovalRelevantServicePut = orgServicesPut && (orgServicesPut.smartInvoicing === true || orgServicesPut.accountsPayable === true);
    if (!hasApprovalRelevantServicePut) {
      return NextResponse.json(
        { success: false, message: 'Approval settings are only available for organizations with Smart Invoicing or Accounts Payable enabled. Enable these in Services first.' },
        { status: 403 }
      );
    }

    // Validate settings
    const validatedSettings = validateApprovalSettings(settings);
    if (!validatedSettings) {
      return NextResponse.json(
        { success: false, message: 'Invalid settings data' },
        { status: 400 }
      );
    }

    // Update approval settings
    const success = await ApprovalService.updateApprovalSettings(
      user.organizationId.toString(),
      validatedSettings
    );

    if (success) {
      // Log the settings change
      await ApprovalService.logAuditAction(
        user.organizationId.toString(),
        user._id!.toString(),
        'settings_change',
        'organization',
        user.organizationId.toString(),
        'Approval settings updated',
        { 
          previousSettings: organization.approvalSettings,
          newSettings: validatedSettings
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Approval settings updated successfully'
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to update approval settings' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating approval settings:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update approval settings',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Validate approval settings
function validateApprovalSettings(settings: Record<string, unknown>): ApprovalSettings | null {
  try {
    // Basic validation
    if (typeof settings.requireApproval !== 'boolean') {
      return null;
    }

    // Validate approval rules
    if (!settings.approvalRules || typeof settings.approvalRules !== 'object') {
      return null;
    }

    const approvalRules = settings.approvalRules as Record<string, unknown>;
    const amountThresholds = approvalRules.amountThresholds as Record<string, unknown> | undefined;
    const requiredApprovers = approvalRules.requiredApprovers as Record<string, unknown> | undefined;
    const fallbackApprovers = approvalRules.fallbackApprovers;
    const autoApprove = approvalRules.autoApprove as Record<string, unknown> | undefined;

    // Validate amount thresholds
    if (!amountThresholds || 
        typeof amountThresholds.low !== 'number' ||
        typeof amountThresholds.medium !== 'number' ||
        typeof amountThresholds.high !== 'number') {
      return null;
    }

    // Validate required approvers
    if (!requiredApprovers ||
        typeof requiredApprovers.low !== 'number' ||
        typeof requiredApprovers.medium !== 'number' ||
        typeof requiredApprovers.high !== 'number') {
      return null;
    }

    // Validate fallback approvers
    if (!Array.isArray(fallbackApprovers)) {
      return null;
    }

    // Validate auto-approve settings
    if (!autoApprove || typeof autoApprove.enabled !== 'boolean') {
      return null;
    }

    const conditions = autoApprove.conditions as Record<string, unknown> | undefined;
    if (!conditions ||
        !Array.isArray(conditions.vendorWhitelist) ||
        !Array.isArray(conditions.categoryWhitelist) ||
        typeof conditions.amountLimit !== 'number') {
      return null;
    }

    // Validate email settings
    const emailSettings = settings.emailSettings as Record<string, unknown> | undefined;
    if (!emailSettings ||
        typeof emailSettings.primaryEmail !== 'string' ||
        !Array.isArray(emailSettings.notificationEmails) ||
        typeof emailSettings.approvalNotifications !== 'boolean' ||
        typeof emailSettings.paymentNotifications !== 'boolean') {
      return null;
    }

    return settings as unknown as ApprovalSettings;
  } catch (error) {
    console.error('Error validating approval settings:', error);
    return null;
  }
}
