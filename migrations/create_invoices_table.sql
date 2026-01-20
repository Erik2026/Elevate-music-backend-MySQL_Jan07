-- Migration: Create invoices table
-- Run this SQL script in your MySQL database

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  subscription_id VARCHAR(255) NOT NULL,
  stripe_invoice_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'usd',
  status ENUM('paid', 'pending', 'failed') DEFAULT 'paid',
  customer_name VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  pdf_url VARCHAR(500),
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
