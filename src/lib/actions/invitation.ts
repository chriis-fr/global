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
import { sendOrganizationInvitation } from '@/lib/services/emailService';

// Send invitation to join organization
export async function sendInvitation(email: string, role: RoleKey): Promise<{
  success: boolean;
  data?: { token: string; expiresAt: Date };
  error?: string;
}> {
  console.log('📧 [Invitation] Starting invitation process...');
  console.log('📧 [Invitation] Email:', email);
  console.log('📧 [Invitation] Role:', role);
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ [Invitation] No session found');
      return { success: false, error: 'Unauthorized' };
    }

    console.log('✅ [Invitation] Session found for user:', session.user.email);

    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user || !user.organizationId) {
      console.log('❌ [Invitation] User not found or no organization');
      return { success: false, error: 'User does not belong to an organization' };
    }

    console.log('✅ [Invitation] User found:', user.email);
    console.log('✅ [Invitation] Organization ID:', user.organizationId.toString());

    // Check if user can invite members
    const db = await getDatabase();
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId.toString())
    });

    if (!organization) {
      console.log('❌ [Invitation] Organization not found');
      return { success: false, error: 'Organization not found' };
    }

    console.log('✅ [Invitation] Organization found:', organization.name);

    const userMember = organization.members.find((m: any) => 
      m.userId.toString() === user._id!.toString()
    );

    if (!userMember || !userMember.permissions.canInviteMembers) {
      console.log('❌ [Invitation] User does not have permission to invite members');
      console.log('📊 [Invitation] User member data:', {
        hasMember: !!userMember,
        canInviteMembers: userMember?.permissions?.canInviteMembers,
        role: userMember?.role
      });
      return { success: false, error: 'You do not have permission to invite members' };
    }

    console.log('✅ [Invitation] User has permission to invite members');

    // Check if email is already a member
    const existingMember = organization.members.find((m: any) => 
      m.email.toLowerCase() === email.toLowerCase()
    );

    if (existingMember) {
      console.log('❌ [Invitation] User is already a member');
      return { success: false, error: 'User is already a member of this organization' };
    }

    console.log('✅ [Invitation] Email is not already a member');

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    console.log('✅ [Invitation] Token generated:', token.substring(0, 8) + '...');
    console.log('✅ [Invitation] Expires at:', expiresAt.toISOString());

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

    console.log('📝 [Invitation] Creating invitation token in database...');
    await db.collection<InvitationToken>('invitation_tokens').insertOne(invitationToken);
    console.log('✅ [Invitation] Invitation token created successfully');

    // Generate invitation link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const invitationLink = `${baseUrl}/invite/${token}`;
    
    console.log('🔗 [Invitation] Invitation link generated:', invitationLink);

    // Send actual email invitation
    console.log('📧 [Invitation] Sending email invitation...');
    console.log('📧 [Invitation] Email details:', {
      to: email,
      organization: organization.name,
      inviter: user.name || user.email,
      role,
      link: invitationLink,
      expires: expiresAt.toLocaleDateString()
    });

    try {
      const emailResult = await sendOrganizationInvitation(
        email,
        organization.name,
        user.name || user.email,
        role,
        invitationLink,
        expiresAt
      );

      if (emailResult.success) {
        console.log('✅ [Invitation] Email sent successfully!');
        console.log('📧 [Invitation] Email message ID:', emailResult.messageId);
      } else {
        console.log('❌ [Invitation] Email sending failed:', emailResult.error);
        // Don't fail the invitation process if email fails
        console.log('⚠️ [Invitation] Continuing with invitation despite email failure');
      }
    } catch (emailError) {
      console.error('❌ [Invitation] Email sending error:', emailError);
      // Don't fail the invitation process if email fails
      console.log('⚠️ [Invitation] Continuing with invitation despite email error');
    }

    // Log the invitation details
    console.log('📋 [Invitation] INVITATION DETAILS:');
    console.log('📋 [Invitation] - Organization:', organization.name);
    console.log('📋 [Invitation] - Invited by:', user.name || user.email);
    console.log('📋 [Invitation] - Email:', email);
    console.log('📋 [Invitation] - Role:', role);
    console.log('📋 [Invitation] - Link:', invitationLink);
    console.log('📋 [Invitation] - Expires:', expiresAt.toLocaleDateString());

    return {
      success: true,
      data: {
        token,
        expiresAt
      }
    };
  } catch (error) {
    console.error('❌ [Invitation] Error sending invitation:', error);
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

// Accept invitation (for authenticated users)
export async function acceptInvitation(token: string): Promise<{
  success: boolean;
  data?: { organizationId: string; role: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'Please sign in to accept this invitation' };
    }

    console.log('✅ [Accept Invitation] User is authenticated:', session.user.email);

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

    console.log('✅ [Accept Invitation] Email matches invitation');

    // Get or create user
    let user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found. Please create an account first.' };
    }

    console.log('✅ [Accept Invitation] User found:', user.email);

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

    console.log('✅ [Accept Invitation] Organization found:', organization.name);

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

    console.log('📝 [Accept Invitation] Adding member to organization...');

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

    console.log('✅ [Accept Invitation] Invitation accepted successfully!');
    console.log('📋 [Accept Invitation] Member details:', {
      userId: user._id!.toString(),
      email: user.email,
      role: invitation.role,
      organization: organization.name
    });

    return {
      success: true,
      data: {
        organizationId: invitation.organizationId.toString(),
        role: invitation.role
      }
    };
  } catch (error) {
    console.error('❌ [Accept Invitation] Error accepting invitation:', error);
    return { 
      success: false, 
      error: 'Failed to accept invitation' 
    };
  }
}

