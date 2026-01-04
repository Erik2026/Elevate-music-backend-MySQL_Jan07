import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Use MYSQL_URL if available, otherwise use individual variables
const sequelize = process.env.MYSQL_URL 
  ? new Sequelize(process.env.MYSQL_URL, {
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      timezone: '+00:00',
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false,
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'railway',
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
        timezone: '+00:00',
        dialectOptions: {
          ssl: process.env.NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
          } : false,
        },
      },
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Database connected successfully');

    // Sync all models with database
    const syncOptions = { alter: false }; // Use alter: true only in development to update schema
    await sequelize.sync(syncOptions);
    console.log('All models synced with database');

    return sequelize;
  } catch (error) {
    console.error('MySQL connection error:', error.message);
    process.exit(1);
  }
};

export { sequelize, connectDB };
export default connectDB;
