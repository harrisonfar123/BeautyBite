const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'mail.beautybite.co',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'orderlog@beautybite.co',
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server ready');
    }
});

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Helper function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Email template for one-time purchase
function generateOneTimePurchaseEmail(orderData) {
    const { quantity, amount, billing_name, stripe_payment_intent_id, created_at } = orderData;

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; }
        .total { font-size: 1.3em; color: #667eea; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Order Confirmed!</h1>
            <p>Thank you for your purchase, ${billing_name || 'Valued Customer'}!</p>
        </div>
        
        <div class="content">
            <p>Your order has been confirmed and will be processed shortly.</p>
            
            <div class="order-details">
                <h2>Order Details</h2>
                <div class="detail-row">
                    <span class="label">Product:</span>
                    <span>BeautyBite Mouthguards</span>
                </div>
                <div class="detail-row">
                    <span class="label">Quantity:</span>
                    <span>${quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Order Date:</span>
                    <span>${formatDate(created_at)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Payment ID:</span>
                    <span style="font-size: 0.85em; color: #666;">${stripe_payment_intent_id}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Total Paid:</span>
                    <span class="total">${formatCurrency(amount)}</span>
                </div>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <ul>
                <li>Your order is being prepared</li>
                <li>You'll receive a shipping confirmation soon</li>
                <li>Track your order anytime on your dashboard</li>
            </ul>
            
            <center>
                <a href="https://beautybite-36e5434be6c8.herokuapp.com/orders.html" class="button">View Order Status</a>
            </center>
        </div>
        
        <div class="footer">
            <p>Questions? Reply to this email or visit beautybite.co</p>
            <p>© 2026 BeautyBite. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Email template for subscription start
function generateSubscriptionEmail(orderData) {
    const { quantity, amount, billing_name, stripe_payment_intent_id, created_at, period_number, total_periods, interval } = orderData;

    const intervalLabel = interval.charAt(0).toUpperCase() + interval.slice(1);

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; }
        .total { font-size: 1.3em; color: #667eea; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Subscription Started!</h1>
            <p>Welcome to your BeautyBite subscription, ${billing_name || 'Valued Customer'}!</p>
        </div>
        
        <div class="content">
            <p>Your subscription has been activated and your first payment processed.</p>
            
            <div class="order-details">
                <h2>Subscription Details</h2>
                <div class="detail-row">
                    <span class="label">Product:</span>
                    <span>BeautyBite Mouthguards (Subscription)</span>
                </div>
                <div class="detail-row">
                    <span class="label">Quantity:</span>
                    <span>${quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Billing Cycle:</span>
                    <span>${intervalLabel}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Period:</span>
                    <span>${period_number} of ${total_periods}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Order Date:</span>
                    <span>${formatDate(created_at)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Payment ID:</span>
                    <span style="font-size: 0.85em; color: #666;">${stripe_payment_intent_id}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Amount Paid:</span>
                    <span class="total">${formatCurrency(amount)}</span>
                </div>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <ul>
                <li>Your subscription is now active</li>
                <li>Next payment automatically in ${intervalLabel.toLowerCase()}</li>
                <li>Manage your subscription anytime in your dashboard</li>
            </ul>
            
            <center>
                <a href="https://beautybite-36e5434be6c8.herokuapp.com/dashboard.html" class="button">Manage Subscription</a>
            </center>
        </div>
        
        <div class="footer">
            <p>Questions? Reply to this email or visit beautybite.co</p>
            <p>© 2026 BeautyBite. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Email template for subscription renewal
function generateRenewalEmail(orderData) {
    const { quantity, amount, billing_name, stripe_payment_intent_id, created_at, period_number, total_periods, interval } = orderData;

    const intervalLabel = interval.charAt(0).toUpperCase() + interval.slice(1);

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; }
        .total { font-size: 1.3em; color: #667eea; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Subscription Payment Confirmed</h1>
            <p>Payment received for your BeautyBite subscription, ${billing_name || 'Valued Customer'}!</p>
        </div>
        
        <div class="content">
            <p>Your recurring payment has been successfully processed.</p>
            
            <div class="order-details">
                <h2>Payment Details</h2>
                <div class="detail-row">
                    <span class="label">Product:</span>
                    <span>BeautyBite Mouthguards (Renewal)</span>
                </div>
                <div class="detail-row">
                    <span class="label">Quantity:</span>
                    <span>${quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Billing Cycle:</span>
                    <span>${intervalLabel}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Period:</span>
                    <span>${period_number} of ${total_periods}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Payment Date:</span>
                    <span>${formatDate(created_at)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Payment ID:</span>
                    <span style="font-size: 0.85em; color: #666;">${stripe_payment_intent_id}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Amount Charged:</span>
                    <span class="total">${formatCurrency(amount)}</span>
                </div>
            </div>
            
            <p><strong>Your Subscription</strong></p>
            <ul>
                <li>Subscription remains active</li>
                <li>Next payment due in ${intervalLabel.toLowerCase()}</li>
                <li>View status and history in your dashboard</li>
            </ul>
            
            <center>
                <a href="https://beautybite-36e5434be6c8.herokuapp.com/dashboard.html" class="button">View Subscription Status</a>
            </center>
        </div>
        
        <div class="footer">
            <p>Questions? Reply to this email or visit beautybite.co</p>
            <p>© 2026 BeautyBite. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Send order confirmation email based on order type
async function sendOrderConfirmationEmail(orderData) {
    if (!orderData.billing_email) {
        console.log('⚠️ No billing_email for order, skipping email');
        return;
    }

    let subject, html;
    switch (orderData.order_type) {
        case 'one-time':
            subject = '✅ Order Confirmed - BeautyBite Mouthguards';
            html = generateOneTimePurchaseEmail(orderData);
            break;
        case 'subscription':
            subject = '✅ Subscription Started - BeautyBite';
            html = generateSubscriptionEmail(orderData);
            break;
        case 'subscription_renewal':
            subject = '✅ Subscription Renewal Confirmed - BeautyBite';
            html = generateRenewalEmail(orderData);
            break;
        default:
            console.log('❌ Unknown order_type:', orderData.order_type);
            return;
    }

    const mailOptions = {
        from: `"BeautyBite" <${process.env.EMAIL_USER || 'orderlog@beautybite.co'}>`,
        to: orderData.billing_email,
        subject,
        html
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent to ${orderData.billing_email} for ${orderData.order_type}`);
}

// Send test email
async function sendTestEmail(testEmail) {
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h1 style="color: #667eea;">✅ Test Email Successful!</h1>
    <p>Hello!</p>
    <p>This test confirms your BeautyBite email service is configured and working correctly.</p>
    <p><strong>Server Details:</strong></p>
    <ul>
        <li>Host: ${process.env.EMAIL_HOST || 'mail.beautybite.co'}</li>
        <li>Port: ${process.env.EMAIL_PORT || 465}</li>
    </ul>
    <p>Best regards,<br>BeautyBite Team</p>
</body>
</html>
    `;

    const mailOptions = {
        from: `"BeautyBite Test" <${process.env.EMAIL_USER || 'orderlog@beautybite.co'}>`,
        to: testEmail,
        subject: '🧪 Test Email - BeautyBite Order Confirmation System',
        html
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Test email sent to ${testEmail}`);
}

module.exports = {
    sendOrderConfirmationEmail,
    sendTestEmail
};