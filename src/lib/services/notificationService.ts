import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';
import { ApprovalWorkflow } from '@/types/approval';

export class NotificationService {
  private static transporter: nodemailer.Transporter | null = null;

  // Initialize email transporter
  private static async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  // Send invoice approval request notification
  static async sendInvoiceApprovalRequest(
    approverEmail: string,
    approverName: string,
    invoiceDetails: {
      invoiceNumber: string;
      invoiceName: string;
      amount: number;
      currency: string;
      clientName: string;
      clientEmail: string;
      dueDate: string;
    },
    organizationName: string,
    createdByName: string
  ): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      // Generate approval URL with fallback for localhost
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalUrl = `${baseUrl}/dashboard/approvals`;
      
      const mailOptions = {
        from: `"${organizationName}" <${process.env.SMTP_USER}>`,
        to: approverEmail,
        subject: `Invoice Approval Required: ${invoiceDetails.invoiceName} by ${createdByName} - ${invoiceDetails.currency} ${invoiceDetails.amount}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Invoice Approval Required</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0;">${organizationName}</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                Hello ${approverName},
              </p>
              
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                <strong>${createdByName}</strong> has created an invoice that requires your approval before it can be sent to the client.
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">Invoice Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Invoice Number:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${invoiceDetails.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Invoice Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${invoiceDetails.invoiceName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Amount:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${invoiceDetails.currency} ${invoiceDetails.amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Client:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${invoiceDetails.clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Client Email:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${invoiceDetails.clientEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Due Date:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${new Date(invoiceDetails.dueDate).toLocaleDateString()}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${approvalUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Review & Approve Invoice
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                Please review this invoice and approve or reject it. Once approved, the invoice will be automatically sent to the client.
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This is an automated notification from ${organizationName}. Please do not reply to this email.
              </p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch {
      return false;
    }
  }

  // Send approval request notification
  static async sendApprovalRequest(
    approverEmail: string,
    approverName: string,
    billDetails: {
      vendor: string;
      amount: number;
      currency: string;
      description: string;
      dueDate: string;
    },
    workflow: ApprovalWorkflow,
    organizationName: string
  ): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      // Generate approval URL with fallback for localhost
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const approvalUrl = `${baseUrl}/dashboard/approvals/${workflow._id}`;
      
      const mailOptions = {
        from: `"${organizationName}" <${process.env.SMTP_USER}>`,
        to: approverEmail,
        subject: `Approval Required: ${billDetails.vendor} - ${billDetails.currency} ${billDetails.amount}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Approval Required</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0;">${organizationName}</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0;">Hello ${approverName},</h2>
              
              <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                A bill requires your approval. Please review the details below and take action.
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e293b; margin: 0 0 15px 0;">Bill Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Vendor:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${billDetails.vendor}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${billDetails.currency} ${billDetails.amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Description:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${billDetails.description}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Due Date:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${new Date(billDetails.dueDate).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Step:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${workflow.currentStep} of ${workflow.approvals.length}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${approvalUrl}" 
                   style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Review & Approve
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                This approval request was generated automatically. If you have any questions, 
                please contact your organization administrator.
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch {
      return false;
    }
  }

  // Send approval decision notification
  static async sendApprovalDecision(
    creatorEmail: string,
    creatorName: string,
    decision: 'approved' | 'rejected',
    billDetails: {
      vendor: string;
      amount: number;
      currency: string;
      description: string;
    },
    approverName: string,
    organizationName: string,
    comments?: string
  ): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      // Generate dashboard URL with fallback for localhost
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardUrl = `${baseUrl}/dashboard`;
      const isApproved = decision === 'approved';
      
