import express from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// All routes are protected except webhook
router.use((req, res, next) => {
    if (req.path === '/webhook') {
        next();
    } else {
        authenticate(req, res, next);
    }
});

// @desc    Create payment intent for cart items
// @route   POST /api/payments/create-intent
// @access  Private
router.post('/create-intent', async (req, res, next) => {
    try {
        const { items, customerInfo, savePaymentMethod } = req.body;

        // Validate required data
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No items in cart'
            });
        }

        if (!customerInfo) {
            return res.status(400).json({
                success: false,
                error: 'Customer information required'
            });
        }

        // Calculate total amount from cart items
        const totalAmount = items.reduce((total, item) => {
            return total + (item.priceInfo?.subtotal || 0);
        }, 0);

        if (totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order total'
            });
        }

        // Get or create Stripe customer
        let customerId = req.user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.fullName,
                metadata: {
                    userId: req.user.id.toString()
                }
            });

            customerId = customer.id;

            // Save customer ID to user
            await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
        }

        // Create order in database first
        const order = new Order({
            userId: req.user.id,
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                price: item.priceInfo.subtotal,
                customization: item.customization,
                purchasingOption: item.purchasingOption
            })),
            customerInfo: customerInfo,
            pricing: {
                subtotal: totalAmount,
                tax: totalAmount * 0.08, // 8% tax for example
                shipping: 9.99, // Fixed shipping for example
                total: totalAmount + (totalAmount * 0.08) + 9.99
            },
            status: 'pending',
            paymentStatus: 'pending'
        });

        await order.save();

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.pricing.total * 100), // Convert to cents
            currency: 'usd',
            customer: customerId,
            setup_future_usage: savePaymentMethod ? 'on_session' : undefined,
            metadata: {
                orderId: order._id.toString(),
                userId: req.user.id.toString()
            },
            description: `Order ${order.orderNumber} - BeautyBite`,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Update order with payment intent ID
        order.paymentDetails = {
            paymentIntentId: paymentIntent.id,
            provider: 'stripe'
        };
        await order.save();

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntent: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency
            },
            order: {
                id: order._id,
                orderNumber: order.orderNumber
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create checkout session for Stripe Checkout
// @route   POST /api/payments/create-checkout-session
// @access  Private
router.post('/create-checkout-session', async (req, res, next) => {
    try {
        const { items, customerInfo, isSubscription, successUrl, cancelUrl } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No items in cart'
            });
        }

        // Get or create Stripe customer
        let customerId = req.user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.fullName,
                metadata: {
                    userId: req.user.id.toString()
                }
            });

            customerId = customer.id;
            await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
        }

        // Calculate total amount
        const totalAmount = items.reduce((total, item) => {
            return total + (item.priceInfo?.subtotal || 0);
        }, 0);

        // Create order in database
        const order = new Order({
            userId: req.user.id,
            items: items,
            customerInfo: customerInfo,
            pricing: {
                subtotal: totalAmount,
                tax: totalAmount * 0.08,
                shipping: 9.99,
                total: totalAmount + (totalAmount * 0.08) + 9.99
            },
            status: 'pending',
            paymentStatus: 'pending'
        });

        await order.save();

        // Create line items for Stripe Checkout
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.productName,
                    description: item.customization ? `Custom: ${JSON.stringify(item.customization)}` : undefined,
                },
                unit_amount: Math.round((item.priceInfo.subtotal / item.quantity) * 100), // Price per unit
            },
            quantity: item.quantity,
        }));

        // Add tax and shipping as separate line items
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Tax',
                },
                unit_amount: Math.round(totalAmount * 0.08 * 100),
            },
            quantity: 1,
        });

        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Shipping',
                },
                unit_amount: Math.round(9.99 * 100),
            },
            quantity: 1,
        });

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: isSubscription ? 'subscription' : 'payment',
            success_url: successUrl || `${process.env.FRONTEND_URL}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/checkout.html`,
            metadata: {
                orderId: order._id.toString(),
                userId: req.user.id.toString()
            },
            customer_email: customerInfo?.email || req.user.email,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'AU'],
            },
        });

        res.status(200).json({
            success: true,
            sessionId: session.id
        });

    } catch (error) {
        next(error);
    }
});

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
router.post('/confirm', async (req, res, next) => {
    try {
        const { paymentIntentId } = req.body;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Find order by payment intent ID
            const order = await Order.findOne({
                'paymentDetails.paymentIntentId': paymentIntentId
            });

            if (order) {
                await order.updatePaymentStatus('paid', {
                    transactionId: paymentIntent.charges.data[0]?.id,
                    paidAt: new Date()
                });

                // Update order status to confirmed
                await order.updateStatus('confirmed', 'Payment confirmed');

                return res.status(200).json({
                    success: true,
                    message: 'Payment confirmed successfully',
                    order: {
                        id: order._id,
                        orderNumber: order.orderNumber,
                        status: order.status,
                        paymentStatus: order.paymentStatus
                    }
                });
            }
        }

        res.status(400).json({
            success: false,
            error: 'Payment not confirmed'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
// @access  Public (Stripe calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// Webhook event handlers
async function handlePaymentIntentSucceeded(paymentIntent) {
    const order = await Order.findOne({
        'paymentDetails.paymentIntentId': paymentIntent.id
    });

    if (order) {
        await order.updatePaymentStatus('paid', {
            transactionId: paymentIntent.charges.data[0]?.id,
            paidAt: new Date()
        });

        // Update order status
        await order.updateStatus('confirmed', 'Payment received via webhook');

        console.log(`Order ${order.orderNumber} payment confirmed via webhook`);
    }
}

async function handlePaymentIntentFailed(paymentIntent) {
    const order = await Order.findOne({
        'paymentDetails.paymentIntentId': paymentIntent.id
    });

    if (order) {
        await order.updatePaymentStatus('failed');
        await order.updateStatus('failed', 'Payment failed');

        console.log(`Order ${order.orderNumber} payment failed`);
    }
}

async function handleInvoicePaymentSucceeded(invoice) {
    const subscription = await Subscription.findOne({
        subscriptionId: invoice.subscription
    });

    if (subscription) {
        // Add invoice to subscription
        await subscription.addInvoice({
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid / 100, // Convert from cents
            status: invoice.status,
            date: new Date(invoice.created * 1000),
            invoicePdf: invoice.invoice_pdf,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000)
        });

        // Update subscription period
        subscription.currentPeriod = {
            start: new Date(invoice.period_start * 1000),
            end: new Date(invoice.period_end * 1000)
        };

        // Calculate next order
        await subscription.calculateNextOrder();

        console.log(`Subscription ${subscription._id} invoice paid`);
    }
}

async function handleInvoicePaymentFailed(invoice) {
    const subscription = await Subscription.findOne({
        subscriptionId: invoice.subscription
    });

    if (subscription) {
        await subscription.updateStatus('past_due', 'Invoice payment failed');
        console.log(`Subscription ${subscription._id} payment failed`);
    }
}

async function handleSubscriptionUpdated(subscriptionData) {
    const subscription = await Subscription.findOne({
        subscriptionId: subscriptionData.id
    });

    if (subscription) {
        subscription.status = subscriptionData.status;
        subscription.cancelAtPeriodEnd = subscriptionData.cancel_at_period_end;

        if (subscriptionData.current_period_start && subscriptionData.current_period_end) {
            subscription.currentPeriod = {
                start: new Date(subscriptionData.current_period_start * 1000),
                end: new Date(subscriptionData.current_period_end * 1000)
            };
        }

        await subscription.save();
        console.log(`Subscription ${subscription._id} updated`);
    }
}

async function handleSubscriptionDeleted(subscriptionData) {
    const subscription = await Subscription.findOne({
        subscriptionId: subscriptionData.id
    });

    if (subscription) {
        await subscription.updateStatus('cancelled', 'Subscription deleted in Stripe');
        console.log(`Subscription ${subscription._id} cancelled via Stripe`);
    }
}

// @desc    Get user's payment methods
// @route   GET /api/payments/methods
// @access  Private
router.get('/methods', async (req, res, next) => {
    try {
        if (!req.user.stripeCustomerId) {
            return res.status(200).json({
                success: true,
                paymentMethods: []
            });
        }

        const paymentMethods = await stripe.paymentMethods.list({
            customer: req.user.stripeCustomerId,
            type: 'card'
        });

        const formattedMethods = paymentMethods.data.map(method => ({
            id: method.id,
            type: method.type,
            card: {
                brand: method.card.brand,
                last4: method.card.last4,
                expMonth: method.card.exp_month,
                expYear: method.card.exp_year
            },
            created: method.created
        }));

        res.status(200).json({
            success: true,
            paymentMethods: formattedMethods
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create setup intent for saving payment method
// @route   POST /api/payments/setup-intent
// @access  Private
router.post('/setup-intent', async (req, res, next) => {
    try {
        if (!req.user.stripeCustomerId) {
            return res.status(400).json({
                success: false,
                error: 'No Stripe customer found'
            });
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: req.user.stripeCustomerId,
            payment_method_types: ['card']
        });

        res.status(200).json({
            success: true,
            clientSecret: setupIntent.client_secret
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Refund payment
// @route   POST /api/payments/refund
// @access  Private
router.post('/refund', async (req, res, next) => {
    try {
        const { orderId, amount, reason } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to refund this order'
            });
        }

        if (order.paymentStatus !== 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Order is not paid'
            });
        }

        const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.pricing.total * 100);

        const refund = await stripe.refunds.create({
            payment_intent: order.paymentDetails.paymentIntentId,
            amount: refundAmount,
            reason: reason || 'requested_by_customer'
        });

        // Update order payment status
        const isFullRefund = refundAmount === Math.round(order.pricing.total * 100);
        await order.updatePaymentStatus(isFullRefund ? 'refunded' : 'partially_refunded', {
            refundAmount: refundAmount / 100
        });

        if (isFullRefund) {
            await order.updateStatus('cancelled', 'Order refunded');
        }

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            refund: {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status,
                reason: refund.reason
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get payment status
// @route   GET /api/payments/status/:paymentIntentId
// @access  Private
router.get('/status/:paymentIntentId', async (req, res, next) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);

        res.status(200).json({
            success: true,
            paymentIntent: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                customer: paymentIntent.customer,
                created: paymentIntent.created
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create subscription
// @route   POST /api/subscriptions/create
// @access  Private
router.post('/create-subscription', async (req, res, next) => {
    try {
        const { planId, customerInfo } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                error: 'Plan ID is required'
            });
        }

        // Get or create Stripe customer
        let customerId = req.user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.fullName,
                metadata: {
                    userId: req.user.id.toString()
                }
            });

            customerId = customer.id;
            await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
        }

        // Map plan IDs to Stripe price IDs (you need to set these in your Stripe dashboard)
        const priceMap = {
            monthly: 'price_monthly_live_id', // Replace with actual live price ID
            quarterly: 'price_quarterly_live_id', // Replace with actual live price ID
            annual: 'price_annual_live_id' // Replace with actual live price ID
        };

        const priceId = priceMap[planId];
        if (!priceId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan ID'
            });
        }

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                userId: req.user.id.toString(),
                planId: planId
            }
        });

        // Create subscription record in database
        const subscriptionRecord = new Subscription({
            userId: req.user.id,
            subscriptionId: subscription.id,
            planId: planId,
            status: subscription.status,
            currentPeriod: {
                start: new Date(subscription.current_period_start * 1000),
                end: new Date(subscription.current_period_end * 1000)
            },
            priceId: priceId
        });

        await subscriptionRecord.save();

        res.status(200).json({
            success: true,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                planId: planId
            },
            clientSecret: subscription.latest_invoice.payment_intent.client_secret
        });

    } catch (error) {
        next(error);
    }
});

export default router;