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