      const mailOptions = {
        from: `"${organizationName}" <${process.env.SMTP_USER}>`,
        to: creatorEmail,
        subject: `Bill ${isApproved ? 'Approved' : 'Rejected'}: ${billDetails.vendor} - ${billDetails.currency} ${billDetails.amount}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, ${isApproved ? '#10b981' : '#ef4444'} 0%, ${isApproved ? '#059669' : '#dc2626'} 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">
                Bill ${isApproved ? 'Approved' : 'Rejected'}
              </h1>
              <p style="color: ${isApproved ? '#d1fae5' : '#fee2e2'}; margin: 10px 0 0 0;">${organizationName}</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0;">Hello ${creatorName},</h2>
              
              <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                Your bill has been <strong style="color: ${isApproved ? '#059669' : '#dc2626'};">${decision}</strong> by ${approverName}.
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${isApproved ? '#10b981' : '#ef4444'};">
                <h3 style="color: #1e293b; margin: 0 0 15px 0;">Bill Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Vendor:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${billDetails.vendor}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${billDetails.currency} ${billDetails.amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Description:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${billDetails.description}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Decision:</td>
                    <td style="padding: 8px 0; color: ${isApproved ? '#059669' : '#dc2626'}; font-weight: 600; text-transform: capitalize;">${decision}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Approver:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${approverName}</td>
                  </tr>
                </table>
              </div>
              
              ${comments ? `
                <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <h4 style="color: #1e293b; margin: 0 0 10px 0;">Comments:</h4>
                  <p style="color: #475569; margin: 0; line-height: 1.5;">${comments}</p>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" 
                   style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  View Dashboard
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                ${isApproved 
                  ? 'The bill has been approved and is ready for payment processing.'
                  : 'The bill has been rejected. Please review the comments and resubmit if necessary.'
                }
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch {
      return false;
    }
  }

  // Send payment confirmation notification
  static async sendPaymentConfirmation(
    recipientEmail: string,
    recipientName: string,
    paymentDetails: {
      vendor: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      transactionId: string;
    },
    organizationName: string
  ): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      const mailOptions = {
        from: `"${organizationName}" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Payment Confirmation: ${paymentDetails.vendor} - ${paymentDetails.currency} ${paymentDetails.amount}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Payment Confirmed</h1>
              <p style="color: #d1fae5; margin: 10px 0 0 0;">${organizationName}</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0;">Hello ${recipientName},</h2>
              
              <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                A payment has been successfully processed. Here are the details:
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #1e293b; margin: 0 0 15px 0;">Payment Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Vendor:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${paymentDetails.vendor}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${paymentDetails.currency} ${paymentDetails.amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Payment Method:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${paymentDetails.paymentMethod}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Transaction ID:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-family: monospace;">${paymentDetails.transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Date:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                This payment has been processed and recorded in your organization's financial records.
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch {
      return false;
    }
  }

  // Send organization invitation notification
  static async sendOrganizationInvitation(
    inviteeEmail: string,
    inviteeName: string,
    organizationName: string,
    inviterName: string,
    role: string,
    invitationUrl: string
  ): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      
      const mailOptions = {
        from: `"${organizationName}" <${process.env.SMTP_USER}>`,
        to: inviteeEmail,
        subject: `You're invited to join ${organizationName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0;">${organizationName}</p>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0;">Hello ${inviteeName},</h2>
              
              <p style="color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1e293b; margin: 0 0 15px 0;">Invitation Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Organization:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${organizationName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Role:</td>
                    <td style="padding: 8px 0; color: #1e293b; text-transform: capitalize;">${role}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Invited by:</td>
                    <td style="padding: 8px 0; color: #1e293b;">${inviterName}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" 
                   style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.
              </p>
            </div>
            
            <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
        return true;
    } catch {
      return false;
    }
  }

  // Create in-app notification
  static async createNotification(notificationData: {
    userId: ObjectId;
    organizationId?: ObjectId;
    type: string;
    title: string;
    message: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    actionUrl?: string;
    actionText?: string;
    actionData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tags?: string[];
    expiresAt?: Date;
    relatedInvoiceId?: ObjectId;
    relatedPaymentId?: ObjectId;
    relatedUserId?: ObjectId;
    relatedOrganizationId?: ObjectId;
  }): Promise<{ _id: ObjectId } | null> {
    try {
      const { getDatabase } = await import('@/lib/database');
      const db = await getDatabase();
      
      const notification = {
        userId: notificationData.userId,
        organizationId: notificationData.organizationId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || 'medium',
        status: 'unread' as const,
        actionUrl: notificationData.actionUrl,
        actionText: notificationData.actionText,
        actionData: notificationData.actionData,
        metadata: notificationData.metadata,
        tags: notificationData.tags,
        inAppDelivered: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: notificationData.expiresAt,
        relatedInvoiceId: notificationData.relatedInvoiceId,
        relatedPaymentId: notificationData.relatedPaymentId,
        relatedUserId: notificationData.relatedUserId,
        relatedOrganizationId: notificationData.relatedOrganizationId
      };

      const result = await db.collection('notifications').insertOne(notification);
      
      if (result.insertedId) {
        return { _id: result.insertedId };
      }
      
      return null;
    } catch {
      return null;
    }
  }
} 