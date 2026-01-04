import { Resend } from 'resend';

class EmailService {
  constructor() {
    // Only initialize Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.isConfigured = true;
    } else {
      this.resend = null;
      this.isConfigured = false;
    }

    // Verify configuration on startup
    this.verifyConfiguration();
  }

  verifyConfiguration() {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️  WARNING: RESEND_API_KEY is not set - Email service disabled');
    } else {
      console.log('✅ Resend email service initialized');
      console.log('📧 Email from:', process.env.EMAIL_FROM || 'Elevate <onboarding@resend.dev>');
    }
  }

  // ============ SUBSCRIPTION REMINDER EMAILS ============

  async sendReminderEmail(user, reminderType, remainingDays) {
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping reminder email');
      return { success: false, error: 'Email service not configured' };
    }

    const template = this.getEmailTemplate(reminderType, user, remainingDays);

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Elevate <onboarding@resend.dev>',
        to: [user.email],
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      if (error) {
        console.error(' Resend error:', error);
        return { success: false, error: error.message };
      }

      console.log('Reminder email sent successfully via Resend');
      console.log('Email ID:', data.id);
      return { success: true, messageId: data.id, provider: 'resend' };
    } catch (error) {
      console.error(' Error sending reminder email:', error);
      return { success: false, error: error.message };
    }
  }

  getEmailTemplate(reminderType, user, remainingDays) {
    const expiryDate = this.calculateExpiryDate(user.subscription.paymentDate);
    const renewalLink = `${process.env.FRONTEND_URL}/subscription/renew`;

    const templates = {
      '7day_reminder': {
        subject: 'Your Elevate Subscription Expires in 7 Days',
        html: this.get7DayReminderHTML(user.name, expiryDate, remainingDays, renewalLink),
        text: this.get7DayReminderText(user.name, expiryDate, remainingDays, renewalLink),
      },
      '3day_reminder': {
        subject: 'Your Elevate Subscription Expires in 3 Days',
        html: this.get3DayReminderHTML(user.name, expiryDate, remainingDays, renewalLink),
        text: this.get3DayReminderText(user.name, expiryDate, remainingDays, renewalLink),
      },
      '1day_reminder': {
        subject: 'Your Elevate Subscription Expires Tomorrow',
        html: this.get1DayReminderHTML(user.name, expiryDate, remainingDays, renewalLink),
        text: this.get1DayReminderText(user.name, expiryDate, remainingDays, renewalLink),
      },
      expired_reminder: {
        subject: 'Your Elevate Subscription Has Expired',
        html: this.getExpiredReminderHTML(user.name, expiryDate, renewalLink),
        text: this.getExpiredReminderText(user.name, expiryDate, renewalLink),
      },
    };

    return templates[reminderType] || templates['7day_reminder'];
  }

  calculateExpiryDate(paymentDate) {
    if (!paymentDate) return null;
    const expiry = new Date(paymentDate);
    expiry.setDate(expiry.getDate() + 30);
    return expiry.toLocaleDateString();
  }

  // ============ PASSWORD RESET EMAIL METHODS ============

  async sendPasswordResetEmail(user, resetToken) {
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping password reset email');
      return { success: false, error: 'Email service not configured' };
    }

    // Construct reset link for Flutter app
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    console.log('Sending password reset email to:', user.email);

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Elevate <onboarding@resend.dev>',
        to: [user.email],
        subject: 'Reset Your Password - Elevate',
        html: this.getPasswordResetHTML(user.name, resetLink),
        text: this.getPasswordResetText(user.name, resetLink),
      });

      if (error) {
        console.error(' Resend API error:', error);
        return { success: false, error: error.message };
      }

      console.log('Password reset email sent successfully via Resend');
      console.log('Email ID:', data.id);
      return { success: true, messageId: data.id, provider: 'resend' };
    } catch (error) {
      console.error(' Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetConfirmationEmail(user) {
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping confirmation email');
      return { success: false, error: 'Email service not configured' };
    }

    const loginLink = `${process.env.FRONTEND_URL}/login`;

    console.log('Sending password reset confirmation to:', user.email);

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'Elevate <onboarding@resend.dev>',
        to: [user.email],
        subject: 'Password Reset Successful - Elevate',
        html: this.getPasswordResetConfirmationHTML(user.name, loginLink),
        text: this.getPasswordResetConfirmationText(user.name, loginLink),
      });

      if (error) {
        console.error(' Resend API error:', error);
        return { success: false, error: error.message };
      }

      console.log('Password reset confirmation sent successfully via Resend');
      console.log('Email ID:', data.id);
      return { success: true, messageId: data.id, provider: 'resend' };
    } catch (error) {
      console.error(' Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ EMAIL TEMPLATES (HTML) ============

  getPasswordResetHTML(name, resetLink) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">ELEVATE</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">by Frequency Tuning</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 50px 40px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 24px 0; font-size: 26px; font-weight: 600;">Reset Your Password</h2>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                      Hi ${name},
                    </p>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                      We received a request to reset the password for your Elevate account. Click the button below to create a new password:
                    </p>
                    
                    <!-- Reset Button -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                      <tr>
                        <td style="border-radius: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                          <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 18px 48px; font-size: 17px; color: #ffffff; text-decoration: none; font-weight: 600; letter-spacing: 0.5px;">
                            Reset My Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin: 24px 0 8px 0;">
                      Or copy and paste this link into your browser:
                    </p>
                    <div style="background-color: #f8f9fa; padding: 14px; border-radius: 6px; border: 1px solid #e9ecef; word-break: break-all;">
                      <a href="${resetLink}" style="color: #667eea; font-size: 13px; text-decoration: none;">${resetLink}</a>
                    </div>
                    
                    <!-- Warning -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.6;">
                            <strong> Important Security Notice</strong><br>
                            This password reset link will expire in <strong>1 hour</strong> for your security.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 32px 40px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.6;">
                      © ${new Date().getFullYear()} Elevate by Frequency Tuning. All rights reserved.
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
                      This is an automated security email. Please do not reply to this message.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  getPasswordResetConfirmationHTML(name, loginLink) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 50px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">ELEVATE</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">by Frequency Tuning</p>
                  </td>
                </tr>
                
                <!-- Success Icon -->
                <tr>
                  <td align="center" style="padding: 50px 40px 30px 40px;">
                    <div style="width: 90px; height: 90px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                      <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    
                    <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 28px; font-weight: 600;">Password Reset Successful!</h2>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0;">
                      Hi ${name},
                    </p>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 16px 0 0 0;">
                      Your password has been successfully changed. You can now log in to your Elevate account with your new password.
                    </p>
                  </td>
                </tr>
                
                <!-- Login Button -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                          <a href="${loginLink}" target="_blank" style="display: inline-block; padding: 18px 48px; font-size: 17px; color: #ffffff; text-decoration: none; font-weight: 600; letter-spacing: 0.5px;">
                            Login to Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Security Notice -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 40px 0 0 0; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6; text-align: left;">
                            <strong> Security Tip</strong><br>
                            If you didn't make this change or believe an unauthorized person has accessed your account, please contact our support team immediately.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 32px 40px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.6;">
                      © ${new Date().getFullYear()} Elevate by Frequency Tuning. All rights reserved.
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
                      This is an automated security confirmation. Please do not reply to this message.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  // ============ EMAIL TEMPLATES (Plain Text) ============

  getPasswordResetText(name, resetLink) {
    return `
ELEVATE - Password Reset Request
by Frequency Tuning

Hi ${name},

We received a request to reset the password for your Elevate account.

To reset your password, visit this link:
${resetLink}

 IMPORTANT: This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} Elevate by Frequency Tuning. All rights reserved.
This is an automated security email. Please do not reply to this message.
    `.trim();
  }

  getPasswordResetConfirmationText(name, loginLink) {
    return `
ELEVATE - Password Reset Successful
by Frequency Tuning

Hi ${name},

✓ Password Reset Successful!

Your password has been successfully changed. You can now log in to your Elevate account with your new password.

To log in, visit: ${loginLink}

 SECURITY TIP
If you didn't make this change or believe an unauthorized person has accessed your account, please contact our support team immediately.

© ${new Date().getFullYear()} Elevate by Frequency Tuning. All rights reserved.
This is an automated security confirmation. Please do not reply to this message.
    `.trim();
  }

  // ============ SUBSCRIPTION REMINDER TEMPLATES ============
  // (Keeping existing subscription reminder HTML/Text methods)

  get7DayReminderHTML(name, expiryDate, remainingDays, renewalLink) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscription Expiring Soon</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6F41F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .button { background-color: #6F41F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Elevate Music</h1>
            <h2>Subscription Reminder</h2>
          </div>
          <div class="content">
            <h3>Hi ${name},</h3>
            <p>Your Elevate subscription will expire in <strong>${remainingDays} days</strong>. Don't lose access to your premium music features!</p>
            
            <div class="highlight">
              <h4>Subscription Details:</h4>
              <p><strong>Expiry Date:</strong> ${expiryDate}</p>
              <p><strong>Days Remaining:</strong> ${remainingDays}</p>
            </div>
            
            <p>Continue enjoying unlimited access to:</p>
            <ul>
              <li> Unlimited music streaming</li>
              <li> Offline downloads</li>
              <li> High-quality audio</li>
              <li> Ad-free experience</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${renewalLink}" class="button"> Renew Subscription</a>
            </div>
            
            <div class="footer">
              <p>Best regards,<br>The Elevate Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  get3DayReminderHTML(name, expiryDate, remainingDays, renewalLink) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscription Expiring Soon</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background-color: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
          .button { background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Elevate Music</h1>
            <h2>Urgent: Subscription Expiring Soon</h2>
          </div>
          <div class="content">
            <h3>Hi ${name},</h3>
            <p><strong>URGENT:</strong> Your Elevate subscription will expire in just <strong>${remainingDays} days</strong>!</p>
            
            <div class="highlight">
              <h4> Action Required:</h4>
              <p><strong>Expiry Date:</strong> ${expiryDate}</p>
              <p><strong>Days Remaining:</strong> ${remainingDays}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${renewalLink}" class="button"> Renew Now</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  get1DayReminderHTML(name, expiryDate, remainingDays, renewalLink) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscription Expires Tomorrow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-size: 16px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Elevate Music</h1>
            <h2>LAST CHANCE: Subscription Expires Tomorrow!</h2>
          </div>
          <div class="content">
            <h3>Hi ${name},</h3>
            <p><strong>FINAL REMINDER:</strong> Your Elevate subscription expires <strong>tomorrow</strong>!</p>
            <div style="text-align: center;">
              <a href="${renewalLink}" class="button"> RENEW NOW</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getExpiredReminderHTML(name, expiryDate, renewalLink) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscription Expired</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background-color: #6F41F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Elevate Music</h1>
            <h2>Subscription Expired</h2>
          </div>
          <div class="content">
            <h3>Hi ${name},</h3>
            <p>Your Elevate subscription expired on <strong>${expiryDate}</strong>. We miss you!</p>
            <div style="text-align: center;">
              <a href="${renewalLink}" class="button"> Reactivate Subscription</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Text versions
  get7DayReminderText(name, expiryDate, remainingDays, renewalLink) {
    return `Hi ${name},\n\nYour Elevate subscription will expire in ${remainingDays} days.\nExpiry Date: ${expiryDate}\n\nRenew: ${renewalLink}`;
  }

  get3DayReminderText(name, expiryDate, remainingDays, renewalLink) {
    return `Hi ${name},\n\nURGENT: Your subscription expires in ${remainingDays} days!\nExpiry Date: ${expiryDate}\n\nRenew now: ${renewalLink}`;
  }

  get1DayReminderText(name, expiryDate, remainingDays, renewalLink) {
    return `Hi ${name},\n\nFINAL REMINDER: Your subscription expires tomorrow!\nExpiry Date: ${expiryDate}\n\nRenew now: ${renewalLink}`;
  }

  getExpiredReminderText(name, expiryDate, renewalLink) {
    return `Hi ${name},\n\nYour subscription expired on ${expiryDate}.\n\nReactivate: ${renewalLink}`;
  }
}

export default new EmailService();
