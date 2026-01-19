import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import User from './userModel.js';
import Category from './Category.js';

const Music = sequelize.define(
  'Music',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    artist: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Category,
        key: 'id',
      },
    },
    categoryType: {
      type: DataTypes.STRING,
      allowNull: true,
      // Store category type reference (from JSON array in Category model)
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    releaseDate: {
      type: DataTypes.DATE,
    },
    publishDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Music',
    tableName: 'music',
    timestamps: true,
    indexes: [
      { fields: ['categoryId'] },
      { fields: ['userId'] },
      { fields: ['title'] },
    ],
  },
);

// Define associations
Music.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Music.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default Music;
