import Invoice from '../models/Invoice.js';
import User from '../models/userModel.js';
import { sendInvoiceEmail } from '../services/invoiceEmailService.js';

// Generate invoice after successful payment
export const generateInvoice = async (subscriptionData, user) => {
  try {
    const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const invoice = await Invoice.create({
      invoiceId,
      userId: user.id,
      subscriptionId: subscriptionData.id || subscriptionData.subscriptionId,
      stripeInvoiceId: subscriptionData.stripeInvoiceId,
      amount: subscriptionData.amount || subscriptionData.price,
      currency: subscriptionData.currency || 'usd',
      status: 'paid',
      customerName: user.name,
      customerEmail: user.email,
      emailSent: false,
    });

    console.log('Invoice generated:', invoiceId);
    return invoice;
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw error;
  }
};

// Send invoice email
export const sendInvoice = async (invoice) => {
  try {
    const result = await sendInvoiceEmail(invoice.customerEmail, invoice);
    
    console.log('Email send result:', result);
    
    if (result.success) {
      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();
      console.log('Invoice email sent:', invoice.invoiceId);
    } else {
      console.error('Email send failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error sending invoice:', error);
    return { success: false, error: error.message };
  }
};

// Handle successful payment - generate and send invoice
export const handleSuccessfulPayment = async (subscriptionData, user) => {
  try {
    const invoice = await generateInvoice(subscriptionData, user);
    
    // Send email asynchronously (non-blocking)
    sendInvoice(invoice).catch(err => {
      console.error('Failed to send invoice email:', err);
    });
    
    return invoice;
  } catch (error) {
    console.error('Error in handleSuccessfulPayment:', error);
    // Don't throw - invoice generation shouldn't block subscription
  }
};

// Get user's invoices
export const getInvoices = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const invoices = await Invoice.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
};

// Get specific invoice
export const getInvoiceById = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const invoice = await Invoice.findOne({
      where: {
        invoiceId: req.params.id,
        userId,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ message: 'Error fetching invoice', error: error.message });
  }
};

// Get all invoices (admin only)
export const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching all invoices:', error);
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
};

// Resend invoice email (admin only)
export const resendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { invoiceId: req.params.id },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const result = await sendInvoice(invoice);
    
    if (result.success) {
      res.json({ message: 'Invoice resent successfully' });
    } else {
      res.status(500).json({ message: 'Failed to resend invoice', error: result.error });
    }
  } catch (error) {
    console.error('Error resending invoice:', error);
    res.status(500).json({ message: 'Error resending invoice', error: error.message });
  }
};
