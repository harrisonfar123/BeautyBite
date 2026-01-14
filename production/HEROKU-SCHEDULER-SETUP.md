# HEROKU SCHEDULER SETUP - AUTOMATED SUBSCRIPTION BILLING

This guide will set up Heroku Scheduler to automatically process subscription payments every hour (or every 10 minutes for testing).

═══════════════════════════════════════════════════════════
WHAT IS HEROKU SCHEDULER?
═══════════════════════════════════════════════════════════

Heroku Scheduler is an add-on that runs commands on a schedule:

- Every 10 minutes
- Every hour
- Daily at a specific time

We'll use it to call your `/api/cron/process-subscriptions` endpoint automatically.

Cost: **FREE** ✅

═══════════════════════════════════════════════════════════
STEP 1: VERIFY SCHEDULER IS INSTALLED
═══════════════════════════════════════════════════════════

[`bash(heroku addons -a beautybite | grep scheduler)`](server.js)

# Check if scheduler addon exists

heroku addons -a beautybite | grep scheduler

# Should show

# scheduler-deep-44097 (scheduler:standard)  free

If NOT installed, run:
[`bash(heroku addons:create scheduler:standard -a beautybite)`](server.js)

═══════════════════════════════════════════════════════════
STEP 2: OPEN SCHEDULER DASHBOARD
═══════════════════════════════════════════════════════════

**Option A: Via Command Line (Easiest)**
[`bash(heroku addons:open scheduler -a beautybite)`](server.js)

This will open your browser to the Heroku Scheduler dashboard.

**Option B: Via Heroku Dashboard**

1. Go to: <https://dashboard.heroku.com/apps/beautybite>
2. Click "Resources" tab
3. Find "Heroku Scheduler" in the Add-ons list
4. Click on it to open dashboard

═══════════════════════════════════════════════════════════
STEP 3: CREATE SCHEDULED JOB (TESTING MODE - 10 MINUTES)
═══════════════════════════════════════════════════════════

In the Heroku Scheduler dashboard:

1. **Click "Create job"** or **"Add Job"** button

