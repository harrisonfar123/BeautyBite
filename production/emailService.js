const nodemailer = require('nodemailer');

// Email configuration - same pattern as working NetSheet
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'mail.beautybite.co',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: (process.env.EMAIL_SECURE === 'true') || (parseInt(process.env.EMAIL_PORT || '465') === 465),
    auth: {
        user: process.env.EMAIL_USER || 'orderlog@beautybite.co',
        pass: process.env.EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
};

console.log('[EmailService] Initializing with config:', {
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    user: EMAIL_CONFIG.auth.user
});

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email server connection error:', error.message);
    } else {
        console.log('✅ Email server ready');
    }
});

// Helper: Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Helper: Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper: Format date short
function formatDateShort(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Generate order confirmation email HTML
function generateOrderConfirmationEmail(orderLog) {
    const {
        order_type,
        quantity,
        amount,
        period_number,
        total_periods,
        created_at,
        product_type,
        billing_name
    } = orderLog;

    const productName = {
        'standard': 'BeautyBite Standard Mouthguard',
        'bulk': 'Bulk Clear Mouthguards',
        'custom': 'Custom 3D Branded Mouthguards'
    }[product_type] || 'BeautyBite Mouthguard';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;">
        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:40px 20px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;">BeautyBite</h1>
        </div>
        <div style="padding:40px 30px;">
            <h2 style="color:#667eea;margin-bottom:20px;">✅ Order Confirmed</h2>
            <p style="font-size:16px;line-height:1.6;margin-bottom:20px;">
                Thank you ${billing_name || ''} for your order!
            </p>
            <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:30px 0;">
                <h3 style="margin:0 0 15px 0;color:#333;">Order Details</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:8px 0;color:#666;">Product:</td>
                        <td style="padding:8px 0;text-align:right;font-weight:bold;">${productName}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#666;">Quantity:</td>
                        <td style="padding:8px 0;text-align:right;font-weight:bold;">${quantity}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#666;">Amount:</td>
                        <td style="padding:8px 0;text-align:right;font-weight:bold;color:#667eea;">${formatCurrency(amount)}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#666;">Date:</td>
                        <td style="padding:8px 0;text-align:right;font-weight:bold;">${formatDateShort(created_at)}</td>
                    </tr>
                </table>
            </div>
            <div style="margin-top:40px;padding-top:30px;border-top:2px solid #eee;text-align:center;color:#999;font-size:14px;">
                <p style="margin:0;">© ${new Date().getFullYear()} BeautyBite. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    const subject = '✅ Order Confirmed - BeautyBite';
    return { subject, html };
}

// Generate supplier order log email
function generateSupplierOrderLogEmail(orders, startDate, endDate) {
    const totalOrders = orders.length;
    const totalQuantity = orders.reduce((sum, o) => sum + parseInt(o.quantity || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);

    const oneTimeOrders = orders.filter(o => o.order_type === 'one-time');
    const subscriptions = orders.filter(o => o.order_type === 'subscription');
    const renewals = orders.filter(o => o.order_type === 'subscription_renewal');

    const orderRows = orders.map(order => `
        <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;">${order.id}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${formatDateShort(order.created_at)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${order.product_type || 'standard'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${order.order_type === 'one-time' ? 'One-Time' : order.order_type === 'subscription' ? 'Subscription' : 'Renewal'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${order.quantity}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${formatCurrency(order.amount)}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:0.85em;">${order.billing_email || 'N/A'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">${order.period_number && order.total_periods ? `${order.period_number}/${order.total_periods}` : '-'}</td>
        </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
    <div style="max-width:900px;margin:20px auto;background:#ffffff;border-radius:10px;overflow:hidden;">
        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:30px 20px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;">📦 BeautyBite Order Log</h1>
            <p style="color:#ffffff;margin:10px 0 0 0;opacity:0.9;">
                ${formatDateShort(startDate)} - ${formatDateShort(endDate)}
            </p>
        </div>
        <div style="padding:30px;">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:30px;">
                <div style="background:#f8f9fa;padding:20px;border-radius:8px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#667eea;">${totalOrders}</div>
                    <div style="color:#666;margin-top:5px;">Total Orders</div>
                </div>
                <div style="background:#f8f9fa;padding:20px;border-radius:8px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#28a745;">${totalQuantity}</div>
                    <div style="color:#666;margin-top:5px;">Mouthguards Ordered</div>
                </div>
                <div style="background:#f8f9fa;padding:20px;border-radius:8px;text-align:center;">
                    <div style="font-size:32px;font-weight:bold;color:#764ba2;">${formatCurrency(totalRevenue)}</div>
                    <div style="color:#666;margin-top:5px;">Total Revenue</div>
                </div>
            </div>
            <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:30px;">
                <h3 style="margin:0 0 15px 0;color:#333;">Order Breakdown</h3>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;">
                    <div>
                        <div style="font-weight:bold;color:#667eea;">One-Time Orders</div>
                        <div style="color:#666;font-size:14px;">${oneTimeOrders.length} orders · ${oneTimeOrders.reduce((s, o) => s + parseInt(o.quantity || 0), 0)} units</div>
                        <div style="font-weight:bold;margin-top:5px;">${formatCurrency(oneTimeOrders.reduce((s, o) => s + parseFloat(o.amount || 0), 0))}</div>
                    </div>
                    <div>
                        <div style="font-weight:bold;color:#28a745;">New Subscriptions</div>
                        <div style="color:#666;font-size:14px;">${subscriptions.length} orders · ${subscriptions.reduce((s, o) => s + parseInt(o.quantity || 0), 0)} units</div>
                        <div style="font-weight:bold;margin-top:5px;">${formatCurrency(subscriptions.reduce((s, o) => s + parseFloat(o.amount || 0), 0))}</div>
                    </div>
                    <div>
                        <div style="font-weight:bold;color:#ffc107;">Renewals</div>
                        <div style="color:#666;font-size:14px;">${renewals.length} orders · ${renewals.reduce((s, o) => s + parseInt(o.quantity || 0), 0)} units</div>
                        <div style="font-weight:bold;margin-top:5px;">${formatCurrency(renewals.reduce((s, o) => s + parseFloat(o.amount || 0), 0))}</div>
                    </div>
                </div>
            </div>
            <h3 style="margin:0 0 15px 0;color:#333;">Detailed Order Log</h3>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">ID</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Date</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Product</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Type</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Qty</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Amount</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Customer</th>
                            <th style="padding:12px 10px;text-align:left;border-bottom:2px solid #dee2e6;">Period</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    const subject = `📦 BeautyBite Order Log - ${totalOrders} Orders`;
    return { subject, html };
}

// Send order confirmation email
async function sendOrderConfirmationEmail(orderLog) {
    try {
        if (!orderLog.billing_email) {
            console.log('⚠️  No email address provided, skipping email');
            return null;
        }

        const { subject, html } = generateOrderConfirmationEmail(orderLog);

        const platformSender = EMAIL_CONFIG.auth.user;
        const displayName = 'BeautyBite';

        const mailOptions = {
            from: `${displayName} <${platformSender}>`,
            envelope: {
                from: platformSender,
                to: orderLog.billing_email
            },
            to: orderLog.billing_email,
            subject: subject,
            html: html
        };

        console.log('[sendOrderConfirmation] Sending from:', platformSender, 'to:', orderLog.billing_email);

        // Verify before sending - same as NetSheet
        await transporter.verify().catch(() => null);
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Confirmation email sent to ${orderLog.billing_email}: ${info.messageId}`);
        return info;

    } catch (error) {
        console.error('❌ Failed to send order confirmation email:', error.message);
        throw error;
    }
}

// Send supplier order log email
async function sendSupplierOrderLog(orders, supplierEmail, startDate, endDate) {
    try {
        if (!supplierEmail) {
            throw new Error('Supplier email not configured');
        }

        if (!orders || orders.length === 0) {
            console.log('⚠️  No orders to send to supplier');
            return null;
        }

        const { subject, html } = generateSupplierOrderLogEmail(orders, startDate, endDate);

        const platformSender = EMAIL_CONFIG.auth.user;
        const displayName = 'BeautyBite Orders';

        const mailOptions = {
            from: `${displayName} <${platformSender}>`,
            envelope: {
                from: platformSender,
                to: supplierEmail
            },
            to: supplierEmail,
            subject: subject,
            html: html
        };

        console.log('[sendSupplierLog] Sending from:', platformSender, 'to:', supplierEmail);

        // Verify before sending - same as NetSheet
        await transporter.verify().catch(() => null);
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Supplier order log sent to ${supplierEmail}: ${info.messageId}`);
        return info;

    } catch (error) {
        console.error('❌ Failed to send supplier order log:', error.message);
        throw error;
    }
}

module.exports = {
    sendOrderConfirmationEmail,
    sendSupplierOrderLog
};