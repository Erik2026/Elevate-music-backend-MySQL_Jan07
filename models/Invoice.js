import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Invoice = sequelize.define(
  'Invoice',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    subscriptionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stripeInvoiceId: {
      type: DataTypes.STRING,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'usd',
    },
    status: {
      type: DataTypes.ENUM('paid', 'pending', 'failed'),
      defaultValue: 'paid',
    },
    customerName: {
      type: DataTypes.STRING,
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pdfUrl: {
      type: DataTypes.STRING(500),
    },
    emailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    emailSentAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'Invoice',
    tableName: 'invoices',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['invoiceId'] },
      { fields: ['createdAt'] },
    ],
  },
);

export default Invoice;
