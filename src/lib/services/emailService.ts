import * as nodemailer from 'nodemailer';

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Boolean(process.env.SMTP_SECURE), 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);



// Get frontend URL based on environment
const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_URL || process.env.FRONTEND_URL;
  }
  return 'http://localhost:3000';
};

// Function to get email headers for profile picture support
const getEmailHeaders = () => {
  return {
    'X-Profile-Picture': 'https://chains-erp.com/chainsnobg.png',
    'X-Organization': 'Chains ERP-Global',
    'X-Organization-Logo': 'https://chains-erp.com/chainsnobg.png'
  };
};

// Test email configuration
export const testEmailConnection = async () => {
  try {
    console.log('📧 [Email Service] Testing SMTP connection...');
    const startTime = Date.now();
    await transporter.verify();
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log('✅ Email service is ready (connection test took', duration, 'ms)');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error);
    return false;
  }
};

// Send notification preferences confirmation email
export const sendNotificationPreferencesConfirmation = async (
  userEmail: string,
  userName: string,
  organizationName: string,
  enabledNotifications: string[]
) => {
  const mailOptions = {
    from: `"Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: userEmail,
    subject: `Notification Preferences Updated - ${organizationName}`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Notification Preferences Updated</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your email notifications are now active</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            You have successfully enabled email notifications for your ${organizationName} account. 
            You will now receive email notifications for the following events:
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #333; margin-top: 0;">Enabled Notifications</h3>
            <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
              ${enabledNotifications.map(notification => `<li>${notification}</li>`).join('')}
            </ul>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ Important Notice</h4>
            <p style="color: #856404; margin: 0; font-size: 14px;">
              If you did not intend to enable these notifications, you can disable them at any time by going to:
            </p>
            <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">
              <strong>Settings → Notifications → Email Preferences</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${getFrontendUrl()}/dashboard/settings/notifications" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Manage Notification Settings
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Note:</strong> You can customize which notifications you receive and how often you receive them.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Chains ERP-Global</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Notification Preferences Updated

Hello ${userName},

You have successfully enabled email notifications for your ${organizationName} account. 
You will now receive email notifications for the following events:

${enabledNotifications.map(notification => `- ${notification}`).join('\n')}

⚠️ Important Notice:
If you did not intend to enable these notifications, you can disable them at any time by going to:
Settings → Notifications → Email Preferences

Manage your notification settings: ${getFrontendUrl()}/dashboard/settings/notifications

Note: You can customize which notifications you receive and how often you receive them.

Best regards,
The Chains ERP-Global Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Notification preferences confirmation email sent successfully');
    console.log('📧 Email details:', {
      messageId: info.messageId,
      to: userEmail,
      subject: mailOptions.subject,
      enabledNotifications,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send notification preferences confirmation email:', error);
    return { success: false, error: error as Error };
  }
};

// Send invoice notification email
export const sendInvoiceNotification = async (
  userEmail: string,
  clientName: string,
  invoiceNumber: string,
  invoiceAmount: number,
  currency: string,
  dueDate: string,
  companyName: string,
  recipientName: string,
  invoiceUrl: string,
  paymentMethods: string[],
  pdfBuffer?: Buffer,
  additionalAttachments?: Array<{ filename: string; content: Buffer; contentType: string }>
) => {
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${companyName || 'Chains ERP-Global'} via Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: userEmail,
    subject: `Invoice #${invoiceNumber} from ${companyName || 'Chains ERP-Global'}`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Invoice</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice #${invoiceNumber} from ${companyName || 'Chains ERP-Global'}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${clientName},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            You have received an invoice from <strong>${companyName || 'Chains ERP-Global'}</strong>.
          </p>
          
          <p style="color: #666; line-height: 1.6;">
            This invoice is intended for <strong>${recipientName}</strong>.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">Invoice Details</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Amount:</strong> ${currency} ${invoiceAmount.toFixed(2)}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Payment Methods:</strong> ${paymentMethods.join(', ')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invoiceUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              View & Pay Invoice Online
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Note:</strong> This invoice supports both traditional and cryptocurrency payments.
            </p>
            
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
              The invoice PDF is attached to this email for your records.
            </p>
            
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
              If you have any questions about this invoice, please contact ${companyName || 'Chains ERP-Global'}.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Chains ERP-Global</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Invoice from ${companyName || 'Chains ERP-Global'}

Hello ${clientName},

You have received an invoice from ${companyName || 'Chains ERP-Global'}.

This invoice is intended for ${recipientName}.

Invoice Details:
Invoice Number: ${invoiceNumber}
Amount: ${currency} ${invoiceAmount.toFixed(2)}
Due Date: ${dueDate}
Payment Methods: ${paymentMethods.join(', ')}

View and pay your invoice online: ${invoiceUrl}

This invoice supports both traditional and cryptocurrency payments.

The invoice PDF is attached to this email for your records.

If you have any questions about this invoice, please contact ${companyName || 'Chains ERP-Global'}.

Best regards,
The Chains ERP-Global Team
    `,
  };

  // Add PDF attachment if provided
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  
  if (pdfBuffer) {
    attachments.push({
      filename: `Invoice-${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    });
  }
  
  // Add additional attachments if provided
  if (additionalAttachments && additionalAttachments.length > 0) {
    attachments.push(...additionalAttachments);
  }
  
  if (attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    console.log('📧 [Email Service] Starting to send invoice notification email...');
    console.log('📧 [Email Service] Email details:', {
      to: userEmail,
      subject: mailOptions.subject,
      hasPdfAttachment: !!pdfBuffer,
      pdfSize: pdfBuffer ? `${(pdfBuffer.length / 1024).toFixed(2)} KB` : 'N/A',
      additionalAttachmentsCount: additionalAttachments?.length || 0,
      totalAttachmentsCount: attachments.length
    });
    
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Invoice notification email sent successfully');
    console.log('📧 [Email Service] Email sent in', duration, 'ms');
    console.log('📧 [Email Service] Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send invoice notification email:', error);
    
    // Provide more specific error information
    let errorMessage = 'Unknown email error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'SMTP connection refused - check server configuration';
      } else if (error.message.includes('EAUTH')) {
        errorMessage = 'SMTP authentication failed - check credentials';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'SMTP connection timed out - check network connectivity';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'SMTP host not found - check SMTP_HOST configuration';
      }
    }
    
    return { success: false, error: new Error(errorMessage) };
  }
};

