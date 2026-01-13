-- Order log table - tracks all purchase events
CREATE TABLE IF NOT EXISTS order_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL, -- 'one-time', 'subscription', 'subscription_renewal'
    order_id INTEGER, -- References orders.id or subscriptions.id
    stripe_payment_intent_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    quantity INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    billing_email VARCHAR(255),
    billing_name VARCHAR(255),
    shipping_address TEXT,
    period_number INTEGER, -- For subscriptions (which payment in the series)
    total_periods INTEGER, -- For subscriptions (total expected payments)
    interval VARCHAR(50), -- '12hour', 'weekly', 'monthly'
    notes TEXT, -- Any additional info
    email_sent BOOLEAN DEFAULT FALSE, -- Track if confirmation email sent
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_order_log_user_id ON order_log(user_id);
CREATE INDEX IF NOT EXISTS idx_order_log_stripe_pi ON order_log(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_order_log_type ON order_log(order_type);
CREATE INDEX IF NOT EXISTS idx_order_log_status ON order_log(status);
CREATE INDEX IF NOT EXISTS idx_order_log_created ON order_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_log_email_sent ON order_log(email_sent) WHERE email_sent = FALSE;

-- Add user email to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- View for easy order log querying
CREATE OR REPLACE VIEW order_log_with_user AS
SELECT 
    ol.*,
    u.email as user_email,
    u.name as user_name
FROM order_log ol
JOIN users u ON ol.user_id = u.id;