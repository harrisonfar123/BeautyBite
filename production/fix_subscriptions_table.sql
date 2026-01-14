-- Fix subscriptions table structure
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_payment_method_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS quantity_per_period INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_per_period DECIMAL(10,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS interval VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_periods INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS periods_completed INTEGER DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Drop old columns if they exist
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS product_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS duration_months;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS start_date;