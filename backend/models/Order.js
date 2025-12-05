import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    customDesignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomDesign',
        sparse: true
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
        type: Number,
        required: [true, 'Unit price is required'],
        min: [0, 'Unit price cannot be negative']
    },
    totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Total price cannot be negative']
    },
    productSnapshot: {
        name: { type: String, required: true },
        description: String,
        images: [String],
        sku: { type: String, required: true },
        specifications: mongoose.Schema.Types.Mixed,
        category: String,
        brand: String
    },
    customizationDetails: mongoose.Schema.Types.Mixed,
    taxRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    taxAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    discount: {
        amount: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        reason: String
    },
    inventoryStatus: {
        allocated: { type: Boolean, default: false },
        allocatedQuantity: { type: Number, default: 0 },
        shippedQuantity: { type: Number, default: 0 }
    }
}, {
    _id: true
});

const shippingAddressSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: 50
    },
    company: {
        type: String,
        trim: true,
        maxlength: 100
    },
    street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true,
        maxlength: 200
    },
    apartment: {
        type: String,
        trim: true,
        maxlength: 50
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: 100
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        maxlength: 100
    },
    zipCode: {
        type: String,
        required: [true, 'ZIP code is required'],
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    },
    country: {
        type: String,
        default: 'United States',
        trim: true,
        maxlength: 100
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    instructions: {
        type: String,
        maxlength: 500
    }
}, {
    _id: false
});

const billingAddressSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: 50
    },
    company: {
        type: String,
        trim: true,
        maxlength: 100
    },
    street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true,
        maxlength: 200
    },
    apartment: {
        type: String,
        trim: true,
        maxlength: 50
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: 100
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
        maxlength: 100
    },
    zipCode: {
        type: String,
        required: [true, 'ZIP code is required'],
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    },
    country: {
        type: String,
        default: 'United States',
        trim: true,
        maxlength: 100
    }
}, {
    _id: false
});

const taxSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rate: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    type: {
        type: String,
        enum: ['sales', 'vat', 'gst', 'pst', 'hst'],
        default: 'sales'
    },
    jurisdiction: String,
    isInclusive: { type: Boolean, default: false }
}, {
    _id: false
});

const shippingMethodSchema = new mongoose.Schema({
    carrier: {
        type: String,
        required: [true, 'Carrier is required'],
        enum: ['ups', 'fedex', 'usps', 'dhl', 'custom']
    },
    service: {
        type: String,
        required: [true, 'Service is required']
    },
    cost: {
        type: Number,
        required: [true, 'Cost is required'],
        min: 0
    },
    estimatedDays: {
        type: Number,
        min: 0
    },
    trackingUrl: String,
    insurance: {
        included: { type: Boolean, default: false },
        amount: { type: Number, default: 0, min: 0 }
    },
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: { type: String, default: 'cm' }
    },
    weight: {
        value: Number,
        unit: { type: String, default: 'kg' }
    }
}, {
    _id: false
});

const paymentDetailsSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['card', 'paypal', 'stripe', 'apple_pay', 'google_pay', 'bank_transfer'],
        required: true
    },
    provider: String,
    transactionId: {
        type: String,
        sparse: true
    },
    paymentIntentId: String,
    paymentMethodId: String,
    card: {
        last4: String,
        brand: String,
        expMonth: Number,
        expYear: Number,
        country: String
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    refundReason: String,
    currency: {
        type: String,
        default: 'USD'
    },
    exchangeRate: {
        type: Number,
        default: 1
    },
    fees: {
        processing: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 }
    }
}, {
    _id: false
});

const trackingSchema = new mongoose.Schema({
    carrier: String,
    trackingNumber: {
        type: String,
        sparse: true
    },
    trackingUrl: String,
    shippedAt: Date,
    estimatedDelivery: Date,
    deliveredAt: Date,
    deliveryConfirmation: {
        signedBy: String,
        deliveredTo: String,
        confirmationImage: String,
        latitude: Number,
        longitude: Number
    },
    events: [{
        date: { type: Date, required: true },
        location: String,
        description: String,
        status: String
    }]
}, {
    _id: false
});