// Send approval request email
export const sendApprovalRequest = async (
  approverEmail: string,
  approverName: string,
  requesterName: string,
  requestType: string,
  requestTitle: string,
  requestDescription: string,
  requestId: string,
  urgency: 'low' | 'medium' | 'high' = 'medium',
  dueDate?: string
) => {
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#ffc107';
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'High Priority';
      case 'medium': return 'Medium Priority';
      case 'low': return 'Low Priority';
      default: return 'Medium Priority';
    }
  };

  const mailOptions = {
    from: `"Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: approverEmail,
    subject: `Approval Request: ${requestTitle} - ${getUrgencyText(urgency)}`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Approval Request</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Action required from ${requesterName}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${approverName},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            <strong>${requesterName}</strong> has submitted an approval request that requires your attention.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${getUrgencyColor(urgency)};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="color: #333; margin: 0;">${requestTitle}</h3>
              <span style="background: ${getUrgencyColor(urgency)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${getUrgencyText(urgency)}
              </span>
            </div>
            
            <p style="color: #666; margin: 5px 0;"><strong>Request Type:</strong> ${requestType}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Request ID:</strong> ${requestId}</p>
            ${dueDate ? `<p style="color: #666; margin: 5px 0;"><strong>Due Date:</strong> ${dueDate}</p>` : ''}
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
              <h4 style="color: #333; margin-top: 0;">Description</h4>
              <p style="color: #666; line-height: 1.6; margin: 0;">${requestDescription}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${getFrontendUrl()}/dashboard/approvals/${requestId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Review & Approve
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Note:</strong> You can approve, reject, or request more information for this request.
            </p>
            
            ${urgency === 'high' ? '<p style="color: #dc3545; font-size: 14px; margin: 10px 0 0 0;"><strong>⚠️ High Priority:</strong> This request requires immediate attention.</p>' : ''}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Chains ERP-Global</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Approval Request

Hello ${approverName},

${requesterName} has submitted an approval request that requires your attention.

Request Details:
Title: ${requestTitle}
Type: ${requestType}
Request ID: ${requestId}
Priority: ${getUrgencyText(urgency)}
${dueDate ? `Due Date: ${dueDate}` : ''}

Description:
${requestDescription}

Review and approve: ${getFrontendUrl()}/dashboard/approvals/${requestId}

Note: You can approve, reject, or request more information for this request.
${urgency === 'high' ? '⚠️ High Priority: This request requires immediate attention.' : ''}

Best regards,
The Chains ERP-Global Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Approval request email sent successfully');
    console.log('📧 Approval request email details:', {
      messageId: info.messageId,
      to: approverEmail,
      subject: mailOptions.subject,
      requestId,
      urgency,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send approval request email:', error);
    return { success: false, error: error as Error };
  }
};

// Send approval status update email
export const sendApprovalStatusUpdate = async (
  requesterEmail: string,
  requesterName: string,
  approverName: string,
  requestTitle: string,
  requestId: string,
  status: 'approved' | 'rejected' | 'pending',
  comments?: string
) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending Review';
      default: return 'Updated';
    }
  };

  const mailOptions = {
    from: `"Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: requesterEmail,
    subject: `Approval Update: ${requestTitle} - ${getStatusText(status)}`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Approval Update</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your request has been ${status === 'pending' ? 'reviewed' : status}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${requesterName},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Your approval request has been reviewed by <strong>${approverName}</strong>.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${getStatusColor(status)};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="color: #333; margin: 0;">${requestTitle}</h3>
              <span style="background: ${getStatusColor(status)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${getStatusText(status)}
              </span>
            </div>
            
            <p style="color: #666; margin: 5px 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Reviewed by:</strong> ${approverName}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            
            ${comments ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
              <h4 style="color: #333; margin-top: 0;">Comments</h4>
              <p style="color: #666; line-height: 1.6; margin: 0;">${comments}</p>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${getFrontendUrl()}/dashboard/approvals/${requestId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              View Request Details
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Note:</strong> You can view the full details and any additional comments in the system.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Chains ERP-Global</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Approval Update

Hello ${requesterName},

Your approval request has been reviewed by ${approverName}.

Request Details:
Title: ${requestTitle}
Request ID: ${requestId}
Status: ${getStatusText(status)}
Reviewed by: ${approverName}
Date: ${new Date().toLocaleDateString()}

${comments ? `Comments: ${comments}` : ''}

View request details: ${getFrontendUrl()}/dashboard/approvals/${requestId}

Note: You can view the full details and any additional comments in the system.

Best regards,
The Chains ERP-Global Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Approval status update email sent successfully');
    console.log('📧 Approval status email details:', {
      messageId: info.messageId,
      to: requesterEmail,
      subject: mailOptions.subject,
      requestId,
      status,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send approval status update email:', error);
    return { success: false, error: error as Error };
  }
};

// Send general app notification email
export const sendAppNotification = async (
  userEmail: string,
  userName: string,
  notificationTitle: string,
  notificationMessage: string,
  notificationType: 'invoice' | 'payment' | 'system' | 'user' | 'finance' | 'inventory' | 'meeting' | 'task' | 'approval' | 'general',
  actionUrl?: string,
  organizationName?: string
) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice': return '📄';
      case 'payment': return '💰';
      case 'system': return '⚙️';
      case 'user': return '👤';
      case 'finance': return '💳';
      case 'inventory': return '📦';
      case 'meeting': return '📅';
      case 'task': return '✅';
      case 'approval': return '📋';
      default: return '🔔';
    }
  };

  const mailOptions = {
    from: `"Chains ERP-Global${organizationName ? ` - ${organizationName}` : ''}" <${emailConfig.auth.user}>`,
    to: userEmail,
    subject: `Chains ERP-Global Notification: ${notificationTitle}`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">New Notification</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">You have a new notification in Chains ERP-Global</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName},</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <span style="font-size: 24px; margin-right: 10px;">${getNotificationIcon(notificationType)}</span>
              <h3 style="color: #333; margin: 0;">${notificationTitle}</h3>
            </div>
            <p style="color: #666; line-height: 1.6; margin: 0;">${notificationMessage}</p>
          </div>
          
          ${actionUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${getFrontendUrl()}${actionUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              View Details
            </a>
          </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>Note:</strong> You can manage your notification preferences in the Chains ERP-Global system.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is an automated message from Chains ERP-Global</p>
          <p>Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Chains ERP-Global Notification

Hello ${userName},

You have a new notification:

${notificationTitle}

${notificationMessage}

${actionUrl ? `View details: ${getFrontendUrl()}${actionUrl}` : ''}

Best regards,
The Chains ERP-Global Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ App notification email sent successfully');
    console.log('📧 App notification email details:', {
      messageId: info.messageId,
      to: userEmail,
      subject: mailOptions.subject,
      notificationType,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send app notification email:', error);
    return { success: false, error: error as Error };
  }
};

// Send test email
export const sendTestEmail = async (toEmail: string) => {
  const mailOptions = {
    from: `"Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: toEmail,
    subject: 'Test Email from Chains ERP-Global System',
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
                 alt="Chains ERP-Global Logo" 
                 style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Chains ERP-Global Test Email</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Email Service Test</h2>
          <p style="color: #666; line-height: 1.6;">
            This is a test email to verify that the Chains ERP-Global email service is working correctly.
          </p>
          <p style="color: #666; line-height: 1.6;">
            If you received this email, the nodemailer configuration is working properly!
          </p>
          <p style="color: #666; line-height: 1.6;">
            <strong>Sent at:</strong> ${new Date().toLocaleString()}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This is a test message from Chains ERP-Global</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    return { success: false, error: error as Error };
  }
}; 