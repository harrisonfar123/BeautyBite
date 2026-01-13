# STRIPE Deployment Guide

## ⚠️ Important Warnings

- **Test thoroughly in test mode before going live.**
- **Never commit `.env` [`./.env`](.env) to git.** Add it to `.gitignore` [`./.gitignore`](.gitignore).
- **Webhooks require HTTPS** (Heroku provides this automatically).

## 1. Local Testing

1. Install dependencies:

   ```bash
   npm install
   ```

2. Setup Database:
   - Dump latest schema from Heroku (optional, to sync):  

     ```bash
     heroku pg:psql --app beautybite-36e5434be6c8 > init-db.sql
     ```

   - Or load [`init-db.sql`](init-db.sql) into your local PostgreSQL:

     ```bash
     psql -d your_local_db -f init-db.sql
     ```

3. Start the server:

   ```bash
   node server.js
   ```

4. Visit `http://localhost:3000/shop.html` (login first via [`login.html`](login.html)).

5. Test purchase/subscription:
   - Use test card: `4242424242424242`

## 2. Heroku Deployment

1. Commit and push changes:

   ```bash
   git add .
   git commit -m "Integrate Stripe payments"
   git push heroku main
   ```

2. **Migrate new tables** (no auto-migration):
   - Connect to Heroku Postgres:

     ```bash
     heroku pg:psql --app beautybite-36e5434be6c8
     ```

   - Copy-paste contents of [`init-db.sql`](init-db.sql) (Stripe-related tables only).

3. Set environment variables **after Step 3 (webhook)**:

   ```bash
   heroku config:set STRIPE_SECRET_KEY=sk_test_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PUBLISHABLE_KEY=pk_test_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PRICE_ID_ONE_TIME=price_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PRICE_ID_SUBSCRIPTION=price_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_... --app beautybite-36e5434be6c8
   ```

## 3. Stripe Dashboard: Setup Webhook

1. Login to [dashboard.stripe.com](https://dashboard.stripe.com) (**test mode**).

2. Navigate to **Developers > Webhooks > + Add endpoint**.

3. **Endpoint URL**:  
   `https://beautybite-36e5434be6c8.herokuapp.com/api/stripe/webhook`

4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.*`
   - `invoice.paid`

5. **Add endpoint**.

6. **Reveal webhook secret** (`whsec_...`), then set on Heroku:

   ```bash
   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_... --app beautybite-36e5434be6c8
   ```

## 4. Test End-to-End

1. Login to app (`https://beautybite-36e5434be6c8.herokuapp.com/login.html`).

2. Go to [`shop.html`](shop.html), test:
   - Buy one-time ($100).
   - Subscribe 3 months.
   - Use test card `4242424242424242`.

3. Verify:
   - [`orders.html`](orders.html) shows history/subscriptions.
   - Stripe Dashboard (payments, subscriptions).
   - Server logs for webhook events.

**Testing Checklist:**

- [ ] Buy single $100
- [ ] Subscribe 3mo (check `cancel_at` in Stripe)
- [ ] Order history in [`orders.html`](orders.html)
- [ ] Subscriptions visible
- [ ] Webhooks fire (check logs/Stripe)

## 5. Production Switch

1. **Stripe Dashboard**:
   - Toggle to **live mode**.
   - Create live products/prices, get live keys (`sk_live_...`, `pk_live_...`).

2. Update Heroku config vars:

   ```bash
   heroku config:set STRIPE_SECRET_KEY=sk_live_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PRICE_ID_ONE_TIME=price_live_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_PRICE_ID_SUBSCRIPTION=price_live_... --app beautybite-36e5434be6c8
   heroku config:set STRIPE_WEBHOOK_SECRET=wh_live_sec_... --app beautybite-36e5434be6c8
   ```

3. **Update webhook endpoint** in Stripe to use live secret (repeat Step 3 for live mode).

## Embedded Subscription System

### Prerequisites

- Run [`create_tables.sql`](create_tables.sql) in PostgreSQL to add `customers`, `subscriptions`, `subscription_payments` tables and indexes.
- Ensure Stripe keys in [`./.env`](.env).
- Deploy [`server.js`](server.js) changes to Heroku.

### Heroku Scheduler Setup (Recurring Charges)

1. Install addon:

   ```bash
   heroku addons:create scheduler:standard -a beautybite
   ```

2. Configure job (Dashboard or CLI):

   ```bash
   heroku addons:open scheduler -a beautybite
   ```

   - **Frequency**: Every hour
   - **Command**: `curl -X POST https://beautybite-36e5434be6c8.herokuapp.com/api/cron/process-subscriptions`

   Replace URL with your Heroku app URL.

### Testing Instructions

#### 12-Hour Test Subscription (Quick Verification)

- [`shop.html`](shop.html): Quantity=2, Duration=3, Interval=12-hour
- **Expected**:
  - First: $400 immediate charge
  - After 12h: $400 (manual cron)
  - After 24h: $400, completes
- Total: $1,200

#### Weekly Subscription

- Quantity=5, Duration=4, Weekly
- First: $1,000
- Then weekly x3

#### Check Progress

- [`orders.html`](orders.html): View progress, next billing, total paid, status

### Manual Operations

**Trigger Cron**:

   ```bash
curl -X POST https://your-app.herokuapp.com/api/cron/process-subscriptions
   ```

**View Logs**:

   ```bash
heroku logs --tail -a beautybite | grep -i subscription
   ```

### Error Handling

- **Payment Failures**: Cron marks `status='payment_failed'`, logs error
- **Frontend**: User-friendly error messages in payment-status
- **Backend**: Input validation, try-catch, 400/500 responses
- **Webhook**: Not used (server cron handles billing)

### Features Implemented

✅ Embedded Payment Element (no redirects)  
✅ 12-hour/weekly/monthly intervals  
✅ Auto-charge & complete after duration  
✅ Payment method saved  
✅ Progress tracking in [`orders.html`](orders.html)  
✅ Hybrid: PI + DB scheduling
