import express from 'express';
import {
  getInvoices,
  getInvoiceById,
  getAllInvoices,
  resendInvoice,
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// User routes
router.get('/', protect, getInvoices);
router.get('/:id', protect, getInvoiceById);

// Admin routes
router.get('/admin/all', protect, adminOnly, getAllInvoices);
router.post('/:id/resend', protect, adminOnly, resendInvoice);

export default router;
