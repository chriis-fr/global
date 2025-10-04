'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { 
  InvitationToken, 
  OrganizationMember, 
  PermissionSet 
} from '@/models/Organization';
import { UserService } from '@/lib/services/userService';
import { getRolePermissions, type RoleKey } from '@/lib/utils/roles';
import { randomBytes } from 'crypto';

// Send invitation to join organization
export async function sendInvitation(email: string, role: RoleKey): Promise<{
  success: boolean;
  data?: { token: string; expiresAt: Date };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, error: 'User does not belong to an organization' };
    }

    // Check if user can invite members
    const db = await getDatabase();
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    const userMember = organization.members.find((m: any) => 
      m.userId.toString() === user._id!.toString()
    );

    if (!userMember || !userMember.permissions.canInviteMembers) {
      return { success: false, error: 'You do not have permission to invite members' };
    }

    // Check if email is already a member
    const existingMember = organization.members.find((m: any) => 
      m.email.toLowerCase() === email.toLowerCase()
    );

    if (existingMember) {
      return { success: false, error: 'User is already a member of this organization' };
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation token
    const invitationToken: InvitationToken = {
      token,
      organizationId: new ObjectId(user.organizationId.toString()),
      email: email.toLowerCase(),
      role,
      permissions: getRolePermissions(role),
      invitedBy: user._id!,
      expiresAt,
      createdAt: new Date()
    };

    await db.collection<InvitationToken>('invitation_tokens').insertOne(invitationToken);

    return {
      success: true,
      data: {
        token,
        expiresAt
      }
    };
  } catch (error) {
    console.error('Error sending invitation:', error);
    return { 
      success: false, 
      error: 'Failed to send invitation' 
    };
  }
}

// Validate invitation token
export async function validateInvitationToken(token: string): Promise<{
  success: boolean;
  data?: {
    organizationName: string;
    inviterName: string;
    role: string;
    permissions: PermissionSet;
    email: string;
    expiresAt: Date;
  };
  error?: string;
}> {
  try {
    const db = await getDatabase();
    const invitation = await db.collection<InvitationToken>('invitation_tokens').findOne({
      token,
      usedAt: { $exists: false }
    });

    if (!invitation) {
      return { success: false, error: 'Invalid or expired invitation token' };
    }

    // Check if token is expired
    if (new Date() > invitation.expiresAt) {
      return { success: false, error: 'Invitation token has expired' };
    }

    // Get organization details
    const organization = await db.collection('organizations').findOne({
      _id: invitation.organizationId
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Get inviter details
    const inviter = await UserService.getUserById(invitation.invitedBy.toString());

    return {
      success: true,
      data: {
        organizationName: organization.name,
        inviterName: inviter?.name || inviter?.email || 'Unknown',
        role: invitation.role,
        permissions: invitation.permissions,
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString()
      }
    };
  } catch (error) {
    console.error('Error validating invitation token:', error);
    return { 
      success: false, 
      error: 'Failed to validate invitation token' 
    };
  }
}

// Accept invitation
export async function acceptInvitation(token: string, userData?: {
  name?: string;
  password?: string;
}): Promise<{
  success: boolean;
  data?: { organizationId: string; role: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await getDatabase();
    const invitation = await db.collection<InvitationToken>('invitation_tokens').findOne({
      token,
      usedAt: { $exists: false }
    });

    if (!invitation) {
      return { success: false, error: 'Invalid or expired invitation token' };
    }

    // Check if token is expired
    if (new Date() > invitation.expiresAt) {
      return { success: false, error: 'Invitation token has expired' };
    }

    // Check if email matches the invitation
    if (session.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return { success: false, error: 'Email does not match invitation' };
    }

    // Get or create user
    let user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if user already belongs to an organization
    if (user.organizationId) {
      return { success: false, error: 'User already belongs to an organization' };
    }

    // Get organization
    const organization = await db.collection('organizations').findOne({
      _id: invitation.organizationId
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Add user to organization members
    const newMember: OrganizationMember = {
      userId: user._id!,
      email: user.email,
      name: user.name || user.email,
      role: invitation.role,
      permissions: invitation.permissions,
      status: 'active',
      invitedBy: invitation.invitedBy,
      joinedAt: new Date(),
      lastActiveAt: new Date()
    };

    // Update organization with new member
    await db.collection('organizations').updateOne(
      { _id: invitation.organizationId },
      { 
        $push: { members: newMember },
        $set: { updatedAt: new Date() }
      }
    );

    // Update user to link to organization
    await UserService.updateUser(user._id!.toString(), {
      organizationId: invitation.organizationId,
      userType: 'business'
    });

    // Mark invitation as used
    await db.collection<InvitationToken>('invitation_tokens').updateOne(
      { _id: invitation._id },
      { $set: { usedAt: new Date() } }
    );

    return {
      success: true,
      data: {
        organizationId: invitation.organizationId.toString(),
        role: invitation.role
      }
    };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { 
      success: false, 
      error: 'Failed to accept invitation' 
    };
  }
}

// Decline invitation
export async function declineInvitation(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const db = await getDatabase();
    const invitation = await db.collection<InvitationToken>('invitation_tokens').findOne({
      token,
      usedAt: { $exists: false }
    });

    if (!invitation) {
      return { success: false, error: 'Invalid invitation token' };
    }

    // Mark invitation as used (declined)
    await db.collection<InvitationToken>('invitation_tokens').updateOne(
      { _id: invitation._id },
      { $set: { usedAt: new Date() } }
    );

    return { success: true };
  } catch (error) {
    console.error('Error declining invitation:', error);
    return { 
      success: false, 
      error: 'Failed to decline invitation' 
    };
  }
}

// Get pending invitations for organization
export async function getPendingInvitations(): Promise<{
  success: boolean;
  data?: InvitationToken[];
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' };
    }

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      return { success: false, error: 'User does not belong to an organization' };
    }

    // Check if user can view invitations
    const db = await getDatabase();
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    const userMember = organization.members.find((m: any) => 
      m.userId.toString() === user._id!.toString()
    );

    if (!userMember) {
      return { success: false, error: 'User not found in organization' };
    }

    // Check if user has permission to manage team (fallback for legacy members)
    const canManageTeam = userMember.permissions?.canManageTeam || 
                         userMember.role === 'owner' || 
                         userMember.role === 'admin';

    if (!canManageTeam) {
      return { success: false, error: 'You do not have permission to view invitations' };
    }

    // Get pending invitations
    const invitations = await db.collection<InvitationToken>('invitation_tokens').find({
      organizationId: new ObjectId(user.organizationId.toString()),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    }).toArray();

    // Convert ObjectIds to strings for client components
    const serializedInvitations = invitations.map(invitation => ({
      ...invitation,
      _id: invitation._id?.toString(),
      organizationId: invitation.organizationId.toString(),
      invitedBy: invitation.invitedBy.toString(),
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      usedAt: invitation.usedAt?.toISOString()
    }));

    return {
      success: true,
      data: serializedInvitations
    };
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    return { 
      success: false, 
      error: 'Failed to fetch pending invitations' 
    };
  }
}