// Accept invitation for unauthenticated users (redirect to signup with invitation context)
export async function acceptInvitationForNewUser(token: string): Promise<{
  success: boolean;
  data?: { 
    organizationId: string; 
    role: string; 
    email: string;
    organizationName: string;
    organizationIndustry: string;
    inviterName: string;
  };
  error?: string;
}> {
  try {
    console.log('🆕 [Accept Invitation] Processing invitation for new user with token:', token);

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

    console.log('✅ [Accept Invitation] Valid invitation found for:', invitation.email);

    // Get organization details
    const organization = await db.collection('organizations').findOne({
      _id: invitation.organizationId
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    // Get inviter details
    const inviter = await UserService.getUserById(invitation.invitedBy.toString());

    console.log('✅ [Accept Invitation] Organization found:', organization.name);

    return {
      success: true,
      data: {
        organizationId: invitation.organizationId.toString(),
        role: invitation.role,
        email: invitation.email,
        organizationName: organization.name,
        organizationIndustry: organization.industry || '',
        inviterName: inviter?.name || inviter?.email || 'Unknown'
      }
    };
  } catch (error) {
    console.error('❌ [Accept Invitation] Error processing invitation for new user:', error);
    return { 
      success: false, 
      error: 'Failed to process invitation' 
    };
  }
}

// Complete invitation acceptance after user signup
export async function completeInvitationAcceptance(token: string): Promise<{
  success: boolean;
  data?: { organizationId: string; role: string };
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return { success: false, error: 'User must be authenticated to complete invitation' };
    }

    console.log('✅ [Complete Invitation] User is authenticated:', session.user.email);

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

    console.log('✅ [Complete Invitation] Email matches invitation');

    // Get user
    const user = await UserService.getUserByEmail(session.user.email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if user already belongs to a different organization
    if (user.organizationId && user.organizationId.toString() !== invitation.organizationId.toString()) {
      console.log('⚠️ [Complete Invitation] User belongs to different organization, removing from current organization');
      
      // Remove user from current organization
      await db.collection('organizations').updateOne(
        { _id: user.organizationId },
        { $pull: { members: { userId: user._id } } }
      );
      
      // Clear user's organization ID
      await UserService.updateUser(user._id!.toString(), {
        organizationId: null
      });
      
      console.log('✅ [Complete Invitation] User removed from previous organization');
    }
    
    // If user already belongs to the same organization, just return success
    if (user.organizationId && user.organizationId.toString() === invitation.organizationId.toString()) {
      console.log('✅ [Complete Invitation] User already belongs to this organization');
      return {
        success: true,
        data: {
          organizationId: invitation.organizationId.toString(),
          role: invitation.role
        }
      };
    }

    // Get organization
    const organization = await db.collection('organizations').findOne({
      _id: invitation.organizationId
    });

    if (!organization) {
      return { success: false, error: 'Organization not found' };
    }

    console.log('✅ [Complete Invitation] Organization found:', organization.name);

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

    console.log('📝 [Complete Invitation] Adding member to organization...');

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

    console.log('✅ [Complete Invitation] Invitation completed successfully!');
    console.log('📋 [Complete Invitation] Member details:', {
      userId: user._id!.toString(),
      email: user.email,
      role: invitation.role,
      organization: organization.name
    });

    return {
      success: true,
      data: {
        organizationId: invitation.organizationId.toString(),
        role: invitation.role
      }
    };
  } catch (error) {
    console.error('❌ [Complete Invitation] Error completing invitation:', error);
    return { 
      success: false, 
      error: 'Failed to complete invitation' 
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
      token: invitation.token,
      email: invitation.email,
      role: invitation.role,
      permissions: invitation.permissions,
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

// Resend invitation email
export async function resendInvitation(invitationId: string): Promise<{
  success: boolean;
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

    const db = await getDatabase();
    
    // Get the invitation
    const invitation = await db.collection<InvitationToken>('invitation_tokens').findOne({
      _id: new ObjectId(invitationId),
      organizationId: new ObjectId(user.organizationId.toString()),
      usedAt: { $exists: false }
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found or already used' };
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return { success: false, error: 'Invitation has expired' };
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

    // Generate new invitation link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const invitationLink = `${baseUrl}/invite/${invitation.token}`;

    console.log('📧 [Resend Invitation] Resending invitation email...');
    console.log('📧 [Resend Invitation] Email details:', {
      to: invitation.email,
      organization: organization.name,
      inviter: inviter?.name || inviter?.email || 'Unknown',
      role: invitation.role,
      link: invitationLink,
      expires: invitation.expiresAt.toLocaleDateString()
    });

    // Send email
    const emailResult = await sendOrganizationInvitation(
      invitation.email,
      organization.name,
      inviter?.name || inviter?.email || 'Unknown',
      invitation.role,
      invitationLink,
      invitation.expiresAt
    );

    if (emailResult.success) {
      console.log('✅ [Resend Invitation] Email resent successfully!');
      console.log('📧 [Resend Invitation] Email message ID:', emailResult.messageId);
      return { success: true };
    } else {
      console.log('❌ [Resend Invitation] Email sending failed:', emailResult.error);
      return { success: false, error: 'Failed to send email' };
    }
  } catch (error) {
    console.error('Error resending invitation:', error);
    return { 
      success: false, 
      error: 'Failed to resend invitation' 
    };
  }
}

// Delete invitation
export async function deleteInvitation(invitationId: string): Promise<{
  success: boolean;
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

    const db = await getDatabase();
    
    // Check if user has permission to manage team
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

    const canManageTeam = userMember.permissions?.canManageTeam || 
                         userMember.role === 'owner' || 
                         userMember.role === 'admin';

    if (!canManageTeam) {
      return { success: false, error: 'You do not have permission to delete invitations' };
    }

    // Delete the invitation
    const result = await db.collection<InvitationToken>('invitation_tokens').deleteOne({
      _id: new ObjectId(invitationId),
      organizationId: new ObjectId(user.organizationId.toString())
    });

    if (result.deletedCount === 0) {
      return { success: false, error: 'Invitation not found' };
    }

    console.log('✅ [Delete Invitation] Invitation deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Error deleting invitation:', error);
    return { 
      success: false, 
      error: 'Failed to delete invitation' 
    };
  }
}
