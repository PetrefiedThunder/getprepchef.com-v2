/**
 * Notification Service
 * Handles email and SMS notifications via SendGrid and Twilio
 */

import sgMail from '@sendgrid/mail';
import twilio, { Twilio } from 'twilio';
import { logger } from '../../config/logger';
import { Vendor } from '../vendors/vendor.model';
import { VerificationRun } from '../verification/verification_run.model';
import { VendorDocument } from '../vendors/vendor_document.model';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface SMSOptions {
  to: string;
  body: string;
  from?: string;
}

interface VerificationCompleteNotification {
  vendor_id: string;
  verification_run_id: string;
  status: 'verified' | 'needs_review' | 'failed';
}

interface DocumentExpiringNotification {
  vendor_id: string;
  document_id: string;
  document_type: string;
  expires_in_days: number;
}

export class NotificationService {
  private twilioClient: Twilio | null = null;
  private sendgridConfigured: boolean = false;
  private twilioConfigured: boolean = false;

  constructor() {
    // Initialize SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      this.sendgridConfigured = true;
      logger.info('SendGrid configured successfully');
    } else {
      logger.warn('SendGrid API key not configured - email notifications disabled');
    }

    // Initialize Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (twilioAccountSid && twilioAuthToken) {
      this.twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      this.twilioConfigured = true;
      logger.info('Twilio configured successfully');
    } else {
      logger.warn('Twilio credentials not configured - SMS notifications disabled');
    }
  }

  /**
   * Send email notification
   * @param options Email configuration
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.sendgridConfigured) {
      logger.warn('SendGrid not configured - skipping email');
      return;
    }

    const { to, subject, html, text, from } = options;

    try {
      const msg = {
        to,
        from: from || process.env.SENDGRID_FROM_EMAIL || 'notifications@prepchef.com',
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      await sgMail.send(msg);
      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification
   * @param options SMS configuration
   */
  async sendSMS(options: SMSOptions): Promise<void> {
    if (!this.twilioConfigured || !this.twilioClient) {
      logger.warn('Twilio not configured - skipping SMS');
      return;
    }

    const { to, body, from } = options;

    try {
      const message = await this.twilioClient.messages.create({
        body,
        from: from || process.env.TWILIO_PHONE_NUMBER || '+15555555555',
        to,
      });

      logger.info(`SMS sent to ${to}: ${message.sid}`);
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Send verification complete notification
   * @param notification Verification complete details
   */
  async notifyVerificationComplete(
    notification: VerificationCompleteNotification
  ): Promise<void> {
    const { vendor_id, verification_run_id, status } = notification;

    try {
      // Get vendor details
      const vendor = await Vendor.findById(vendor_id).populate('kitchen_id');
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Get verification run details
      const verificationRun = await VerificationRun.findById(verification_run_id);
      if (!verificationRun) {
        throw new Error('Verification run not found');
      }

      // Determine message based on status
      let statusMessage = '';
      let statusColor = '';

      switch (status) {
        case 'verified':
          statusMessage = '✅ Verified - All requirements met!';
          statusColor = '#10b981'; // green
          break;
        case 'needs_review':
          statusMessage = '⚠️ Needs Review - Some items require attention';
          statusColor = '#f59e0b'; // amber
          break;
        case 'failed':
          statusMessage = '❌ Failed - Missing critical requirements';
          statusColor = '#ef4444'; // red
          break;
      }

      // Email notification
      if (vendor.contact_email) {
        await this.sendEmail({
          to: vendor.contact_email,
          subject: `Verification Complete: ${vendor.business_name}`,
          html: this.getVerificationCompleteEmailTemplate({
            vendor_name: vendor.business_name,
            status_message: statusMessage,
            status_color: statusColor,
            verification_url: `${process.env.FRONTEND_URL}/vendors/${vendor_id}/verification/${verification_run_id}`,
            passed_count: verificationRun.passed_count,
            failed_count: verificationRun.failed_count,
            total_count: verificationRun.total_checks,
          }),
        });
      }

      // SMS notification (only for critical statuses)
      if (vendor.contact_phone && status === 'failed') {
        await this.sendSMS({
          to: vendor.contact_phone,
          body: `PrepChef Alert: Verification failed for ${vendor.business_name}. Please review missing requirements at prepchef.com`,
        });
      }
    } catch (error) {
      logger.error('Error sending verification complete notification:', error);
      throw error;
    }
  }

  /**
   * Send document expiring notification
   * @param notification Document expiring details
   */
  async notifyDocumentExpiring(
    notification: DocumentExpiringNotification
  ): Promise<void> {
    const { vendor_id, document_id, document_type, expires_in_days } = notification;

    try {
      // Get vendor details
      const vendor = await Vendor.findById(vendor_id);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Get document details
      const document = await VendorDocument.findById(document_id);
      if (!document) {
        throw new Error('Document not found');
      }

      const urgencyLevel =
        expires_in_days <= 7 ? 'Urgent' : expires_in_days <= 30 ? 'Soon' : 'Upcoming';

      // Email notification
      if (vendor.contact_email) {
        await this.sendEmail({
          to: vendor.contact_email,
          subject: `${urgencyLevel}: Document Expiring - ${document_type}`,
          html: this.getDocumentExpiringEmailTemplate({
            vendor_name: vendor.business_name,
            document_type,
            expires_in_days,
            urgency_level: urgencyLevel,
            renewal_url: `${process.env.FRONTEND_URL}/vendors/${vendor_id}/documents`,
          }),
        });
      }

      // SMS notification (only for urgent expiration)
      if (vendor.contact_phone && expires_in_days <= 7) {
        await this.sendSMS({
          to: vendor.contact_phone,
          body: `URGENT: Your ${document_type} expires in ${expires_in_days} days. Renew at prepchef.com to maintain compliance.`,
        });
      }
    } catch (error) {
      logger.error('Error sending document expiring notification:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new vendor
   * @param vendor_id Vendor ID
   */
  async sendWelcomeEmail(vendor_id: string): Promise<void> {
    try {
      const vendor = await Vendor.findById(vendor_id).populate('kitchen_id');
      if (!vendor || !vendor.contact_email) {
        return;
      }

      await this.sendEmail({
        to: vendor.contact_email,
        subject: 'Welcome to PrepChef! 🎉',
        html: this.getWelcomeEmailTemplate({
          vendor_name: vendor.business_name,
          dashboard_url: `${process.env.FRONTEND_URL}/vendors/${vendor_id}`,
        }),
      });
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }

  /**
   * Email Template: Verification Complete
   */
  private getVerificationCompleteEmailTemplate(data: {
    vendor_name: string;
    status_message: string;
    status_color: string;
    verification_url: string;
    passed_count: number;
    failed_count: number;
    total_count: number;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Complete</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h1 style="color: #1f2937; margin-bottom: 20px;">PrepChef Verification Complete</h1>

    <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="color: ${data.status_color}; margin-top: 0;">${data.status_message}</h2>
      <p><strong>Vendor:</strong> ${data.vendor_name}</p>

      <div style="margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Verification Results:</strong></p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 5px 0;">✅ Passed: ${data.passed_count}</li>
          <li style="margin: 5px 0;">❌ Failed: ${data.failed_count}</li>
          <li style="margin: 5px 0;">📊 Total Checks: ${data.total_count}</li>
        </ul>
      </div>

      <a href="${data.verification_url}"
         style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
        View Full Report
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      Questions? Contact us at support@prepchef.com
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Email Template: Document Expiring
   */
  private getDocumentExpiringEmailTemplate(data: {
    vendor_name: string;
    document_type: string;
    expires_in_days: number;
    urgency_level: string;
    renewal_url: string;
  }): string {
    const urgencyColor =
      data.urgency_level === 'Urgent' ? '#ef4444' : data.urgency_level === 'Soon' ? '#f59e0b' : '#3b82f6';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Expiring</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h1 style="color: ${urgencyColor}; margin-bottom: 20px;">⏰ Document Expiring ${data.urgency_level}</h1>

    <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p><strong>Vendor:</strong> ${data.vendor_name}</p>
      <p><strong>Document Type:</strong> ${data.document_type}</p>
      <p><strong>Expires In:</strong> ${data.expires_in_days} days</p>

      <div style="background-color: #fef3c7; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Action Required:</strong></p>
        <p style="margin: 10px 0 0 0;">Please renew this document before expiration to maintain compliance and avoid verification failures.</p>
      </div>

      <a href="${data.renewal_url}"
         style="display: inline-block; background-color: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
        Upload Renewed Document
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      Need help? Contact us at support@prepchef.com
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Email Template: Welcome
   */
  private getWelcomeEmailTemplate(data: {
    vendor_name: string;
    dashboard_url: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PrepChef</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h1 style="color: #1f2937; margin-bottom: 20px;">Welcome to PrepChef! 🎉</h1>

    <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p>Hi ${data.vendor_name},</p>

      <p>Welcome to PrepChef - your automated compliance verification platform!</p>

      <p><strong>What's Next?</strong></p>
      <ul>
        <li>Upload your compliance documents</li>
        <li>Run your first verification check</li>
        <li>Track expiration dates automatically</li>
        <li>Receive real-time compliance updates</li>
      </ul>

      <a href="${data.dashboard_url}"
         style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
        Go to Dashboard
      </a>
    </div>

    <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0;"><strong>💡 Pro Tip:</strong></p>
      <p style="margin: 10px 0 0 0;">Set up automatic verification to stay compliant without lifting a finger!</p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      Questions? We're here to help at support@prepchef.com
    </p>
  </div>
</body>
</html>
    `;
  }
}

export default new NotificationService();
