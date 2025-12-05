import express from 'express';
import Product from '../models/Product.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// @desc    Get all products
// @route   GET /api/products
// @access  Public
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        // Build query
        let query = { isActive: true };

        // Filter by category
        if (req.query.category) {
            query.category = req.query.category;
        }

        // Filter by type
        if (req.query.type) {
            query.type = req.query.type;
        }

        // Filter by tags
        if (req.query.tags) {
            query.tags = { $in: req.query.tags.split(',') };
        }

        // Search by name or description
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { 'seo.keywords': { $in: [new RegExp(req.query.search, 'i')] } }
            ];
        }

        // Filter by price range
        if (req.query.minPrice || req.query.maxPrice) {
            query['pricing.basePrice'] = {};
            if (req.query.minPrice) {
                query['pricing.basePrice'].$gte = parseFloat(req.query.minPrice);
            }
            if (req.query.maxPrice) {
                query['pricing.basePrice'].$lte = parseFloat(req.query.maxPrice);
            }
        }

        // Filter by in stock
        if (req.query.inStock === 'true') {
            query.$or = [
                { 'inventory.trackQuantity': false },
                {
                    'inventory.trackQuantity': true,
                    $or: [
                        { 'inventory.quantity': { $gt: 0 } },
                        { 'inventory.allowBackorder': true }
                    ]
                }
            ];
        }

        // Sort options
        let sort = {};
        switch (req.query.sort) {
            case 'price_asc':
                sort = { 'pricing.basePrice': 1 };
                break;
            case 'price_desc':
                sort = { 'pricing.basePrice': -1 };
                break;
            case 'name_asc':
                sort = { name: 1 };
                break;
            case 'name_desc':
                sort = { name: -1 };
                break;
            case 'rating':
                sort = { 'rating.average': -1 };
                break;
            case 'newest':
                sort = { createdAt: -1 };
                break;
            case 'featured':
                sort = { isFeatured: -1, createdAt: -1 };
                break;
            default:
                sort = { createdAt: -1 };
        }

        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select('-compressedDesign'); // Exclude large binary data

        const total = await Product.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            count: products.length,
            total,
            pagination: {
                page,
                limit,
                totalPages,
                hasNextPage,
                hasPrevPage,
                nextPage: hasNextPage ? page + 1 : null,
                prevPage: hasPrevPage ? page - 1 : null
            },
            filters: {
                category: req.query.category,
                type: req.query.type,
                search: req.query.search,
                minPrice: req.query.minPrice,
                maxPrice: req.query.maxPrice,
                inStock: req.query.inStock,
                sort: req.query.sort
            },
            products
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        let product;

        // Try by ID first
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product.findById(req.params.id);
        }

        // If not found by ID, try by slug
        if (!product) {
            product = await Product.findOne({
                'seo.slug': req.params.id,
                isActive: true
            });
        }

        // If still not found, try by SKU
        if (!product) {
            product = await Product.findOne({
                sku: req.params.id.toUpperCase(),
                isActive: true
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Increment view count (optional)
        // product.views = (product.views || 0) + 1;
        // await product.save();

        res.status(200).json({
            success: true,
            product
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get product pricing
// @route   GET /api/products/:id/pricing
// @access  Public
router.get('/:id/pricing', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).select('pricing type inventory');

        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const quantity = parseInt(req.query.quantity) || 1;
        const currentPrice = product.getCurrentPrice(quantity);

        res.status(200).json({
            success: true,
            pricing: {
                basePrice: product.pricing.basePrice,
                salePrice: product.pricing.salePrice,
                currentPrice,
                currency: product.pricing.currency,
                isOnSale: product.isOnSale,
                bulkPricing: product.pricing.bulkPricing
            },
            inventory: {
                quantity: product.inventory.quantity,
                inStock: product.inStock,
                isLowStock: product.isLowStock,
                allowBackorder: product.inventory.allowBackorder
            }
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
router.get('/category/:category', optionalAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const products = await Product.getByCategory(
            req.params.category,
            limit,
            skip
        );

        const total = await Product.countDocuments({
            category: req.params.category,
            isActive: true
        });

        res.status(200).json({
            success: true,
            category: req.params.category,
            count: products.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            products
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', optionalAuth, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 8;

        const products = await Product.getFeatured(limit);

        res.status(200).json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get related products
// @route   GET /api/products/:id/related
// @access  Public
router.get('/:id/related', optionalAuth, async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        const limit = parseInt(req.query.limit) || 4;

        // Find related products by category, tags, or manual relations
        let relatedProducts = [];

        // Use manually defined related products first
        if (product.relatedProducts && product.relatedProducts.length > 0) {
            relatedProducts = await Product.find({
                _id: { $in: product.relatedProducts },
                isActive: true
            }).limit(limit);
        }

        // If not enough, find by category and tags
        if (relatedProducts.length < limit) {
            const additionalProducts = await Product.find({
                _id: { $ne: product._id },
                category: product.category,
                isActive: true,
                _id: { $nin: relatedProducts.map(p => p._id) }
            })
                .limit(limit - relatedProducts.length);

            relatedProducts = [...relatedProducts, ...additionalProducts];
        }

        // If still not enough, find by tags
        if (relatedProducts.length < limit && product.tags && product.tags.length > 0) {
            const tagProducts = await Product.find({
                _id: { $ne: product._id },
                tags: { $in: product.tags },
                isActive: true,
                _id: { $nin: relatedProducts.map(p => p._id) }
            })
                .limit(limit - relatedProducts.length);

            relatedProducts = [...relatedProducts, ...tagProducts];
        }

        res.status(200).json({
            success: true,
            count: relatedProducts.length,
            products: relatedProducts
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get product categories
// @route   GET /api/products/categories/list
// @access  Public
router.get('/categories/list', async (req, res, next) => {
    try {
        const categories = await Product.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    featuredCount: {
                        $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            count: categories.length,
            categories
        });
    } catch (error) {
        next(error);
    }
});

// Admin routes below - require authentication and admin role

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', authenticate, authorize('admin'), validateRequest('product'), async (req, res, next) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            product
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', authenticate, authorize('admin'), validateRequest('product'), async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            product
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Soft delete - set isActive to false
        product.isActive = false;
        await product.save();

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Bulk update products
// @route   PUT /api/products/bulk/update
// @access  Private/Admin
router.put('/bulk/update', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { productIds, updateFields } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Product IDs array is required'
            });
        }

        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            updateFields,
            { runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} products updated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        next(error);
    }
});

// @desc    Get product statistics
// @route   GET /api/products/stats/overview
// @access  Private/Admin
router.get('/stats/overview', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const stats = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    featuredProducts: {
                        $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] }
                    },
                    outOfStock: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$inventory.trackQuantity', true] },
                                        { $lte: ['$inventory.quantity', 0] },
                                        { $eq: ['$inventory.allowBackorder', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    lowStock: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$inventory.trackQuantity', true] },
                                        { $gt: ['$inventory.quantity', 0] },
                                        { $lte: ['$inventory.quantity', '$inventory.lowStockThreshold'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    averagePrice: { $avg: '$pricing.basePrice' },
                    totalInventoryValue: {
                        $sum: {
                            $multiply: ['$pricing.basePrice', '$inventory.quantity']
                        }
                    }
                }
            }
        ]);

        const categoryStats = await Product.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    averagePrice: { $avg: '$pricing.basePrice' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.status(200).json({
            success: true,
            stats: stats[0] || {},
            categories: categoryStats
        });
    } catch (error) {
        next(error);
    }
});

export default router;