2. **Fill in the form:**

   **Schedule:**
   - Select: **"Every 10 minutes"**
   - (This is for testing - you'll see charges happen quickly)

   **Command:**
   - Paste this EXACT command:

   ```
   curl -X POST https://beautybite-36e5434be6c8.herokuapp.com/api/cron/process-subscriptions
   ```

   **Dyno Size:**
   - Leave as "Standard-1X" (default)

3. **Click "Save"**

You should now see:

```
Job created successfully
Frequency: Every 10 minutes
Command: curl -X POST https://beautybite-36e5434be6c8.herokuapp.com/api/cron/process-subscriptions
Next run: [timestamp]
```

═══════════════════════════════════════════════════════════
STEP 4: VERIFY IT'S WORKING
═══════════════════════════════════════════════════════════

**A. Check Scheduler Dashboard**

You should see:

- **Status:** Active ✅
- **Last run:** [timestamp]
- **Next run:** [timestamp in ~10 minutes]
- **Last exit code:** 0 (success)

**B. Watch Heroku Logs**

[`bash(# In terminal, watch for scheduler runs)`](server.js)
heroku logs --tail -a beautybite | grep "cron\\|subscription"

# You should see every 10 minutes

# 🔄 Processing due subscriptions

# ✅ Finished processing subscriptions

**C. Check Database After 10+ Minutes**

If you have a subscription with `next_billing_date` in the past:

[`bash(heroku pg:psql -a beautybite -c "SELECT id, quantity_per_period, total_periods, periods_completed, status, next_billing_date FROM subscriptions WHERE status = 'active';")`](server.js)

After scheduler runs, you should see:

- `periods_completed` increased
- `next_billing_date` moved forward
- Status changed to `completed` if all periods done

═══════════════════════════════════════════════════════════
STEP 5: CREATE TEST SUBSCRIPTION
═══════════════════════════════════════════════════════════

Now that scheduler is running every 10 minutes, create a test subscription:

1. Go to: <https://beautybite-36e5434be6c8.herokuapp.com/shop.html>
2. Click "Subscribe Now"
3. Enter:
   - **Quantity:** 2 mouthguards
   - **Interval:** Every 12 Hours
   - **Duration:** 3 periods
4. Pay with test card: 4242 4242 4242 4242

**What You'll See:**

**Immediately:**

- First charge: $400
- Database: `periods_completed: 1, total_periods: 3, status: active`
- Next billing: 12 hours from now

**After 12 Hours:**

- Scheduler detects subscription is due (next_billing_date <= NOW)
- Auto-charges $400
- Database: `periods_completed: 2, total_periods: 3, status: active`
- Next billing: 24 hours from creation

**After 24 Hours:**

- Scheduler auto-charges $400
- Database: `periods_completed: 3, total_periods: 3, status: completed` ✅
- No more charges (auto-cancelled)

═══════════════════════════════════════════════════════════
STEP 6: SWITCH TO HOURLY (PRODUCTION MODE)
═══════════════════════════════════════════════════════════

After testing works, switch to hourly:

1. Open Scheduler dashboard again:
   [`bash(heroku addons:open scheduler -a beautybite)`](server.js)

2. Find your job and click **"Edit"** or the job name

3. Change **Schedule** to: **"Every hour"**

4. Click **"Save"**

**Why Hourly?**

- Reduces dyno usage (less frequent checks)
- Still checks often enough (subscriptions due within 1 hour get processed)
- Good balance for production

**For different intervals:**

- 12-hour subscriptions: Hourly is perfect ✅
- Weekly subscriptions: Hourly is perfect ✅
- Monthly subscriptions: Hourly is perfect ✅
- Every 10 minutes: Only for testing ⚠️

═══════════════════════════════════════════════════════════
STEP 7: MONITOR & TROUBLESHOOT
═══════════════════════════════════════════════════════════

**View Scheduler Runs:**
[`bash(# See all recent scheduler runs)`](server.js)
heroku logs --source scheduler --tail -a beautybite

**Check for Errors:**
[`bash(# Filter for errors)`](server.js)
heroku logs --tail -a beautybite | grep "ERROR\\|❌"

**Common Issues:**

**Issue 1: Job shows "Failed" in dashboard**

- **Cause:** API endpoint returned error
- **Check:** `heroku logs --tail -a beautybite`
- **Fix:** Debug the `/api/cron/process-subscriptions` endpoint

**Issue 2: "Last exit code: 1"**

- **Cause:** Curl command failed
- **Check:** Test manually: `curl -X POST https://beautybite-36e5434be6c8.herokuapp.com/api/cron/process-subscriptions`
- **Fix:** Verify URL is correct

**Issue 3: No logs appear**

- **Cause:** Scheduler not running
- **Check:** Scheduler dashboard shows "Next run"
- **Fix:** Re-save the job

**Issue 4: Subscriptions not being charged**

- **Cause:** `next_billing_date` is in the future
- **Check:**
  [`bash(heroku pg:psql -a beautybite -c "SELECT id, next_billing_date, NOW() FROM subscriptions WHERE status = 'active';")`](server.js)
- **Fix:** Wait until `next_billing_date <= NOW()`

═══════════════════════════════════════════════════════════
STEP 8: ADVANCED - VIEW SCHEDULER HISTORY
═══════════════════════════════════════════════════════════

**See Last 100 Scheduler Runs:**
[`bash(heroku logs --source scheduler --num 100 -a beautybite)`](server.js)

**Check Specific Subscription Processing:**
[`bash(heroku logs --tail -a beautybite | grep "subscription 2")`](server.js)

# Shows logs for subscription ID 2

**Monitor Successful Charges:**
[`bash(heroku pg:psql -a beautybite -c "SELECT s.id, sp.period_number, sp.amount, sp.status, sp.created_at FROM subscription_payments sp JOIN subscriptions s ON sp.subscription_id = s.id ORDER BY sp.created_at DESC LIMIT 10;"` )`](server.js)

═══════════════════════════════════════════════════════════
TESTING CHECKLIST
═══════════════════════════════════════════════════════════

Run through this after setting up scheduler:

[ ] Scheduler addon installed (`heroku addons | grep scheduler`)
[ ] Job created in scheduler dashboard
[ ] Frequency set to "Every 10 minutes" (testing)
[ ] Command is correct curl POST to /api/cron/process-subscriptions
[ ] Job status shows "Active"
[ ] Created test subscription (3 periods, 12-hour interval)
[ ] First payment succeeded immediately
[ ] Database shows: periods_completed=1, status=active
[ ] Waited 12+ hours
[ ] Second payment auto-charged (check logs)
[ ] Database shows: periods_completed=2, status=active
[ ] Waited another 12 hours
[ ] Third payment auto-charged
[ ] Database shows: periods_completed=3, status=completed ✅
[ ] No 4th charge attempted (auto-cancelled)
[ ] Switched scheduler to "Every hour" for production
[ ] Monitoring with `heroku logs --tail`

═══════════════════════════════════════════════════════════
QUICK REFERENCE
═══════════════════════════════════════════════════════════

**Open Scheduler:**
[`bash(heroku addons:open scheduler -a beautybite)`](server.js)

**Watch Scheduler Logs:**
[`bash(heroku logs --source scheduler --tail -a beautybite)`](server.js)

**Check Active Subscriptions:**
[`bash(heroku pg:psql -a beautybite -c "SELECT id, quantity_per_period, interval, total_periods, periods_completed, status, next_billing_date FROM subscriptions WHERE status = 'active';")`](server.js)

**Check Payment History:**
[`bash(heroku pg:psql -a beautybite -c "SELECT subscription_id, period_number, amount, status, created_at FROM subscription_payments ORDER BY created_at DESC LIMIT 10;"` )`](server.js)

**Manual Trigger (Testing):**
[`bash(curl -X POST https://beautybite-36e5434be6c8.herokuapp.com/api/cron/process-subscriptions)`](server.js)

═══════════════════════════════════════════════════════════
FINAL NOTES
═══════════════════════════════════════════════════════════

✅ **Scheduler is free** - No cost for standard plan
✅ **Jobs run automatically** - No manual intervention needed
✅ **Reliable** - Heroku handles scheduling, retries, etc.
✅ **Production-ready** - Used by thousands of apps

Your subscription system is now **fully automated**:

- Customers subscribe once
- Auto-billed every 12 hours/week/month
- Auto-cancelled after X periods
- Zero manual work ✅

Just set up the scheduler job and let it run! 🚀
