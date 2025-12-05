import mongoose from 'mongoose';

const specificationSchema = new mongoose.Schema({
    material: {
        type: String,
        required: [true, 'Material is required'],
        trim: true
    },
    materialGrade: {
        type: String,
        enum: ['standard', 'premium', 'medical_grade', 'food_grade'],
        default: 'standard'
    },
    dimensions: {
        length: {
            type: Number,
            min: 0
        },
        width: {
            type: Number,
            min: 0
        },
        height: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['mm', 'cm', 'inch'],
            default: 'mm'
        },
        tolerance: {
            type: Number,
            default: 0.1
        }
    },
    weight: {
        value: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['g', 'kg', 'oz', 'lb'],
            default: 'g'
        }
    },
    colorOptions: [{
        name: String,
        hexCode: String,
        image: String,
        available: { type: Boolean, default: true }
    }],
    compatibility: [{
        device: String,
        model: String,
        years: String
    }],
    features: [{
        name: String,
        description: String,
        icon: String
    }],
    careInstructions: {
        type: String,
        maxlength: 1000
    },
    warranty: {
        duration: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['days', 'months', 'years'],
            default: 'months'
        },
        details: {
            type: String,
            maxlength: 500
        },
        coverage: [String]
    },
    certifications: [{
        name: String,
        authority: String,
        certificateNumber: String,
        validUntil: Date
    }],
    safetyStandards: [String]
}, {
    _id: false
});

const pricingSchema = new mongoose.Schema({
    basePrice: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Base price cannot be negative']
    },
    salePrice: {
        type: Number,
        min: 0,
        validate: {
            validator: function (value) {
                return !value || value <= this.basePrice;
            },
            message: 'Sale price cannot exceed base price'
        }
    },
    costPrice: {
        type: Number,
        min: 0
    },
    margin: {
        type: Number,
        min: 0,
        max: 100
    },
    bulkPricing: [{
        minQuantity: {
            type: Number,
            required: true,
            min: 1
        },
        maxQuantity: {
            type: Number,
            min: 1,
            validate: {
                validator: function (value) {
                    return !value || value > this.minQuantity;
                },
                message: 'Max quantity must be greater than min quantity'
            }
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        discountPercentage: {
            type: Number,
            min: 0,
            max: 100
        }
    }],
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    },
    tax: {
        rate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        inclusive: { type: Boolean, default: false }
    }
}, {
    _id: false
});

const inventorySchema = new mongoose.Schema({
    quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    reserved: {
        type: Number,
        default: 0,
        min: 0
    },
    available: {
        type: Number,
        default: 0,
        min: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 10,
        min: 0
    },
    outOfStockThreshold: {
        type: Number,
        default: 0,
        min: 0
    },
    trackQuantity: {
        type: Boolean,
        default: true
    },
    allowBackorder: {
        type: Boolean,
        default: false
    },
    backorderLimit: {
        type: Number,
        default: 0,
        min: 0
    },
    stockLocation: {
        warehouse: String,
        aisle: String,
        bin: String
    },
    reorderPoint: {
        type: Number,
        default: 0,
        min: 0
    },
    reorderQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    lastRestocked: Date,
    nextRestock: Date,
    supplier: {
        name: String,
        contact: String,
        leadTime: Number // days
    }
}, {
    _id: false
});

const shippingSchema = new mongoose.Schema({
    weight: {
        type: Number,
        min: 0
    },
    weightUnit: {
        type: String,
        enum: ['g', 'kg', 'oz', 'lb'],
        default: 'g'
    },
    dimensions: {
        length: {
            type: Number,
            min: 0
        },
        width: {
            type: Number,
            min: 0
        },
        height: {
            type: Number,
            min: 0
        },
        unit: {
            type: String,
            enum: ['mm', 'cm', 'inch'],
            default: 'cm'
        }
    },
    requiresShipping: {
        type: Boolean,
        default: true
    },
    shippingClass: String,
    handlingTime: {
        type: Number,
        default: 1,
        min: 0
    },
    freeShipping: {
        available: { type: Boolean, default: false },
        minimumOrder: { type: Number, default: 0 }
    },
    restrictions: {
        countries: [String],
        states: [String],
        zipCodes: [String]
    }
}, {
    _id: false
});

