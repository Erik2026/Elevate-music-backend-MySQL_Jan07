import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { Op } from 'sequelize';

// Debug: Check if STRIPE_SECRET_KEY is loaded
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'NOT FOUND');
console.log(
  'All env vars:',
  Object.keys(process.env).filter((key) => key.includes('STRIPE')),
);

// Initialize Stripe only if secret key is available
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('STRIPE_SECRET_KEY not found - Stripe will not be initialized');
}

// @desc    Auth user & get token
// @route   POST /api/users/auth
// @access  Public
// backend/controllers/userController.js
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Debugging log: Check the incoming email and password
  console.log('Auth attempt:', { email, password });

  // Security: Validate that email is a string
  if (!email || typeof email !== 'string') {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const user = await User.findOne({ where: { email: email.toLowerCase() } });

  // Debugging log: Check if the user was found and their stored password
  console.log('User found:', user ? { email: user.email, role: user.role } : 'No user');
  console.log('Password from DB:', user ? user.password : 'No user password');

  if (!user) {
    res.status(401);
    throw new Error('User not found');
  }

  // Compare entered password with the password in the DB
  const passwordMatch = await user.matchPassword(password);

  // Debugging log: Check if the password comparison succeeded
  console.log('Entered Password:', password);
  console.log('Password match:', passwordMatch); // This will show true/false

  if (passwordMatch) {
    const token = generateToken(user.id);
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Include subscription status in login response
    let subscriptionStatus = null;
    if (user.subscription && user.subscription.id) {
      // Calculate isActive based on status and expiry
      let status = user.subscription.status;
      // Treat incomplete_expired as canceled
      if (status === 'incomplete_expired') {
        status = 'canceled';
      }
      
      // Don't return subscription info if canceled - user had subscription that ended
      if (status === 'canceled') {
        subscriptionStatus = null;
      } else {
        let isActive = status === 'active' || status === 'trialing';
        
        // Also check if subscription has expired based on currentPeriodEnd
        if (user.subscription.currentPeriodEnd) {
          const expiryDate = new Date(user.subscription.currentPeriodEnd);
          const now = new Date();
          if (now > expiryDate) {
            isActive = false;
            console.log('Subscription expired - currentPeriodEnd:', expiryDate);
          }
        }
        
        subscriptionStatus = {
          id: user.subscription.id,
          status: status,
          isActive: isActive,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
          paymentDate: user.subscription.paymentDate,
        };
      }
      
      console.log('Login - Subscription status:', subscriptionStatus);
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
      subscription: subscriptionStatus,
    });
  } else {
    res.status(401);
    throw new Error('Invalid password');
  }
});

// @desc    Register a new admin user
// @route   POST /api/users/admin
// @access  Public (or can be made private)
const registerAdmin = asyncHandler(async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if the user already exists
    let userExists = await User.findOne({ where: { email } });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    // Create a new admin user (password will be hashed by beforeCreate hook)
    const user = await User.create({
      name,
      email,
      password,
      role: 'admin', // Force admin role
    });

    if (user) {
      const token = generateToken(user.id);

      // Set the token as an HTTP-only cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, role } = req.body; // Accept role from request

    // Check if the user already exists
    let userExists = await User.findOne({ where: { email } });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    // Create a new user (password will be hashed by beforeCreate hook)
    const user = await User.create({
      name,
      email,
      password, // Use plain password - will be hashed by model hook
      role: role || 'user', // Assign role or default to 'user'
    });

    if (user) {
      const token = generateToken(user.id);

      //  Set the token as an HTTP-only cookie
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set true in production (HTTPS)
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Include role in response
        token,
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Security: Use secure flag in production
    sameSite: 'strict', // Security: Prevent CSRF attacks
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  if (user) {
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role, // Include role in response
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Forgot password
// @route   PUT /api/users/forgot-password
// @access  Private

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = req.body.password;
    }

    if (req.body.role && req.user.role === 'admin') {
      // Allow role update only if the user is an admin
      user.role = req.body.role;
    }

    const updatedUser = await user.save();

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role, // Include updated role in response
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get all users (Admin only)
// @route   GET /api/users/all
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
    order: [['createdAt', 'DESC']] // Newest first
  });

  // Calculate subscription status for each user
  const usersWithStatus = users.map((user) => {
    const userObj = user.toJSON();

    // Determine subscription status
    let subscriptionStatus = 'No Subscription';
    let isActive = false;
    let daysRemaining = 0;
    let expiryDate = null;

    if (userObj.subscription && userObj.subscription.paymentDate) {
      const paymentDate = new Date(userObj.subscription.paymentDate);
      const validityDays = userObj.subscription.validityDays || 30;
      expiryDate = new Date(paymentDate);
      expiryDate.setDate(expiryDate.getDate() + validityDays);

      const now = new Date();
      daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining > 0) {
        subscriptionStatus = 'Active';
        isActive = true;
      } else if (daysRemaining <= 0 && daysRemaining >= -30) {
        subscriptionStatus = 'Expired';
        isActive = false;
      } else {
        subscriptionStatus = 'Inactive';
        isActive = false;
      }

      // Check if canceled
      if (userObj.subscription.cancelAtPeriodEnd) {
        subscriptionStatus = 'Canceled';
      }
    }

    return {
      ...userObj,
      subscriptionStatus,
      isActive,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      expiryDate: expiryDate,
    };
  });

  res.json(usersWithStatus);
});

