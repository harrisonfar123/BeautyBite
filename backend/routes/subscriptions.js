import express from 'express';
import Subscription from '../models/Subscription.js';
import Product from '../models/Product.js';
import { authenticate, checkOwnership } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

// @desc    Get user's subscriptions
// @route   GET /api/subscriptions
// @access  Private
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;

        const subscriptions = await Subscription.getByUser(req.user.id, {
            status,
            limit,
            skip: (page - 1) * limit
        });

        const total = await Subscription.countDocuments({ userId: req.user.id });

        res.status(200).json({
            success: true,
            count: subscriptions.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            subscriptions
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get single subscription
// @route   GET /api/subscriptions/:id
// @access  Private
router.get('/:id', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id)
            .populate('items.productId', 'name images pricing specifications')
            .populate('items.customDesignId', 'name designData.previewImages');

        res.status(200).json({
            success: true,
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create new subscription
// @route   POST /api/subscriptions
// @access  Private
router.post('/', validateRequest('subscription'), async (req, res, next) => {
    try {
        const { productId, plan, quantity, shippingAddress, deliveryPreferences } = req.body;

        const product = await Product.findById(productId);

        if (!product || !product.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Product not found or inactive'
            });
        }

        if (!product.subscriptionOptions.available) {
            return res.status(400).json({
                success: false,
                error: 'Product does not support subscriptions'
            });
        }

        // Find the selected plan
        const selectedPlan = product.subscriptionOptions.plans.find(
            p => p.interval === plan
        );

        if (!selectedPlan) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription plan'
            });
        }

        // Calculate pricing
        const unitPrice = selectedPlan.price;
        const totalPrice = unitPrice * quantity;

        // Set subscription interval based on plan
        let interval, intervalCount;
        switch (plan) {
            case 'monthly':
                interval = 'month';
                intervalCount = 1;
                break;
            case 'quarterly':
                interval = 'month';
                intervalCount = 3;
                break;
            case 'yearly':
                interval = 'year';
                intervalCount = 1;
                break;
        }

        // Calculate current period
        const now = new Date();
        const currentPeriodEnd = new Date(now);

        switch (plan) {
            case 'monthly':
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
                break;
            case 'quarterly':
                currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
                break;
            case 'yearly':
                currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
                break;
        }

        // Create subscription
        const subscription = await Subscription.create({
            userId: req.user.id,
            items: [{
                productId,
                quantity,
                price: unitPrice,
                productSnapshot: {
                    name: product.name,
                    description: product.description,
                    images: product.images,
                    specifications: product.specifications
                }
            }],
            plan,
            interval,
            intervalCount,
            pricing: {
                unitPrice,
                totalPrice,
                currency: 'USD',
                discount: selectedPlan.discount || 0
            },
            currentPeriod: {
                start: now,
                end: currentPeriodEnd
            },
            billingCycle: {
                anchor: now
            },
            shippingAddress,
            deliveryPreferences
        });

        // Calculate next order
        await subscription.calculateNextOrder();

        res.status(201).json({
            success: true,
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Pause subscription
// @route   PUT /api/subscriptions/:id/pause
// @access  Private
router.put('/:id/pause', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const { resumesAt, behavior = 'void' } = req.body;

        const subscription = await Subscription.findById(req.params.id);

        if (subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Only active subscriptions can be paused'
            });
        }

        await subscription.pause(resumesAt, behavior);

        res.status(200).json({
            success: true,
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Resume subscription
// @route   PUT /api/subscriptions/:id/resume
// @access  Private
router.put('/:id/resume', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id);

        if (subscription.status !== 'paused') {
            return res.status(400).json({
                success: false,
                error: 'Only paused subscriptions can be resumed'
            });
        }

        await subscription.resume();

        res.status(200).json({
            success: true,
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Cancel subscription
// @route   PUT /api/subscriptions/:id/cancel
// @access  Private
router.put('/:id/cancel', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const { atPeriodEnd = false, reason = '' } = req.body;

        const subscription = await Subscription.findById(req.params.id);

        if (subscription.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'Subscription is already cancelled'
            });
        }

        await subscription.cancel(atPeriodEnd, reason);

        res.status(200).json({
            success: true,
            message: atPeriodEnd
                ? 'Subscription will be cancelled at the end of the billing period'
                : 'Subscription cancelled immediately',
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update subscription
// @route   PUT /api/subscriptions/:id/update
// @access  Private
router.put('/:id/update', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const { quantity, shippingAddress, deliveryPreferences } = req.body;

        const subscription = await Subscription.findById(req.params.id);

        if (subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Only active subscriptions can be updated'
            });
        }

        // Update quantity if provided
        if (quantity && quantity > 0) {
            subscription.items[0].quantity = quantity;
            subscription.pricing.totalPrice = subscription.pricing.unitPrice * quantity;
        }

        // Update shipping address if provided
        if (shippingAddress) {
            subscription.shippingAddress = shippingAddress;
        }

        // Update delivery preferences if provided
        if (deliveryPreferences) {
            subscription.deliveryPreferences = {
                ...subscription.deliveryPreferences,
                ...deliveryPreferences
            };
        }

        await subscription.save();

        res.status(200).json({
            success: true,
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Skip next delivery
// @route   PUT /api/subscriptions/:id/skip
// @access  Private
router.put('/:id/skip', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const { skipUntil } = req.body;

        const subscription = await Subscription.findById(req.params.id);

        if (subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Only active subscriptions can skip deliveries'
            });
        }

        subscription.deliveryPreferences.skipNext = true;
        if (skipUntil) {
            subscription.deliveryPreferences.skipUntil = new Date(skipUntil);
        }

        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Next delivery skipped successfully',
            subscription
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get subscription invoices
// @route   GET /api/subscriptions/:id/invoices
// @access  Private
router.get('/:id/invoices', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const subscription = await Subscription.findById(req.params.id).select('invoices');

        res.status(200).json({
            success: true,
            count: subscription.invoices.length,
            invoices: subscription.invoices
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get upcoming subscription orders
// @route   GET /api/subscriptions/upcoming
// @access  Private
router.get('/upcoming', async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find({
            userId: req.user.id,
            status: 'active',
            'nextOrder.estimatedDate': { $gt: new Date() },
            'deliveryPreferences.skipNext': false
        })
            .populate('items.productId', 'name images pricing')
            .sort({ 'nextOrder.estimatedDate': 1 });

        res.status(200).json({
            success: true,
            count: subscriptions.length,
            subscriptions
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update subscription payment method
// @route   PUT /api/subscriptions/:id/payment-method
// @access  Private
router.put('/:id/payment-method', checkOwnership(Subscription), async (req, res, next) => {
    try {
        const { paymentMethodId } = req.body;

        const subscription = await Subscription.findById(req.params.id);

        subscription.paymentMethod.stripePaymentMethodId = paymentMethodId;
        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Payment method updated successfully',
            subscription
        });
    } catch (error) {
        next(error);
    }
});

export default router;