-- Product Type Tracking Migration
-- Adds product_type column to order_log and orders tables for tracking products (standard, bulk, custom, etc.)

-- Add to order_log
ALTER TABLE order_log 
ADD COLUMN IF NOT EXISTS product_type VARCHAR(100) DEFAULT 'standard';

-- Add to orders (for one-time purchases)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS product_type VARCHAR(100) DEFAULT 'standard';

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_order_log_product_type ON order_log(product_type);
CREATE INDEX IF NOT EXISTS idx_orders_product_type ON orders(product_type);

-- Verify table structures
\d order_log
\d orders

-- Sample recent data from order_log
SELECT id, order_type, product_type, quantity, amount, created_at 
FROM order_log 
ORDER BY created_at DESC 
LIMIT 10;

-- Summary stats
SELECT product_type, COUNT(*) as orders, SUM(quantity) as units, SUM(amount) as revenue 
FROM order_log 
WHERE status = 'completed' 
GROUP BY product_type 
ORDER BY revenue DESC NULLS LAST;