import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// GET /api/user/permissions - Get user permissions
export async function GET(request: NextRequest) {
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

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // If user is not in an organization, give them full permissions (individual user)
    if (!user.organizationId) {
      return NextResponse.json({
        success: true,
        data: {
          permissions: {
            canManageTreasury: true,
            canManageTeam: true,
            canManageSettings: true,
            canCreateBills: true,
            canApproveBills: true,
            canExecutePayments: true,
            canViewFinancialData: true,
            canExportData: true,
          },
          member: null,
          role: 'individual',
          isIndividual: true
        },
        message: 'Individual user permissions retrieved successfully'
      });
    }

    // Get organization and member details
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: any) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Calculate permissions based on role
    const permissions = {
      canManageTreasury: RBACService.canManageTreasury(member),
      canManageTeam: RBACService.canManageTeam(member),
      canManageSettings: RBACService.canManageSettings(member),
      canCreateBills: RBACService.canCreateBills(member),
      canApproveBills: RBACService.canApproveBills(member),
      canExecutePayments: RBACService.canExecutePayments(member),
      canViewFinancialData: RBACService.hasPermission(member, 'read', 'transaction'),
      canExportData: RBACService.hasPermission(member, 'export', 'report'),
    };

    // Get approval limits
    const approvalLimits = RBACService.getApprovalLimits(member);

    return NextResponse.json({
      success: true,
      data: {
        permissions,
        member: {
          ...member,
          approvalLimits
        },
        role: member.role,
        isIndividual: false,
        organization: {
          _id: organization._id,
          name: organization.name,
          industry: organization.industry
        }
      },
      message: 'User permissions retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting user permissions:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to get user permissions',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