// @desc    Get specific user by ID (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['password'] }
  });
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Forgot password - Request password reset
// @route   POST /api/users/forgot-password
// @access  Public
const forgotUserPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Validate email
  if (!email) {
    res.status(400);
    throw new Error('Please provide an email address');
  }

  // Security: Validate that email is a string
  if (typeof email !== 'string') {
    res.status(400);
    throw new Error('Invalid email format');
  }

  // Find user by email (case-insensitive)
  const user = await User.findOne({ where: { email: email.toLowerCase() } });

  // Always return success message for security (don't reveal if email exists)
  if (!user) {
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
    return;
  }

  // Generate reset token using the model method
  const resetToken = user.createPasswordResetToken();

  // Save user with reset token and expiration
  await user.save({ validateBeforeSave: false });

  try {
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;

    // Send password reset email
    const result = await emailService.sendPasswordResetEmail(user, resetToken);

    // Log the reset token for testing (remove in production)
    console.log('Password reset token for', email, ':', resetToken);

    if (!result.success) {
      // If email fails, clear the reset token
      user.clearPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      res.status(500);
      throw new Error('Error sending email. Please try again later.');
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    // Clear reset token if any error occurs
    user.clearPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    console.error('Forgot password error:', error);
    res.status(500);
    throw new Error('Error sending password reset email. Please try again later.');
  }
});

// @desc    Reset password with token
// @route   POST /api/users/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Validate password
  if (!password) {
    res.status(400);
    throw new Error('Please provide a new password');
  }

  // Security: Validate that password is a string before checking length
  if (typeof password !== 'string') {
    res.status(400);
    throw new Error('Invalid password format');
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters long');
  }

  // Hash the token to compare with database
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with valid reset token and not expired
  const user = await User.findOne({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired password reset token');
  }

  // Update password (will be hashed by pre-save hook)
  user.password = password;

  // Clear reset token fields
  user.clearPasswordResetToken();

  // Save user
  await user.save();

  try {
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;

    // Send confirmation email
    await emailService.sendPasswordResetConfirmationEmail(user);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    // Don't fail the password reset if email fails
  }

  res.json({
    message: 'Password reset successful. You can now log in with your new password.',
  });
});
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user.role === 'admin') {
    res.status(403);
    throw new Error('Cannot delete an admin');
  }
  await User.destroy({ where: { id: req.params.id } });
  res.json({ message: 'User deleted successfully' });
});

// @desc    Get user billing status
// @route   GET /api/users/billing
// @access  Private
const getBillingStatus = asyncHandler(async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a default payment method
    let hasDefaultPaymentMethod = false;
    if (user.stripeCustomerId && stripe) {
      try {
        console.log('Checking payment methods for customer:', user.stripeCustomerId);

        // First, get all payment methods for the customer
        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: 'card',
        });

        console.log('Found payment methods:', paymentMethods.data.length);
        console.log(
          'Payment methods:',
          paymentMethods.data.map((pm) => ({
            id: pm.id,
            type: pm.type,
            card: pm.card?.last4,
          })),
        );

        // Check if customer has any payment methods
        hasDefaultPaymentMethod = paymentMethods.data.length > 0;

        console.log('hasDefaultPaymentMethod:', hasDefaultPaymentMethod);
      } catch (error) {
        console.error('Error fetching customer payment methods:', error);
      }
    } else if (!stripe) {
      console.warn('Stripe not initialized - cannot check payment methods');
    }

    // Get auto-debit preference (default to false if not set)
    const autoDebit = user.autoDebit || false;

    return res.json({
      hasDefaultPaymentMethod,
      autoDebit,
    });
  } catch (error) {
    console.error('Error fetching billing status:', error);
    return res.status(500).json({
      message: 'Failed to fetch billing status',
      error: error.message,
    });
  }
});

export {
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
};
