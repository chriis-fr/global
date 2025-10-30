import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';

export interface RBACOptions {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
  allowOwner?: boolean;
  allowAdmin?: boolean;
}

export class RBACMiddleware {
  // Check if user has permission for a specific action and resource
  static async checkPermission(
    request: NextRequest,
    options: RBACOptions
  ): Promise<{ allowed: boolean; user?: Record<string, unknown>; member?: Record<string, unknown>; organization?: Record<string, unknown>; error?: string }> {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return { allowed: false, error: 'Unauthorized' };
      }

      const db = await getDatabase();
      const user = await db.collection('users').findOne({
        email: session.user.email
      });

      if (!user) {
        return { allowed: false, error: 'User not found' };
      }

      // If user is not in an organization, check if they're an individual user
      if (!user.organizationId) {
        // For individual users, allow most actions (they act as owner/admin)
        if (options.allowOwner !== false) {
          return { allowed: true, user };
        }
        return { allowed: false, error: 'User not in organization' };
      }

      // Get organization and member details
      const organization = await db.collection('organizations').findOne({
        _id: user.organizationId
      });

      if (!organization) {
        return { allowed: false, error: 'Organization not found' };
      }

      const member = organization.members.find((m: { userId: { toString: () => string } }) => m.userId.toString() === user._id?.toString());
      if (!member) {
        return { allowed: false, error: 'User not found in organization' };
      }

      // Check permissions using RBAC service
      const hasPermission = RBACService.hasPermission(
        member,
        options.action,
        options.resource,
        options.conditions
      );

      if (hasPermission) {
        return { 
          allowed: true, 
          user, 
          member, 
          organization 
        };
      }

      return { 
        allowed: false, 
        error: 'Insufficient permissions',
        user,
        member,
        organization
      };

    } catch (error) {
      console.error('Error checking permissions:', error);
      return { 
        allowed: false, 
        error: 'Internal server error' 
      };
    }
  }

  // Middleware wrapper for API routes
  static withPermission(options: RBACOptions) {
    return async function middleware(
      request: NextRequest,
      handler: (request: NextRequest, context: Record<string, unknown>) => Promise<NextResponse>
    ) {
      const permissionCheck = await RBACMiddleware.checkPermission(request, options);
      
      if (!permissionCheck.allowed) {
        return NextResponse.json(
          { 
            success: false, 
            message: permissionCheck.error || 'Access denied' 
          },
          { status: permissionCheck.error === 'Unauthorized' ? 401 : 403 }
        );
      }

      // Add user context to request
      (request as unknown as Record<string, unknown>).user = permissionCheck.user;
      (request as unknown as Record<string, unknown>).member = permissionCheck.member;
      (request as unknown as Record<string, unknown>).organization = permissionCheck.organization;

      return handler(request, { user: permissionCheck.user, member: permissionCheck.member, organization: permissionCheck.organization });
    };
  }

  // Specific permission checkers
  static async canManageTreasury(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'create',
      resource: 'payment_method'
    });
  }

  static async canManageTeam(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'invite',
      resource: 'member'
    });
  }

  static async canManageSettings(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'manage',
      resource: 'approval_settings'
    });
  }

  static async canCreateBills(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'create',
      resource: 'bill'
    });
  }

  static async canApproveBills(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'approve',
      resource: 'bill'
    });
  }

  static async canExecutePayments(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'pay',
      resource: 'bill'
    });
  }

  static async canViewFinancialData(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'read',
      resource: 'transaction'
    });
  }

  static async canExportData(request: NextRequest) {
    return RBACMiddleware.checkPermission(request, {
      action: 'export',
      resource: 'report'
    });
  }
}

// Helper function to create permission-checked API handlers
export function withRBAC(options: RBACOptions) {
  return function(handler: (request: NextRequest, context: Record<string, unknown>) => Promise<NextResponse>) {
    return (request: NextRequest) => RBACMiddleware.withPermission(options)(request, handler);
  };
}
