// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('=== SERVER STARTUP DEBUG ===');
console.log('Environment check:');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'NOT FOUND');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_NAME:', process.env.DB_NAME || 'elevate_music');
console.log('=== END SERVER STARTUP DEBUG ===');

import express from 'express';;

import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import categoryRoutes from './routes/categoryRoutes.js';
import musicRoutes from './routes/musicRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import subscriptionPlanRoutes from './routes/subscriptionPlanRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import notificationScheduler from './services/notificationScheduler.js';
import cors from 'cors';
import { handleWebhook } from './controllers/subscriptionController.js';
import userRoutes from './routes/userRoutes.js';
import termsRoutes from './routes/termsRoutes.js';
import helmet from 'helmet';
import { fileOperationLimiter } from './middleware/rateLimiterMiddleware.js';

const port = process.env.PORT || 5000;

connectDB();

const app = express();

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Security: Use Helmet for various security headers with custom configuration
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin resources
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

// CSRF Protection: Implemented via sameSite='strict' cookies combined with:
// 1. SameSite cookie attribute prevents cookies from being sent in cross-site requests
// 2. Origin validation via CORS configuration
// 3. Rate limiting to prevent automated CSRF attacks
// 4. JWT tokens stored in httpOnly cookies prevent XSS-based token theft

// Security: Rate limiting is configured in middleware/rateLimiterMiddleware.js

// Stripe webhook must be registered BEFORE express.json() to preserve raw body
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://elevateintune.com',
      'https://elevate-music-backend-mysqldec13-production.up.railway.app',
      'https://elevate-admin-frontend-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://192.168.1.7:3000',
      'http://172.234.201.117:5173',
      'http://172.234.201.117:5174',
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For development, allow any local network origin including 172.x.x.x range
      if (
        origin.includes('192.168.') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('172.')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Range', 'If-Range'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes
app.options('*', (req, res) => {
  // Security: Only allow specific origins instead of * when credentials are enabled
  const origin = req.headers.origin;
  // Check if origin is allowed using CORS logic
  const allowedOrigins = [
    'https://elevateintune.com',
    'https://elevate-admin-frontend-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://192.168.1.7:3000',
    'http://172.234.201.117:5173',
    'http://172.234.201.117:5174',
  ];
  
  const isAllowed = !origin || allowedOrigins.includes(origin) ||
    (origin.includes('192.168.') || origin.includes('localhost') ||
     origin.includes('127.0.0.1') || origin.includes('172.'));
  
  if (isAllowed && origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,Range,If-Range');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Serve static uploads with proper CORS and range support for media
const uploadsPath = process.env.RENDER_DISK_PATH 
  ? path.join(process.env.RENDER_DISK_PATH, 'uploads')
  : path.join(__dirname, 'uploads');

app.use(
  '/uploads',
  cors(corsOptions),
  (req, res, next) => {
    res.setHeader('Accept-Ranges', 'bytes');
    next();
  },
  express.static(uploadsPath),
);

app.use((req, res, next) => {
  console.log('CORS headers set for:', req.method, req.url);
  next();
});

app.use(cookieParser());

// Handle favicon requests to prevent 500 errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Mount routes with rate limiting for file operations
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
// Music routes - rate limiting applied per route in musicRoutes.js
app.use('/api/music', musicRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/terms', termsRoutes);

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, '/frontend/dist')));
  
  // Security: Apply rate limiting to static file serving
  // Exclude /uploads and /api routes from catch-all
  app.get('*', fileOperationLimiter, (req, res, next) => {
    if (req.path.startsWith('/uploads') || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(__dirname, 'frontend', 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running....');
  });
}

app.use(notFound);
app.use(errorHandler);

// Start notification scheduler
notificationScheduler.start();

app.listen(port, () => console.log(`Server started on port ${port}`));
