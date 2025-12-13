import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import User from './userModel.js';

const NotificationLog = sequelize.define(
  'NotificationLog',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('email', 'push', 'in-app'),
      allowNull: false,
    },
    template: {
      type: DataTypes.ENUM('7day_reminder', '3day_reminder', '1day_reminder', 'expired_reminder', 'grace_period'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('sent', 'failed', 'pending'),
      defaultValue: 'pending',
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {
        emailAddress: null,
        pushToken: null,
        errorMessage: null,
        deliveryId: null,
      },
    },
  },
  {
    sequelize,
    modelName: 'NotificationLog',
    tableName: 'notification_logs',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['status'] },
    ],
  },
);

// Association
NotificationLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default NotificationLog;