const seoSchema = new mongoose.Schema({
    metaTitle: {
        type: String,
        maxlength: 60
    },
    metaDescription: {
        type: String,
        maxlength: 160
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    keywords: [String],
    canonicalUrl: String,
    openGraph: {
        title: String,
        description: String,
        image: String,
        type: {
            type: String,
            enum: ['website', 'product'],
            default: 'product'
        }
    },
    twitterCard: {
        title: String,
        description: String,
        image: String,
        cardType: {
            type: String,
            enum: ['summary', 'summary_large_image', 'app', 'player'],
            default: 'summary_large_image'
        }
    },
    structuredData: mongoose.Schema.Types.Mixed
}, {
    _id: false
});

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        maxlength: 100
    },
    comment: {
        type: String,
        maxlength: 1000
    },
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    helpful: {
        count: { type: Number, default: 0 },
        users: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    images: [{
        url: String,
        alt: String,
        order: Number
    }],
    response: {
        by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        message: String,
        respondedAt: Date
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

const categorySchema = new mongoose.Schema({
    main: {
        type: String,
        required: true,
        enum: [
            'dental-guards',
            'mouthguards',
            'custom-fittings',
            'accessories',
            'preventive-care',
            'orthodontic',
            'sports-dental'
        ],
        index: true
    },
    subcategory: {
        type: String,
        trim: true,
        index: true
    },
    type: {
        type: String,
        enum: ['adult', 'youth', 'child', 'universal'],
        default: 'universal'
    },
    condition: {
        type: String,
        enum: ['preventive', 'therapeutic', 'cosmetic', 'maintenance'],
        default: 'preventive'
    }
}, {
    _id: false
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [100, 'Product name cannot exceed 100 characters'],
        index: 'text'
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    shortDescription: {
        type: String,
        maxlength: [250, 'Short description cannot exceed 250 characters']
    },
    brand: {
        type: String,
        trim: true,
        maxlength: 50,
        index: true
    },
    type: {
        type: String,
        enum: {
            values: ['standard', 'bulk', 'custom', 'digital', 'subscription'],
            message: '{VALUE} is not a valid product type'
        },
        required: true,
        default: 'standard',
        index: true
    },
    category: categorySchema,
    sku: {
        type: String,
        required: [true, 'SKU is required'],
        unique: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9\-_]+$/, 'SKU can only contain uppercase letters, numbers, hyphens, and underscores']
    },
    upc: {
        type: String,
        sparse: true,
        unique: true,
        match: [/^\d{12,13}$/, 'UPC must be 12 or 13 digits']
    },
    mpn: {
        type: String, // Manufacturer Part Number
        sparse: true
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        alt: {
            type: String,
            maxlength: 125
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        order: {
            type: Number,
            default: 0
        },
        size: {
            width: Number,
            height: Number
        },
        format: {
            type: String,
            enum: ['jpg', 'png', 'webp', 'gif'],
            default: 'jpg'
        }
    }],
    model3d: {
        url: String,
        format: {
            type: String,
            enum: ['glb', 'gltf', 'obj', 'stl'],
            default: 'glb'
        },
        fileSize: Number,
        previewImage: String,
        vertices: Number,
        polygons: Number,
        optimized: { type: Boolean, default: false }
    },
    pricing: pricingSchema,
    specifications: specificationSchema,
    inventory: inventorySchema,
    shipping: shippingSchema,
    seo: seoSchema,
    tags: [{
        name: String,
        slug: String,
        type: {
            type: String,
            enum: ['material', 'usage', 'feature', 'benefit', 'custom'],
            default: 'custom'
        }
    }],
    relatedProducts: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        relationType: {
            type: String,
            enum: ['cross-sell', 'up-sell', 'accessory', 'complementary'],
            default: 'cross-sell'
        },
        priority: {
            type: Number,
            default: 1,
            min: 1,
            max: 10
        }
    }],
    reviews: [reviewSchema],
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
            set: function (val) {
                return Math.round(val * 10) / 10; // Round to 1 decimal place
            }
        },
        count: {
            type: Number,
            default: 0
        },
        distribution: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 }
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isFeatured: {
        type: Boolean,
        default: false,
        index: true
    },
    isNew: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    customOptions: {
        available: {
            type: Boolean,
            default: false
        },
        options: [{
            name: {
                type: String,
                required: true
            },
            type: {
                type: String,
                enum: ['text', 'color', 'file', 'select', 'checkbox', 'radio'],
                required: true
            },
            required: {
                type: Boolean,
                default: false
            },
            choices: [{
                value: String,
                label: String,
                priceAdjustment: Number,
                image: String
            }],
            priceAdjustment: Number,
            validation: {
                minLength: Number,
                maxLength: Number,
                pattern: String
            }
        }]
    },
    subscriptionOptions: {
        available: {
            type: Boolean,
            default: false
        },
        plans: [{
            interval: {
                type: String,
                enum: ['monthly', 'quarterly', 'yearly'],
                required: true
            },
            price: {
                type: Number,
                required: true,
                min: 0
            },
            discount: {
                type: Number,
                min: 0,
                max: 100
            },
            description: String,
            features: [String],
            trialPeriod: {
                days: Number,
                price: Number
            }
        }]
    },
    production: {
        required: { type: Boolean, default: false },
        productionTime: {
            min: { type: Number, default: 3 }, // days
            max: { type: Number, default: 7 }  // days
        },
        complexity: {
            type: String,
            enum: ['simple', 'moderate', 'complex'],
            default: 'simple'
        },
        materials: [String],
        tools: [String]
    },
    audit: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        version: {
            type: Number,
            default: 1
        }
    },
    metadata: {
        viewCount: { type: Number, default: 0 },
        purchaseCount: { type: Number, default: 0 },
        wishlistCount: { type: Number, default: 0 },
        searchCount: { type: Number, default: 0 },
        lastPurchased: Date
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.audit;
            delete ret.metadata;
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Compound indexes for better query performance
productSchema.index({ 'category.main': 1, 'category.subcategory': 1, isActive: 1 });
productSchema.index({ type: 1, isActive: 1 });
productSchema.index({ 'pricing.basePrice': 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ 'tags.name': 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ 'inventory.available': -1 });
productSchema.index({ 'metadata.purchaseCount': -1 });
productSchema.index({ 'seo.slug': 1 });

// Text search index
productSchema.index({
    name: 'text',
    description: 'text',
    'tags.name': 'text',
    brand: 'text',
    'category.main': 'text',
    'category.subcategory': 'text'
});

// Virtual for sale status
productSchema.virtual('isOnSale').get(function () {
    return this.pricing.salePrice && this.pricing.salePrice < this.pricing.basePrice;
});

// Virtual for in stock status
productSchema.virtual('inStock').get(function () {
    if (!this.inventory.trackQuantity) return true;
    return this.inventory.available > 0 || this.inventory.allowBackorder;
});

// Virtual for low stock status
productSchema.virtual('isLowStock').get(function () {
    if (!this.inventory.trackQuantity) return false;
    return this.inventory.available > 0 && this.inventory.available <= this.inventory.lowStockThreshold;
});

// Virtual for out of stock status
productSchema.virtual('isOutOfStock').get(function () {
    if (!this.inventory.trackQuantity) return false;
    return this.inventory.available <= this.inventory.outOfStockThreshold;
});

// Virtual for sale discount percentage
productSchema.virtual('discountPercentage').get(function () {
    if (!this.isOnSale) return 0;
    return Math.round(((this.pricing.basePrice - this.pricing.salePrice) / this.pricing.basePrice) * 100);
});

// Virtual for days since creation
productSchema.virtual('daysSinceCreation').get(function () {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Virtual for isNew (less than 30 days)
productSchema.virtual('isRecentlyAdded').get(function () {
    return this.daysSinceCreation < 30;
});

// Pre-save middleware to calculate available inventory
productSchema.pre('save', function (next) {
    this.inventory.available = Math.max(0, this.inventory.quantity - this.inventory.reserved);

    // Auto-calculate margin if cost price is set
    if (this.pricing.costPrice && this.pricing.basePrice > 0) {
        this.pricing.margin = ((this.pricing.basePrice - this.pricing.costPrice) / this.pricing.basePrice) * 100;
    }

    next();
});

// Pre-save middleware to generate slug from name
productSchema.pre('save', function (next) {
    if (this.isModified('name') && !this.seo.slug) {
        this.seo.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }
    next();
});

// Method to get current price
productSchema.methods.getCurrentPrice = function (quantity = 1) {
    let price = this.pricing.basePrice;

    // Apply sale price if available
    if (this.pricing.salePrice && this.pricing.salePrice < price) {
        price = this.pricing.salePrice;
    }

    // Apply bulk pricing if applicable
    if (this.pricing.bulkPricing && this.pricing.bulkPricing.length > 0) {
        const bulkPrice = this.pricing.bulkPricing
            .sort((a, b) => b.minQuantity - a.minQuantity)
            .find(bp => quantity >= bp.minQuantity && (!bp.maxQuantity || quantity <= bp.maxQuantity));

        if (bulkPrice) {
            price = bulkPrice.price;
        }
    }

    return price;
};

// Method to update inventory
productSchema.methods.updateInventory = function (quantityChange, operation = 'adjust') {
    if (this.inventory.trackQuantity) {
        switch (operation) {
            case 'adjust':
                this.inventory.quantity += quantityChange;
                break;
            case 'set':
                this.inventory.quantity = quantityChange;
                break;
            case 'reserve':
                this.inventory.reserved += quantityChange;
                break;
            case 'release':
                this.inventory.reserved = Math.max(0, this.inventory.reserved - quantityChange);
                break;
        }

        // Recalculate available inventory
        this.inventory.available = Math.max(0, this.inventory.quantity - this.inventory.reserved);

        if (this.inventory.available < 0 && !this.inventory.allowBackorder) {
            throw new Error('Insufficient inventory');
        }
    }
    return this.save();
};

// Method to add review and update rating
productSchema.methods.addReview = function (reviewData) {
    this.reviews.push(reviewData);

    // Update rating statistics
    const approvedReviews = this.reviews.filter(review => review.status === 'approved');
    if (approvedReviews.length > 0) {
        const totalRating = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
        this.rating.average = totalRating / approvedReviews.length;
        this.rating.count = approvedReviews.length;

        // Update rating distribution
        this.rating.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        approvedReviews.forEach(review => {
            this.rating.distribution[review.rating]++;
        });
    }

    return this.save();
};

// Method to soft delete
productSchema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
};

// Method to restore
productSchema.methods.restore = function () {
    this.deletedAt = null;
    this.isActive = true;
    return this.save();
};

// Method to check if product requires production
productSchema.methods.requiresProduction = function () {
    return this.production.required || this.type === 'custom';
};

// Static method to get featured products
productSchema.statics.getFeatured = function (limit = 10) {
    return this.find({
        isFeatured: true,
        isActive: true,
        deletedAt: null
    })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get products by category
productSchema.statics.getByCategory = function (category, options = {}) {
    const {
        limit = 20,
        skip = 0,
        sortBy = 'rating.average',
        sortOrder = -1
    } = options;

    const query = {
        'category.main': category,
        isActive: true,
        deletedAt: null
    };

    return this.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);
};

// Static method to get new products
productSchema.statics.getNewProducts = function (limit = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.find({
        createdAt: { $gte: thirtyDaysAgo },
        isActive: true,
        deletedAt: null
    })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get low stock products
productSchema.statics.getLowStock = function () {
    return this.find({
        'inventory.trackQuantity': true,
        'inventory.available': {
            $lte: '$inventory.lowStockThreshold',
            $gt: 0
        },
        isActive: true,
        deletedAt: null
    })
        .sort({ 'inventory.available': 1 });
};

// Static method to search products
productSchema.statics.search = function (query, options = {}) {
    const {
        limit = 20,
        skip = 0,
        category,
        priceRange,
        inStock
    } = options;

    const searchQuery = {
        $text: { $search: query },
        isActive: true,
        deletedAt: null
    };

    if (category) {
        searchQuery['category.main'] = category;
    }

    if (priceRange) {
        searchQuery['pricing.basePrice'] = {
            $gte: priceRange.min || 0,
            $lte: priceRange.max || Number.MAX_SAFE_INTEGER
        };
    }

    if (inStock !== undefined) {
        if (inStock) {
            searchQuery['inventory.available'] = { $gt: 0 };
        } else {
            searchQuery['inventory.available'] = { $lte: 0 };
        }
    }

    return this.find(searchQuery)
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit);
};

// Static method to get product statistics
productSchema.statics.getProductStats = function () {
    return this.aggregate([
        {
            $match: {
                isActive: true,
                deletedAt: null
            }
        },
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
                outOfStockProducts: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$inventory.trackQuantity', true] },
                                    { $lte: ['$inventory.available', 0] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                lowStockProducts: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$inventory.trackQuantity', true] },
                                    {
                                        $and: [
                                            { $gt: ['$inventory.available', 0] },
                                            { $lte: ['$inventory.available', '$inventory.lowStockThreshold'] }
                                        ]
                                    }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                averageRating: { $avg: '$rating.average' },
                totalInventoryValue: {
                    $sum: {
                        $multiply: ['$inventory.quantity', '$pricing.basePrice']
                    }
                }
            }
        }
    ]);
};

// Query helper to exclude deleted products
productSchema.query.active = function () {
    return this.where({
        isActive: true,
        deletedAt: null
    });
};

// Transform output
productSchema.methods.toJSON = function () {
    const product = this.toObject();
    product.isOnSale = this.isOnSale;
    product.inStock = this.inStock;
    product.isLowStock = this.isLowStock;
    product.isOutOfStock = this.isOutOfStock;
    product.discountPercentage = this.discountPercentage;
    product.daysSinceCreation = this.daysSinceCreation;
    product.isRecentlyAdded = this.isRecentlyAdded;
    return product;
};

const Product = mongoose.model('Product', productSchema);

export default Product;