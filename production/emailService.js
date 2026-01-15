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

// Generate supplier order log email
function generateSupplierOrderLogEmail(orders, startDate, endDate) {
    const oneTimeOrders = orders.filter(o => o.order_type === 'one-time');
    const subscriptionOrders = orders.filter(o => o.order_type === 'subscription');
    const renewalOrders = orders.filter(o => o.order_type === 'subscription_renewal');
    
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.amount), 0);
    const totalQuantity = orders.reduce((sum, o) => sum + parseInt(o.quantity), 0);
    
    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const orderRows = orders.map(order => `
    <tr>
            <td style="padding:10px;border-bottom:1px solid #eee">${order.id}</td>
            <td style="padding:10px;border-bottom:1px solid #eee">${formatDate(order.created_at)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee">${order.order_type === 'one-time' ? 'One-Time' : order.order_type === 'subscription' ? 'Subscription' : 'Renewal'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee">${order.quantity}</td>
            <td style="padding:10px;border-bottom:1px solid #eee">${formatCurrency(order.amount)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:0.85em">${order.billing_email || 'N/A'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee">${order.period_number && order.total_periods ? `${order.period_number}/${order.total_periods}` : '-'}</td>
        </tr>
    `).join('');
    
    return `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
    .container{max-width:900px;margin:0 auto;padding:20px}
    .header{background:#2c3e50;color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .summary{display:flex;justify-content:space-around;margin:20px 0;background:white;padding:20px;border-radius:5px}
    .stat{text-align:center}
    .stat-number{font-size:2em;color:#667eea;font-weight:bold}
    .stat-label{color:#666;font-size:0.9em}
    table{width:100%;border-collapse:collapse;background:white;border-radius:5px;overflow:hidden;margin:20px 0}
    th{background:#667eea;color:white;padding:12px;text-align:left}
    .section{margin:20px 0;padding:15px;background:white;border-radius:5px}
    .footer{text-align:center;padding:20px;color:#666;font-size:0.9em}
</style></head><body>
        <div class="container">
            <div class="header">
                <h1>📦 BeautyBite Order Log</h1>
                <p>Orders from ${formatDate(startDate)} to ${formatDate(endDate)}</p>
            </div>
            <div class="content">
                <div class="summary">
                    <div class="stat">
                        <div class="stat-number">${orders.length}</div>
                        <div class="stat-label">Total Orders</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${totalQuantity}</div>
                        <div class="stat-label">Mouthguards Ordered</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${formatCurrency(totalRevenue)}</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                </div>

                <div class="section">
                    <h3>Order Breakdown</h3>
                    <p>
                        <strong>One-Time Orders:</strong> ${oneTimeOrders.length}
                        (${oneTimeOrders.reduce((sum, o) => sum + parseInt(o.quantity), 0)} units,
                        ${formatCurrency(oneTimeOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0))})
                    </p>
                    <p>
                        <strong>New Subscriptions:</strong> ${subscriptionOrders.length}
                        (${subscriptionOrders.reduce((sum, o) => sum + parseInt(o.quantity), 0)} units,
                        ${formatCurrency(subscriptionOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0))})
                    </p>
                    <p>
                        <strong>Subscription Renewals:</strong> ${renewalOrders.length}
                        (${renewalOrders.reduce((sum, o) => sum + parseInt(o.quantity), 0)} units,
                        ${formatCurrency(renewalOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0))})
                    </p>
                </div>

                <h3>Detailed Order Log</h3>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Amount</th>
                            <th>Customer Email</th>
                            <th>Period</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                </table>

                <div class="section">
                    <h3>Production Requirements</h3>
                    <p><strong>Total Mouthguards to Prepare:</strong> ${totalQuantity} units</p>
                    <p><strong>Expected Revenue:</strong> ${formatCurrency(totalRevenue)}</p>
                </div>
            </div>
            <div class="footer">
                <p>BeautyBite Automated Order Report</p>
                <p>Generated: ${formatDate(new Date())}</p>
            </div>
        </div>
    </body></html>`;
}

// Send supplier order log email
async function sendSupplierOrderLog(orders, supplierEmail, startDate, endDate) {
    try {
        if (!orders || orders.length === 0) {
            console.log('⚠️  No orders to send to supplier');
            return null;
        }
        
        const subject = `📦 BeautyBite Order Log - ${orders.length} Orders (${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()})`;
        const html = generateSupplierOrderLogEmail(orders, startDate, endDate);
        
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'BeautyBite Orders <orderlog@beautybite.co>',
            to: supplierEmail,
            subject: subject,
            html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Supplier order log sent to ${supplierEmail}: ${info.messageId}`);
        return info;
        
    } catch (error) {
        console.error('❌ Failed to send supplier order log:', error);
        throw error;
    }
}

module.exports = { sendOrderConfirmationEmail, sendTestEmail, sendSupplierOrderLog };