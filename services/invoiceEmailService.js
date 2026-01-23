import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InvoiceEmailService {
  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.isConfigured = true;
      this.emailFrom = (process.env.EMAIL_FROM || 'Elevate <onboarding@resend.dev>')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      console.log('Resend email service initialized');
      console.log('Email from:', this.emailFrom);
    } else {
      this.resend = null;
      this.isConfigured = false;
      console.warn('RESEND_API_KEY not set - Invoice emails disabled');
    }
  }

  async generateInvoicePDF(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const invoicesDir = path.join(__dirname, '../invoices');
        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
        }

        const filename = `invoice-${invoice.invoiceId}.pdf`;
        const filepath = path.join(invoicesDir, filename);
        const doc = new PDFDocument({ margin: 50 });

        doc.pipe(fs.createWriteStream(filepath));

        // Header
        doc.fontSize(25).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('Elevate Music', { align: 'center' });
        doc.text('support@elevateintune.com', { align: 'center' });
        doc.moveDown(2);

        // Invoice details
        doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceId}`, { bold: true });
        doc.text(`Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString()}`);
        doc.text(`Status: ${invoice.status.toUpperCase()}`);
        doc.moveDown();

        // Bill to
        doc.text('Bill To:', { underline: true });
        doc.text(`${invoice.customerName || 'Customer'}`);
        doc.text(`${invoice.customerEmail}`);
        doc.moveDown(2);

        // Table header
        doc.text('Description', 100, doc.y, { continued: true, width: 250 });
        doc.text('Amount', 350, doc.y);
        doc.moveTo(100, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown();

        // Item
        doc.text('Elevate Music Subscription', 100, doc.y, { continued: true, width: 250 });
        doc.text(`$${invoice.amount} ${invoice.currency.toUpperCase()}`, 350, doc.y);
        doc.moveDown(2);

        // Total
        doc.moveTo(100, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown();
        doc.fontSize(14).text('Total:', 100, doc.y, { continued: true, bold: true });
        doc.text(`$${invoice.amount} ${invoice.currency.toUpperCase()}`, 350, doc.y);

        doc.end();

        doc.on('finish', () => resolve(filepath));
        doc.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendInvoiceEmail(email, invoice) {
    if (!this.isConfigured) {
      console.warn('Email service not configured - skipping invoice email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      console.log('Attempting to send invoice email to:', email);
      console.log('Invoice details:', { invoiceId: invoice.invoiceId, amount: invoice.amount });
      
      const pdfPath = await this.generateInvoicePDF(invoice);
      const pdfBuffer = fs.readFileSync(pdfPath);

      console.log('Sending email via Resend...');
      const { data, error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: [email],
        subject: `Invoice #${invoice.invoiceId} - Elevate Music Subscription`,
        html: this.getInvoiceEmailHTML(invoice),
        attachments: [
          {
            filename: `invoice-${invoice.invoiceId}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      if (error) {
        console.error('Resend error:', error);
        return { success: false, error: error.message };
      }

      console.log('Invoice email sent successfully, Message ID:', data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('Error sending invoice email:', error);
      return { success: false, error: error.message };
    }
  }

  getInvoiceEmailHTML(invoice) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">ELEVATE</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Music Streaming</p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 50px 40px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 24px 0; font-size: 26px;">Thank you for your purchase!</h2>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                      Dear ${invoice.customerName || 'Customer'},
                    </p>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                      Your payment has been successfully processed. Please find your invoice attached.
                    </p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
                      <p style="margin: 8px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceId}</p>
                      <p style="margin: 8px 0;"><strong>Amount:</strong> $${invoice.amount} ${invoice.currency.toUpperCase()}</p>
                      <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(invoice.createdAt || Date.now()).toLocaleDateString()}</p>
                      <p style="margin: 8px 0;"><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
                    </div>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 24px 0 0 0;">
                      If you have any questions, please contact us at support@elevateintune.com
                    </p>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 16px 0 0 0;">
                      Best regards,<br>Elevate Music Team
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="background-color: #f8f9fa; padding: 32px 40px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                      © ${new Date().getFullYear()} Elevate Music. All rights reserved.
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
}

const invoiceEmailService = new InvoiceEmailService();
export const sendInvoiceEmail = (email, invoice) => invoiceEmailService.sendInvoiceEmail(email, invoice);
export const generateInvoicePDF = (invoice) => invoiceEmailService.generateInvoicePDF(invoice);
