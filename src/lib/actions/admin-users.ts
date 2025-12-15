'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { createDefaultServices } from '@/lib/services/serviceManager';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  adminTag: boolean;
  role: string;
  createdAt: string;
  lastLogin?: string;
  isEmailVerified: boolean;
  planId: string;
  subscriptionStatus: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  organizationId?: string;
  services: {
    smartInvoicing: boolean;
    accountsReceivable: boolean;
    accountsPayable: boolean;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  avatar?: string;
  subscription: {
    planId: string;
    status: string;
    billingPeriod: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  };
  usage: {
    invoicesThisMonth: number;
    monthlyVolume: number;
    lastResetDate: Date;
  };
  preferences: {
    currency: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      invoiceReminders: boolean;
      paymentNotifications: boolean;
    };
  };
}

/**
 * Get paginated list of users (admin only)
 */
export async function getAdminUsers(
  page: number = 1,
  limit: number = 10
): Promise<{ 
  success: boolean; 
  data?: { 
    users: AdminUserListItem[]; 
    pagination: { 
      total: number; 
      page: number; 
      limit: number; 
      totalPages: number 
    } 
  }; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    const skip = (page - 1) * limit;
    const total = await db.collection('users').countDocuments();
    const totalPages = Math.ceil(total / limit);

    const users = await db.collection('users')
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const formattedUsers: AdminUserListItem[] = users.map((user: any) => ({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      adminTag: user.adminTag || false,
      role: user.role || 'user',
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      isEmailVerified: user.isEmailVerified || false,
      planId: user.subscription?.planId || 'receivables-free',
      subscriptionStatus: user.subscription?.status || 'active',
      onboardingCompleted: user.onboarding?.isCompleted || false,
      onboardingStep: user.onboarding?.currentStep || 0,
      organizationId: user.organizationId?.toString(),
      services: {
        smartInvoicing: user.services?.smartInvoicing || false,
        accountsReceivable: user.services?.accountsReceivable || false,
        accountsPayable: user.services?.accountsPayable || false
      }
    }));

    return {
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch users'
    };
  }
}

/**
 * Get detailed user information (admin only)
 */
export async function getAdminUserDetail(
  userId: string
): Promise<{ 
  success: boolean; 
  data?: AdminUserDetail; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const userDetail: AdminUserDetail = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      adminTag: user.adminTag || false,
      role: user.role || 'user',
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      isEmailVerified: user.isEmailVerified || false,
      planId: user.subscription?.planId || 'receivables-free',
      subscriptionStatus: user.subscription?.status || 'active',
      onboardingCompleted: user.onboarding?.isCompleted || false,
      onboardingStep: user.onboarding?.currentStep || 0,
      organizationId: user.organizationId?.toString(),
      services: {
        smartInvoicing: user.services?.smartInvoicing || false,
        accountsReceivable: user.services?.accountsReceivable || false,
        accountsPayable: user.services?.accountsPayable || false
      },
      subscription: {
        planId: user.subscription?.planId || 'receivables-free',
        status: user.subscription?.status || 'active',
        billingPeriod: user.subscription?.billingPeriod || 'monthly',
        currentPeriodStart: user.subscription?.currentPeriodStart,
        currentPeriodEnd: user.subscription?.currentPeriodEnd
      },
      usage: {
        invoicesThisMonth: user.usage?.invoicesThisMonth || 0,
        monthlyVolume: user.usage?.monthlyVolume || 0,
        lastResetDate: user.usage?.lastResetDate || new Date()
      },
      preferences: {
        currency: user.preferences?.currency || 'USD',
        timezone: user.preferences?.timezone || 'UTC',
        notifications: {
          email: user.preferences?.notifications?.email ?? true,
          push: user.preferences?.notifications?.push ?? false,
          invoiceReminders: user.preferences?.notifications?.invoiceReminders ?? true,
          paymentNotifications: user.preferences?.notifications?.paymentNotifications ?? true
        }
      }
    };

    return {
      success: true,
      data: userDetail
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user details'
    };
  }
}

/**
 * Update user information (admin only)
 */
export async function updateAdminUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    role?: 'user' | 'admin';
    adminTag?: boolean;
    planId?: string;
    subscriptionStatus?: string;
    isEmailVerified?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email.toLowerCase().trim();
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.adminTag !== undefined) updateData.adminTag = updates.adminTag;
    if (updates.isEmailVerified !== undefined) updateData.isEmailVerified = updates.isEmailVerified;
    if (updates.planId !== undefined) {
      updateData['subscription.planId'] = updates.planId;
      updateData['subscription.updatedAt'] = new Date();
    }
    if (updates.subscriptionStatus !== undefined) {
      updateData['subscription.status'] = updates.subscriptionStatus;
      updateData['subscription.updatedAt'] = new Date();
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user'
    };
  }
}

/**
 * Delete user (admin only)
 */
export async function deleteAdminUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    // Prevent admin from deleting themselves
    if (adminUser._id.toString() === userId) {
      return {
        success: false,
        error: 'You cannot delete your own account'
      };
    }

    await db.collection('users').deleteOne({
      _id: new ObjectId(userId)
    });

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user'
    };
  }
}

/**
 * Send password reset email to user (admin only)
 */
export async function sendPasswordResetEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Unauthorized'
      };
    }

    // Check if user is admin
    const db = await getDatabase();
    const adminUser = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!adminUser || !adminUser.adminTag) {
      return {
        success: false,
        error: 'Admin access required'
      };
    }

    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // Token expires in 1 hour

    // Save token to database
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        }
      }
    );

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Password Reset Request - Admin Initiated',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>An administrator has initiated a password reset for your account.</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
          <p>Or copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request this, please contact support immediately.</p>
          <p>Best regards,<br>The Admin Team</p>
        </div>
      `
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send password reset email'
    };
  }
}

