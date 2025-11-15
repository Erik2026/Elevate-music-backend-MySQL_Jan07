import express from 'express';
import {
  getMusic,
  createMusic,
  updateMusic,
  deleteMusic,
  getMusicByCategory,
  uploadFile,
  updateDatabaseUrls,
} from '../controllers/musicController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireSubscription } from '../middleware/subscriptionMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { adminOperationLimiter, userOperationLimiter } from '../middleware/rateLimiterMiddleware.js';

const router = express.Router();

// Admin routes (no subscription required)
router.get('/admin', protect, adminOnly, getMusic);
router.get('/admin/category/:categoryId', protect, adminOnly, getMusicByCategory);

// Public/User routes (requires authentication and active subscription)
router.get('/', userOperationLimiter, protect, requireSubscription, getMusic);
router.get('/category/:categoryId', userOperationLimiter, protect, requireSubscription, getMusicByCategory);
router.post(
  '/upload',
  adminOperationLimiter, // More lenient rate limit for admin operations
  protect,
  adminOnly,
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      next();
    });
  },
  uploadFile,
); // Bulk file upload

// Update database URLs from local to production
router.post('/update-urls', adminOperationLimiter, protect, adminOnly, updateDatabaseUrls);

router.post(
  '/create',
  adminOperationLimiter, // More lenient rate limit for admin operations
  protect,
  adminOnly,
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      next();
    });
  },
  createMusic,
);
router
  .route('/:id')
  .delete(adminOperationLimiter, protect, adminOnly, deleteMusic)
  .put(
    adminOperationLimiter, // More lenient rate limit for admin operations
    protect,
    adminOnly,
    (req, res, next) => {
      upload(req, res, (err) => {
        if (err) {
          return res.status(400).json({ message: 'File upload error', error: err.message });
        }
        next();
      });
    },
    updateMusic,
  );

export default router;