const fulfillmentSchema = new mongoose.Schema({
    warehouse: {
        type: String,
        required: true
    },
    packedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    packedAt: Date,
    shippedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    shippedAt: Date,
    items: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        serialNumbers: [String],
        batchNumber: String
    }],
    packaging: {
        box: String,
        weight: Number,
        dimensions: {
            length: Number,
            width: Number,
            height: Number
        }
    }
}, {
    _id: false
});

const subscriptionSchema = new mongoose.Schema({
    isSubscription: {
        type: Boolean,
        default: false
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    nextOrderDate: Date,
    frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly']
    },
    cycleCount: {
        type: Number,
        default: 1
    }
}, {
    _id: false
});

const fraudCheckSchema = new mongoose.Schema({
    score: {
        type: Number,
        min: 0,
        max: 100
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'very_high'],
        default: 'low'
    },
    checkedAt: Date,
    notes: String,
    flags: [{
        type: String,
        enum: ['high_value', 'new_customer', 'suspicious_ip', 'multiple_attempts']
    }],
    decision: {
        type: String,
        enum: ['approve', 'review', 'reject'],
        default: 'approve'
    }
}, {
    _id: false
});

const returnPolicySchema = new mongoose.Schema({
    allowed: {
        type: Boolean,
        default: true
    },
    days: {
        type: Number,
        default: 30,
        min: 0
    },
    conditions: String,
    restockingFee: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    returnShipping: {
        paidBy: {
            type: String,
            enum: ['customer', 'merchant'],
            default: 'customer'
        },
        cost: {
            type: Number,
            default: 0,
            min: 0
        }
    }
}, {
    _id: false
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [orderItemSchema],
    pricing: {
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        shipping: {
            type: Number,
            required: true,
            min: 0
        },
        tax: {
            type: Number,
            required: true,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        },
        exchangeRate: {
            type: Number,
            default: 1
        }
    },
    taxes: [taxSchema],
    shippingAddress: shippingAddressSchema,
    billingAddress: billingAddressSchema,
    shippingMethod: shippingMethodSchema,
    status: {
        type: String,
        enum: {
            values: [
                'pending',
                'confirmed',
                'processing',
                'ready_for_shipment',
                'shipped',
                'out_for_delivery',
                'delivered',
                'cancelled',
                'refunded',
                'failed',
                'on_hold',
                'backordered'
            ],
            message: '{VALUE} is not a valid order status'
        },
        default: 'pending',
        index: true
    },
    statusHistory: [{
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        notes: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        system: { type: Boolean, default: false }
    }],
    paymentStatus: {
        type: String,
        enum: {
            values: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'disputed', 'chargeback'],
            message: '{VALUE} is not a valid payment status'
        },
        default: 'pending',
        index: true
    },
    paymentDetails: paymentDetailsSchema,
    tracking: trackingSchema,
    customerNotes: {
        type: String,
        maxlength: 1000
    },
    internalNotes: {
        type: String,
        maxlength: 2000
    },
    fulfillment: fulfillmentSchema,
    subscription: subscriptionSchema,
    notifications: {
        confirmationSent: { type: Boolean, default: false },
        shippingSent: { type: Boolean, default: false },
        deliverySent: { type: Boolean, default: false },
        reviewReminderSent: { type: Boolean, default: false },
        feedbackRequested: { type: Boolean, default: false }
    },
    fraudCheck: fraudCheckSchema,
    returnPolicy: returnPolicySchema,
    audit: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        ipAddress: String,
        userAgent: String,
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'admin'],
            default: 'web'
        }
    },
    metadata: {
        campaign: String,
        utmSource: String,
        utmMedium: String,
        utmCampaign: String,
        utmTerm: String,
        utmContent: String,
        referralCode: String
    },
    production: {
        required: { type: Boolean, default: false },
        status: {
            type: String,
            enum: ['not_started', 'in_progress', 'completed', 'quality_check', 'ready'],
            default: 'not_started'
        },
        estimatedCompletion: Date,
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.audit;
            delete ret.internalNotes;
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Compound indexes for better query performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });
orderSchema.index({ 'paymentDetails.transactionId': 1 });
orderSchema.index({ 'tracking.trackingNumber': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'subscription.subscriptionId': 1 });
orderSchema.index({ 'production.status': 1 });
orderSchema.index({ 'fraudCheck.riskLevel': 1 });
orderSchema.index({ 'pricing.total': -1 });
orderSchema.index({ 'shippingAddress.country': 1, createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function (next) {
    if (this.isNew) {
        const count = await this.constructor.countDocuments();
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sequence = String(count + 1).padStart(6, '0');
        this.orderNumber = `BB${year}${month}${day}${sequence}`;

        // Initialize status history
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            system: true,
            notes: 'Order created'
        });
    }
    next();
});

