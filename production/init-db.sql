-- init-db.sql: Initialize the users table for BeautyBite authentication system
-- Usage on Heroku: heroku pg:psql -a YOUR_APP_NAME < init-db.sql
-- Replace YOUR_APP_NAME with your actual Heroku app name

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- bcrypt hashed passwords
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Insert a test user (remove in production)
-- INSERT INTO users (name, email, password) VALUES ('Test User', 'test@example.com', '$2b$10$...hashed...') ON CONFLICT (email) DO NOTHING;

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  product_type VARCHAR(50),
  quantity INTEGER,
  amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  product_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  duration_months INTEGER,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  next_billing_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
