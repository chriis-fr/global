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
    const url = process.env.APP_URL || process.env.FRONTEND_URL;
    return url?.startsWith('http') ? url : `https://${url}`;
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
    subject: `New Invoice #${invoiceNumber} from ${companyName || 'Chains ERP-Global Finance'}`,
    headers: getEmailHeaders(),
    html: `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
      </style>
      <div style="font-family: 'Plus Jakarta Sans', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 28px; text-align: left;">
          <img src="https://global.chains-erp.com/chainsnobg.png"
            alt="Chains ERP-Global Logo"
            style="max-width: 80px; height: auto; border-radius: 8px; flex-shrink: 0; margin-right: 8px;">
          <div style="flex: 1;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;">New Invoice</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.95; font-size: 16px; font-weight: 500; letter-spacing: 0.01em;">From ${companyName || 'Chains ERP-Global'}</p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 22px; border-radius: 8px; margin: 0 0 24px 0; border-left: 4px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <p style="color: #1a1a2e; margin: 0 0 8px 0; font-size: 15px; font-weight: 500; line-height: 1.5; letter-spacing: 0.01em;"><strong style="font-weight: 600;">Invoice #:</strong> ${invoiceNumber}</p>
            <p style="color: #1a1a2e; margin: 0 0 8px 0; font-size: 15px; font-weight: 500; line-height: 1.5; letter-spacing: 0.01em;"><strong style="font-weight: 600;">Amount Due:</strong> ${currency} ${invoiceAmount.toFixed(2)}</p>
            <p style="color: #1a1a2e; margin: 0 0 8px 0; font-size: 15px; font-weight: 500; line-height: 1.5; letter-spacing: 0.01em;"><strong style="font-weight: 600;">Due Date:</strong> ${dueDate}</p>
            <p style="color: #1a1a2e; margin: 0; font-size: 15px; font-weight: 500; line-height: 1.5; letter-spacing: 0.01em;"><strong style="font-weight: 600;">Payment Methods:</strong> ${paymentMethods.join(', ')}</p>
          </div>

          <p style="color: #4a5568; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6; letter-spacing: 0.01em; font-weight: 400;">A PDF copy is attached to this email for your records.</p>
          <p style="color: #4a5568; font-size: 15px; margin: 0 0 12px 0; line-height: 1.6; letter-spacing: 0.01em; font-weight: 400;">This invoice will be added to your account if you sign up using this email.</p>


          ${invoiceUrl ? `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${invoiceUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.02em;">Pay Invoice online(optional)</a>
          </div>
          ` : ''}

          <p style="color: #4a5568; font-size: 14px; margin: 0; line-height: 1.6; letter-spacing: 0.01em;">For questions regarding this invoice, please contact ${companyName || 'Chains ERP-Global Finance'}.</p>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 500; letter-spacing: 0.02em;">
          <p style="margin: 0 0 4px 0;">This is an automated message from Chains ERP-Global Finance</p>
          <p style="margin: 0;">Please do not reply to this email</p>
        </div>
      </div>
    `,
    text: `
Invoice from ${companyName || 'Chains ERP-Global Finance'}

Invoice #: ${invoiceNumber}
Amount Due: ${currency} ${invoiceAmount.toFixed(2)}
Due Date: ${dueDate}
Payment Methods: ${paymentMethods.join(', ')}

This invoice has been added to your account.
A PDF copy is attached for your records.
${invoiceUrl ? `\nPay online: ${invoiceUrl}\n` : ''}

For questions regarding this invoice, please contact ${companyName || 'Chains ERP-Global Finance'}.

—
This is an automated message from Chains ERP-Global Finance
Please do not reply to this email
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
    
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Invoice notification email sent successfully (took', duration, 'ms)');
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

// Send organization invitation email
export const sendOrganizationInvitation = async (
  inviteeEmail: string,
  organizationName: string,
  inviterName: string,
  role: string,
  invitationLink: string,
  expiresAt: Date
) => {
  const mailOptions = {
    from: `"${organizationName} via Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: inviteeEmail,
    subject: `You're invited to join ${organizationName} on Chains ERP-Global!`,
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">You're Invited!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Join ${organizationName} on Chains ERP-Global</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello,</h2>
          
          <p style="color: #666; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong> on Chains ERP-Global.
          </p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="color: #155724; margin: 0; font-weight: bold;">
              🎉 You're invited to join the team!
            </p>
            <p style="color: #155724; margin: 5px 0 0 0; font-size: 14px;">
              Click the button below to accept your invitation and get started.
            </p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">Invitation Details</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Organization:</strong> ${organizationName}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Role:</strong> ${role}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Invited by:</strong> ${inviterName}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Expires:</strong> ${expiresAt.toLocaleDateString()}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Accept Invitation
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ Important</h4>
            <p style="color: #856404; margin: 0; font-size: 14px;">
              This invitation will expire on ${expiresAt.toLocaleDateString()}. Please accept it before then.
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              <strong>What's next?</strong> After accepting, you'll be able to access your organization's dashboard and start collaborating with your team.
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
You're invited to join ${organizationName} on Chains ERP-Global!

Hello,

${inviterName} has invited you to join ${organizationName} as a ${role} on Chains ERP-Global.

🎉 You're invited to join the team!

Invitation Details:
Organization: ${organizationName}
Role: ${role}
Invited by: ${inviterName}
Expires: ${expiresAt.toLocaleDateString()}

Accept your invitation: ${invitationLink}

⚠️ Important: This invitation will expire on ${expiresAt.toLocaleDateString()}. Please accept it before then.

What's next? After accepting, you'll be able to access your organization's dashboard and start collaborating with your team.

Best regards,
The Chains ERP-Global Team
    `,
  };

  try {
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Organization invitation email sent successfully (took', duration, 'ms)');
    console.log('📧 Invitation email details:', {
      messageId: info.messageId,
      to: inviteeEmail,
      subject: mailOptions.subject,
      organization: organizationName,
      role,
      invitationLink,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send organization invitation email:', error);
    
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

// Send password reset email
export const sendPasswordResetEmail = async (
  userEmail: string,
  userName: string,
  resetToken: string
): Promise<{ success: boolean; messageId?: string; error?: Error }> => {
  const frontendUrl = getFrontendUrl();
  const resetLink = `${frontendUrl}/auth?resetToken=${resetToken}`;

  const mailOptions = {
    from: `"Chains ERP-Global" <${emailConfig.auth.user}>`,
    to: userEmail,
    subject: 'Reset Your Password - Chains ERP-Global',
    headers: getEmailHeaders(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="margin-bottom: 20px;">
            <img src="https://chains-erp.com/chainsnobg.png" 
              alt="Chains ERP-Global Logo" 
              style="max-width: 150px; height: auto; border-radius: 8px;">
          </div>
          <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">We received a request to reset your password</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName},</h2>
          
          <p style="color: #666; line-height: 1.6;">
            You requested to reset your password for your Chains ERP-Global account. 
            Click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 14px 28px; text-decoration: none; 
                      border-radius: 6px; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="color: #667eea; word-break: break-all; font-size: 12px; background: white; padding: 10px; border-radius: 4px;">
            ${resetLink}
          </p>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ Important Security Notice</h4>
            <ul style="color: #856404; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
              <li>This link will expire in <strong>1 hour</strong></li>
              <li>If you didn't request this, you can safely ignore this email</li>
              <li>Your current password will remain valid until you complete the reset</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          
          <div style="background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #1976D2; margin: 0; font-size: 14px;">
              <strong>Remember your password?</strong> You can still log in with your current password. 
              This reset link will only be used if you complete the password reset process.
            </p>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            If you're having trouble clicking the button, copy and paste the URL above into your web browser.
            <br><br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </div>
    `,
    text: `
Password Reset Request - Chains ERP-Global

Hello ${userName},

You requested to reset your password for your Chains ERP-Global account.

Click this link to reset your password:
${resetLink}

⚠️ Important:
- This link will expire in 1 hour
- If you didn't request this, you can safely ignore this email
- Your current password will remain valid until you complete the reset
- Never share this link with anyone

Remember your password? You can still log in with your current password. 
This reset link will only be used if you complete the password reset process.

This is an automated message, please do not reply to this email.
    `,
  };

  try {
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Password reset email sent successfully (took', duration, 'ms)');
    console.log('📧 Password reset email details:', {
      messageId: info.messageId,
      to: userEmail,
      subject: mailOptions.subject,
      previewUrl: nodemailer.getTestMessageUrl(info),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    
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