// Virtual for order total with tax and shipping
orderSchema.virtual('orderTotal').get(function () {
    return this.pricing.subtotal + this.pricing.shipping + this.pricing.tax - this.pricing.discount;
});

// Virtual for isShippable
orderSchema.virtual('isShippable').get(function () {
    return this.items.some(item => {
        // Check if product requires shipping (you might need to populate product details)
        return true; // Default to true, adjust based on product data
    });
});

// Virtual for estimated delivery date
orderSchema.virtual('estimatedDeliveryDate').get(function () {
    if (this.tracking.shippedAt && this.shippingMethod.estimatedDays) {
        const deliveryDate = new Date(this.tracking.shippedAt);
        deliveryDate.setDate(deliveryDate.getDate() + this.shippingMethod.estimatedDays);
        return deliveryDate;
    }
    return null;
});

// Virtual for days since order
orderSchema.virtual('daysSinceOrder').get(function () {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Virtual for isOverdue
orderSchema.virtual('isOverdue').get(function () {
    if (this.status === 'delivered' || this.status === 'cancelled') return false;

    const now = new Date();
    const created = new Date(this.createdAt);
    const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    return daysSince > 14; // Consider overdue after 14 days
});

// Virtual for canBeCancelled
orderSchema.virtual('canBeCancelled').get(function () {
    const nonCancellableStatuses = ['shipped', 'delivered', 'cancelled', 'refunded'];
    return !nonCancellableStatuses.includes(this.status);
});

// Virtual for canBeReturned
orderSchema.virtual('canBeReturned').get(function () {
    if (!this.returnPolicy.allowed) return false;
    if (this.status !== 'delivered') return false;

    const deliveredDate = this.tracking.deliveredAt || this.updatedAt;
    const returnDeadline = new Date(deliveredDate);
    returnDeadline.setDate(returnDeadline.getDate() + this.returnPolicy.days);

    return new Date() <= returnDeadline;
});

// Method to update status with history
orderSchema.methods.updateStatus = function (newStatus, notes = '', changedBy = null, system = false) {
    const oldStatus = this.status;
    this.status = newStatus;

    this.statusHistory.push({
        status: newStatus,
        notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
        changedBy,
        timestamp: new Date(),
        system
    });

    // Set timestamps for specific status changes
    if (newStatus === 'shipped' && !this.tracking.shippedAt) {
        this.tracking.shippedAt = new Date();
    } else if (newStatus === 'delivered' && !this.tracking.deliveredAt) {
        this.tracking.deliveredAt = new Date();
    }

    return this.save();
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function (newStatus, paymentDetails = {}) {
    this.paymentStatus = newStatus;

    if (newStatus === 'paid') {
        this.paymentDetails.paidAt = new Date();
    } else if (newStatus === 'refunded' || newStatus === 'partially_refunded') {
        this.paymentDetails.refundedAt = new Date();
        this.paymentDetails.refundAmount = paymentDetails.refundAmount || this.pricing.total;
        this.paymentDetails.refundReason = paymentDetails.refundReason;
    }

    Object.assign(this.paymentDetails, paymentDetails);
    return this.save();
};

// Method to add tracking information
orderSchema.methods.addTracking = function (trackingInfo) {
    Object.assign(this.tracking, trackingInfo);
    if (trackingInfo.trackingNumber && !this.tracking.shippedAt) {
        this.tracking.shippedAt = new Date();
        this.status = 'shipped';
    }
    return this.save();
};

// Method to add tracking event
orderSchema.methods.addTrackingEvent = function (event) {
    this.tracking.events.push({
        ...event,
        date: new Date()
    });
    return this.save();
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function () {
    const subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = this.taxes.reduce((sum, taxItem) => sum + taxItem.amount, 0);
    const total = subtotal + this.pricing.shipping + tax - this.pricing.discount;

    this.pricing.subtotal = subtotal;
    this.pricing.tax = tax;
    this.pricing.total = total;

    return this.save();
};

// Method to allocate inventory
orderSchema.methods.allocateInventory = function () {
    for (const item of this.items) {
        if (!item.inventoryStatus.allocated) {
            item.inventoryStatus.allocated = true;
            item.inventoryStatus.allocatedQuantity = item.quantity;
        }
    }
    return this.save();
};

// Method to mark item as shipped
orderSchema.methods.markItemShipped = function (itemId, quantity) {
    const item = this.items.id(itemId);
    if (item) {
        item.inventoryStatus.shippedQuantity += quantity;
    }
    return this.save();
};

// Method to create return
orderSchema.methods.createReturn = function (returnItems, reason, notes = '') {
    // Implementation for return creation
    // This would typically create a separate return document
    return {
        returnId: `RET_${Date.now()}`,
        orderId: this._id,
        items: returnItems,
        reason,
        notes,
        createdAt: new Date()
    };
};

// Static method to get orders by user
orderSchema.statics.getByUser = function (userId, options = {}) {
    const { status, limit = 20, skip = 0 } = options;
    const query = { userId };
    if (status) query.status = status;

    return this.find(query)
        .populate('items.productId', 'name images')
        .populate('items.customDesignId', 'name designData.previewImages')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

// Static method to get orders by status
orderSchema.statics.getByStatus = function (status, limit = 50, skip = 0) {
    return this.find({ status })
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

// Static method to get revenue statistics
orderSchema.statics.getRevenueStats = function (startDate, endDate) {
    const matchStage = {
        paymentStatus: 'paid',
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.total' },
                totalOrders: { $sum: 1 },
                averageOrderValue: { $avg: '$pricing.total' },
                totalItems: { $sum: { $size: '$items' } },
                totalTax: { $sum: '$pricing.tax' },
                totalShipping: { $sum: '$pricing.shipping' },
                totalDiscount: { $sum: '$pricing.discount' }
            }
        }
    ]);
};

// Static method to get order statistics by status
orderSchema.statics.getStatusStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalValue: { $sum: '$pricing.total' }
            }
        },
        {
            $sort: { count: -1 }
        }
    ]);
};

// Static method to get orders requiring production
orderSchema.statics.getProductionOrders = function () {
    return this.find({
        'production.required': true,
        'production.status': { $in: ['not_started', 'in_progress'] }
    })
        .populate('userId', 'firstName lastName email')
        .populate('items.productId', 'name images specifications')
        .populate('items.customDesignId', 'name designData')
        .sort({ createdAt: 1 });
};

// Pre-save middleware to update status history
orderSchema.pre('save', function (next) {
    if (this.isModified('status') && !this.isNew) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            system: true
        });
    }
    next();
});

// Transform output
orderSchema.methods.toJSON = function () {
    const order = this.toObject();
    order.orderTotal = this.orderTotal;
    order.isShippable = this.isShippable;
    order.estimatedDeliveryDate = this.estimatedDeliveryDate;
    order.daysSinceOrder = this.daysSinceOrder;
    order.isOverdue = this.isOverdue;
    order.canBeCancelled = this.canBeCancelled;
    order.canBeReturned = this.canBeReturned;
    return order;
};

const Order = mongoose.model('Order', orderSchema);

export default Order;