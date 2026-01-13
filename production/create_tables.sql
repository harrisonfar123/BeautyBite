CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    product_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    product_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    duration_months INTEGER NOT NULL,
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    next_billing_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Table for scheduled deliveries (recurring orders paid upfront)
CREATE TABLE IF NOT EXISTS scheduled_deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    delivery_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, pending, fulfilled, cancelled
    fulfilled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON scheduled_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON scheduled_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON scheduled_deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON scheduled_deliveries(status);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    quantity_per_period INTEGER NOT NULL,
    amount_per_period DECIMAL(10,2) NOT NULL,
    interval VARCHAR(50) NOT NULL, -- '12hour', 'weekly', 'monthly'
    total_periods INTEGER NOT NULL,
    periods_completed INTEGER DEFAULT 1, -- First payment already done
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, completed
    next_billing_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL, -- succeeded, failed
    period_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date, status);
CREATE INDEX idx_subscriptions_customer ON subscriptions(stripe_customer_id);
