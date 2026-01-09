import express from 'express';
import {
  authUser,
  registerUser,
  registerAdmin,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  forgotUserPassword,
  resetPassword,
  getAllUsers,
  getUserById,
  deleteUser,
  getBillingStatus,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.post('/', registerUser);
router.post('/admin', registerAdmin); // Admin registration endpoint
router.post('/auth', authUser);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotUserPassword);
router.post('/reset-password/:token', resetPassword);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.get('/billing', protect, getBillingStatus); // Get user billing status
router.get('/:id', protect, adminOnly, getUserById); // Admin: Get specific user
router.get('/', protect, adminOnly, getAllUsers); // Get all users
router.delete('/:id', protect, adminOnly, deleteUser); // Delete a user

export default router;
