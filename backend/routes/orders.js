import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { authenticate, checkOwnership } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes are protected
router.use(authenticate);

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;

        const orders = await Order.getByUser(req.user.id, {
            status,
            limit,
            skip: (page - 1) * limit
        });

        const total = await Order.countDocuments({ userId: req.user.id });

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            orders
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', checkOwnership(Order), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.productId', 'name images specifications')
            .populate('items.customDesignId', 'name designData.previewImages');

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', validateRequest('order'), async (req, res, next) => {
    try {
        const { items, shippingAddress, billingAddress, shippingMethod, customerNotes } = req.body;

        // Calculate order totals and validate items
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);

            if (!product || !product.isActive) {
                return res.status(400).json({
                    success: false,
                    error: `Product ${item.productId} not found or inactive`
                });
            }

            // Check inventory
            if (product.inventory.trackQuantity &&
                product.inventory.quantity < item.quantity &&
                !product.inventory.allowBackorder) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient inventory for product: ${product.name}`
                });
            }

            const unitPrice = product.getCurrentPrice(item.quantity);
            const totalPrice = unitPrice * item.quantity;
            subtotal += totalPrice;

            orderItems.push({
                productId: item.productId,
                customDesignId: item.customDesignId,
                quantity: item.quantity,
                unitPrice,
                totalPrice,
                productSnapshot: {
                    name: product.name,
                    description: product.description,
                    images: product.images,
                    sku: product.sku,
                    specifications: product.specifications
                },
                customizationDetails: item.customizationDetails
            });
        }

        // Calculate taxes (simplified - 8.5% sales tax)
        const taxRate = 0.085;
        const tax = subtotal * taxRate;

        // Calculate total
        const total = subtotal + shippingMethod.cost + tax;

        // Create order
        const order = await Order.create({
            userId: req.user.id,
            items: orderItems,
            pricing: {
                subtotal,
                shipping: shippingMethod.cost,
                tax,
                total,
                currency: 'USD'
            },
            taxes: [{
                rate: taxRate,
                amount: tax,
                type: 'sales'
            }],
            shippingAddress,
            billingAddress,
            shippingMethod,
            customerNotes
        });

        // Update inventory
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (product.inventory.trackQuantity) {
                await product.updateInventory(-item.quantity);
            }
        }

        res.status(201).json({
            success: true,
            order
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', checkOwnership(Order), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'Order is already cancelled'
            });
        }

        if (order.status === 'shipped' || order.status === 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel order that has been shipped'
            });
        }

        await order.updateStatus('cancelled', 'Cancelled by user', req.user.id);

        // Restore inventory
        for (const item of order.items) {
            const product = await Product.findById(item.productId);
            if (product && product.inventory.trackQuantity) {
                await product.updateInventory(item.quantity);
            }
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get order invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
router.get('/:id/invoice', checkOwnership(Order), async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.productId', 'name sku')
            .populate('items.customDesignId', 'name');

        // In a real implementation, you would generate a PDF invoice
        // For now, return the order data in a structured format for invoice display
        const invoice = {
            invoiceNumber: order.orderNumber,
            invoiceDate: order.createdAt,
            orderDate: order.createdAt,
            billingAddress: order.billingAddress,
            shippingAddress: order.shippingAddress,
            items: order.items.map(item => ({
                name: item.productSnapshot?.name || 'Product',
                sku: item.productSnapshot?.sku || 'N/A',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                customDesign: item.customDesignId ? 'Yes' : 'No'
            })),
            subtotal: order.pricing.subtotal,
            shipping: order.pricing.shipping,
            tax: order.pricing.tax,
            discount: order.pricing.discount,
            total: order.pricing.total,
            currency: order.pricing.currency
        };

        res.status(200).json({
            success: true,
            invoice
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update order tracking
// @route   PUT /api/orders/:id/tracking
// @access  Private
router.put('/:id/tracking', checkOwnership(Order), async (req, res, next) => {
    try {
        const { carrier, trackingNumber, trackingUrl } = req.body;

        const order = await Order.findById(req.params.id);

        await order.addTracking({
            carrier,
            trackingNumber,
            trackingUrl
        });

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Request order return
// @route   POST /api/orders/:id/return
// @access  Private
router.post('/:id/return', checkOwnership(Order), async (req, res, next) => {
    try {
        const { items, reason, notes } = req.body;

        const order = await Order.findById(req.params.id);

        if (order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'Can only return delivered orders'
            });
        }

        // Check if within return period
        const returnDeadline = new Date(order.createdAt);
        returnDeadline.setDate(returnDeadline.getDate() + order.returnPolicy.days);

        if (new Date() > returnDeadline) {
            return res.status(400).json({
                success: false,
                error: 'Return period has expired'
            });
        }

        // In a real implementation, you would create a return request
        // For now, return a success message
        res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
            returnId: `RETURN_${Date.now()}`,
            estimatedRefund: order.pricing.total // Simplified
        });
    } catch (error) {
        next(error);
    }
});

export default router;