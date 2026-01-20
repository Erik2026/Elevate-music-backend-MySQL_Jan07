import express from 'express';
import {
  getInvoices,
  getInvoiceById,
  getAllInvoices,
  resendInvoice,
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { admin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// User routes
router.get('/', protect, getInvoices);
router.get('/:id', protect, getInvoiceById);

// Admin routes
router.get('/admin/all', protect, admin, getAllInvoices);
router.post('/:id/resend', protect, admin, resendInvoice);

export default router;
