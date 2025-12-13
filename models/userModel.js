import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      lowercase: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'admin', 'moderator'),
      defaultValue: 'user',
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    autoDebit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Subscription as JSON
    subscription: {
      type: DataTypes.JSON,
      defaultValue: {
        id: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentDate: null,
        validityDays: 30,
        interval: 'month',
      },
    },
    // Notification preferences as JSON
    notificationPreferences: {
      type: DataTypes.JSON,
      defaultValue: {
        emailReminders: true,
        pushNotifications: true,
        reminderFrequency: ['7days', '3days', '1day'],
        preferredTime: '09:00',
        timezone: 'UTC',
        lastReminderSent: null,
        fcmToken: null,
      },
    },
    // Password Reset Fields
    resetPasswordToken: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [{ fields: ['email'] }, { fields: ['stripeCustomerId'] }],
  },
);

// Instance method to match password
User.prototype.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to create password reset token
User.prototype.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return resetToken;
};

// Instance method to clear password reset fields
User.prototype.clearPasswordResetToken = function () {
  this.resetPasswordToken = null;
  this.resetPasswordExpires = null;
};

// Hook to hash password before saving
User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

export default User;
