import rateLimit from 'express-rate-limit';

// Rate limiter for regular user operations
export const userOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More lenient rate limiter for admin operations (like music creation)
export const adminOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs (4x increase for admin operations)
  message: 'Too many admin operation requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for expensive file operations
export const fileOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many file operation requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

