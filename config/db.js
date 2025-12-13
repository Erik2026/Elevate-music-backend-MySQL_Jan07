import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'elevate_music',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    timezone: '+00:00', // UTC timezone
  },
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Database connected successfully');

    // Sync all models with database
    await sequelize.sync({ alter: false }); // Use alter: true only in development to update schema
    console.log('All models synced with database');

    return sequelize;
  } catch (error) {
    console.error('MySQL connection error:', error.message);
    process.exit(1);
  }
};

export { sequelize, connectDB };
export default connectDB;
