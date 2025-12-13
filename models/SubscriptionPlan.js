import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import User from './userModel.js';

const SubscriptionPlan = sequelize.define(
  'SubscriptionPlan',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Basic Plan Information
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Pricing Information
    monthlyCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    annualCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    // Plan Features
    adSupported: {
      type: DataTypes.ENUM('Yes', 'No'),
      allowNull: false,
    },
    audioFileType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    offlineDownloads: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    binauralTracks: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    soundscapeTracks: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dynamicAudioFeatures: {
      type: DataTypes.ENUM('Yes', 'No'),
      allowNull: false,
    },
    customTrackRequests: {
      type: DataTypes.ENUM('Yes', 'No'),
      allowNull: false,
    },
    // Stripe Integration
    stripePriceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stripeMonthlyPriceId: {
      type: DataTypes.STRING,
    },
    stripeYearlyPriceId: {
      type: DataTypes.STRING,
    },
    stripeProductId: {
      type: DataTypes.STRING,
    },
    // Plan Management
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Version Control for Pricing Changes
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    effectiveDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    endDate: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    // Metadata
    description: {
      type: DataTypes.TEXT,
    },
    features: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    // Admin Tracking
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    lastModifiedById: {
      type: DataTypes.UUID,
      references: {
        model: User,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'SubscriptionPlan',
    tableName: 'subscription_plans',
    timestamps: true,
    indexes: [
      { fields: ['isActive', 'effectiveDate'] },
      { fields: ['stripePriceId'] },
      { fields: ['title'] },
    ],
  },
);

// Associations
SubscriptionPlan.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });
SubscriptionPlan.belongsTo(User, { foreignKey: 'lastModifiedById', as: 'lastModifiedBy' });

// Instance methods
SubscriptionPlan.prototype.monthlyCostFormatted = function () {
  return `$${parseFloat(this.monthlyCost).toFixed(2)}`;
};

SubscriptionPlan.prototype.annualCostFormatted = function () {
  return `$${parseFloat(this.annualCost).toFixed(2)}`;
};

// Static methods
SubscriptionPlan.getCurrentActivePlan = function () {
  return this.findOne({
    where: {
      isActive: true,
      [sequelize.Sequelize.Op.or]: [
        { endDate: null },
        { endDate: { [sequelize.Sequelize.Op.gt]: new Date() } },
      ],
    },
    order: [['effectiveDate', 'DESC']],
  });
};

SubscriptionPlan.getActivePlans = function () {
  return this.findAll({
    where: {
      isActive: true,
      [sequelize.Sequelize.Op.or]: [
        { endDate: null },
        { endDate: { [sequelize.Sequelize.Op.gt]: new Date() } },
      ],
    },
    order: [['effectiveDate', 'DESC']],
  });
};

// Instance method to deactivate plan
SubscriptionPlan.prototype.deactivate = async function (adminUserId) {
  this.isActive = false;
  this.endDate = new Date();
  this.lastModifiedById = adminUserId;
  return this.save();
};

// Hook to ensure only one default plan
SubscriptionPlan.beforeSave(async (plan, options) => {
  if (plan.isDefault && plan.isNewRecord) {
    await SubscriptionPlan.update({ isDefault: false }, { where: { id: { [sequelize.Sequelize.Op.ne]: plan.id } } });
  }
});

export default SubscriptionPlan;
