import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    stripeInvoiceId: {
        type: String,
        required: [true, 'Stripe invoice ID is required'],
        unique: true,
        sparse: true
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: [true, 'Invoice amount is required'],
        min: [0, 'Invoice amount cannot be negative']
    },
    amountDue: {
        type: Number,
        required: true,
        min: 0
    },
    amountPaid: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
    },
    status: {
        type: String,
        enum: {
            values: ['draft', 'open', 'paid', 'void', 'uncollectible', 'payment_failed'],
            message: '{VALUE} is not a valid invoice status'
        },
        required: true
    },
    invoicePdf: String,
    hostedInvoiceUrl: String,
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    dueDate: Date,
    paidAt: Date,
    items: [{
        description: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        type: {
            type: String,
            enum: ['subscription', 'one_time', 'tax', 'fee', 'credit'],
            default: 'subscription'
        }
    }],
    tax: {
        rate: Number,
        amount: Number,
        inclusive: { type: Boolean, default: false }
    },
    discounts: [{
        description: String,
        amount: Number,
        percentage: Number
    }],
    paymentAttempts: {
        count: { type: Number, default: 0 },
        lastAttempt: Date
    }
}, {
    _id: true
});

const subscriptionItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1'],
        default: 1
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    customDesignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomDesign',
        sparse: true
    },
    productSnapshot: {
        name: String,
        description: String,
        images: [String],
        specifications: mongoose.Schema.Types.Mixed,
        category: String,
        sku: String
    },
    taxRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    metadata: {
        customizable: { type: Boolean, default: false },
        requiresProduction: { type: Boolean, default: false },
        productionTime: Number // days
    }
}, {
    _id: true
});

const billingCycleSchema = new mongoose.Schema({
    anchor: {
        type: Date,
        required: [true, 'Billing cycle anchor is required']
    },
    prorationBehavior: {
        type: String,
        enum: ['create_prorations', 'none', 'always_invoice'],
        default: 'create_prorations'
    },
    billingDay: {
        type: Number,
        min: 1,
        max: 31
    },
    billingTime: {
        type: String,
        enum: ['start_of_day', 'end_of_day', 'specific_time'],
        default: 'end_of_day'
    },
    gracePeriod: {
        days: { type: Number, default: 3, min: 0 },
        appliesTo: {
            type: [String],
            enum: ['payment', 'cancellation', 'renewal'],
            default: ['payment']
        }
    }
}, {
    _id: false
});

const paymentMethodSchema = new mongoose.Schema({
    stripePaymentMethodId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['card', 'bank_account', 'paypal', 'apple_pay', 'google_pay'],
        required: true
    },
    last4: String,
    brand: String,
    expMonth: Number,
    expYear: Number,
    country: String,
    isDefault: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
}, {
    _id: false
});

const trialSettingsSchema = new mongoose.Schema({
    hasTrial: {
        type: Boolean,
        default: false
    },
    trialStart: Date,
    trialEnd: Date,
    trialUsed: {
        type: Boolean,
        default: false
    },
    trialPrice: {
        type: Number,
        min: 0
    },
    trialItems: [subscriptionItemSchema],
    convertAtEnd: {
        type: Boolean,
        default: true
    },
    reminderSent: {
        type: Boolean,
        default: false
    }
}, {
    _id: false
});

const deliveryScheduleSchema = new mongoose.Schema({
    frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'custom', 'on_demand'],
        required: true
    },
    interval: {
        type: Number,
        default: 1,
        min: 1
    },
    deliveryDay: {
        type: Number,
        min: 1,
        max: 31
    },
    deliveryWindow: {
        start: String, // e.g., "09:00"
        end: String    // e.g., "17:00"
    },
    skipNext: {
        type: Boolean,
        default: false
    },
    skipUntil: Date,
    deliveryInstructions: {
        type: String,
        maxlength: 500
    },
    preferredCarrier: {
        type: String,
        enum: ['ups', 'fedex', 'usps', 'dhl', 'any'],
        default: 'any'
    },
    shippingSpeed: {
        type: String,
        enum: ['standard', 'expedited', 'next_day', 'same_day'],
        default: 'standard'
    }
}, {
    _id: false
});

const usageTrackingSchema = new mongoose.Schema({
    totalOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    successfulOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    failedOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },
    averageOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    currentPeriodUsage: {
        orders: { type: Number, default: 0 },
        value: { type: Number, default: 0 },
        items: { type: Number, default: 0 }
    },
    usageLimits: {
        maxOrders: { type: Number, default: null }, // null means unlimited
        maxValue: { type: Number, default: null },
        resetPeriod: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly', 'never'],
            default: 'monthly'
        }
    },
    lastReset: Date,
    nextReset: Date
}, {
    _id: false
});

const upgradePathSchema = new mongoose.Schema({
    fromPlan: {
        type: String,
        required: true
    },
    toPlan: {
        type: String,
        required: true
    },
    proration: {
        type: String,
        enum: ['immediate', 'at_period_end'],
        default: 'immediate'
    },
    priceDifference: Number,
    effectiveDate: Date,
    requiresApproval: { type: Boolean, default: false },
    conditions: [{
        type: String,
        enum: ['payment_method_verified', 'good_standing', 'min_period_completed']
    }]
}, {
    _id: false
});

const subscriptionSchema = new mongoose.Schema({
    subscriptionId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    items: [subscriptionItemSchema],
    plan: {
        type: String,
        enum: {
            values: ['monthly', 'quarterly', 'yearly', 'custom'],
            message: '{VALUE} is not a valid subscription plan'
        },
        required: [true, 'Plan is required'],
        index: true
    },
    tier: {
        type: String,
        enum: ['basic', 'standard', 'premium', 'enterprise'],
        default: 'standard'
    },
    interval: {
        type: String,
        enum: ['month', 'quarter', 'year', 'custom'],
        required: [true, 'Interval is required']
    },
    intervalCount: {
        type: Number,
        default: 1,
        min: 1
    },
    pricing: {
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
        currency: {
            type: String,
            default: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        },
        discount: {
            amount: {
                type: Number,
                default: 0,
                min: 0
            },
            percentage: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            },
            reason: String,
            validUntil: Date
        },
        taxRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        setupFee: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    status: {
        type: String,
        enum: {
            values: [
                'active',
                'paused',
                'cancelled',
                'expired',
                'past_due',
                'unpaid',
                'incomplete',
                'trialing',
                'pending_activation',
                'suspended'
            ],
            message: '{VALUE} is not a valid subscription status'
        },
        default: 'active',
        index: true
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            maxlength: 500
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        system: { type: Boolean, default: false }
    }],
    currentPeriod: {
        start: {
            type: Date,
            required: [true, 'Current period start is required']
        },
        end: {
            type: Date,
            required: [true, 'Current period end is required']
        }
    },
    billingCycle: billingCycleSchema,
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false
    },
    canceledAt: Date,
    pauseCollection: {
        behavior: {
            type: String,
            enum: ['void', 'keep_as_draft', 'mark_uncollectible'],
            default: 'void'
        },
        resumesAt: Date,
        pauseReason: String,
        maxPauseDuration: { // days
            type: Number,
            default: 90
        }
    },
    paymentMethods: [paymentMethodSchema],
    defaultPaymentMethod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    invoices: [invoiceSchema],
    trialSettings: trialSettingsSchema,
    metadata: {
        cancellationReason: String,
        customerNotes: {
            type: String,
            maxlength: 1000
        },
        internalNotes: {
            type: String,
            maxlength: 2000
        },
        tags: [String],
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'admin', 'referral'],
            default: 'web'
        },
        campaign: String
    },
    shippingAddress: {
        firstName: String,
        lastName: String,
        company: String,
        street: String,
        apartment: String,
        city: String,
        state: String,
        zipCode: String,
        country: {
            type: String,
            default: 'United States'
        },
        phone: String,
        email: String
    },
    nextOrder: {
        estimatedDate: Date,
        items: [subscriptionItemSchema],
        total: Number,
        status: {
            type: String,
            enum: ['scheduled', 'processing', 'shipped', 'delivered', 'cancelled'],
            default: 'scheduled'
        },
        shippingMethod: String
    },
    deliveryPreferences: deliveryScheduleSchema,
    renewalSettings: {
        autoRenew: {
            type: Boolean,
            default: true
        },
        notifyBeforeRenewal: {
            type: Boolean,
            default: true
        },
        renewalReminderDays: {
            type: Number,
            default: 7,
            min: 1,
            max: 30
        },
        retryFailedPayments: {
            type: Boolean,
            default: true
        },
        maxRetryAttempts: {
            type: Number,
            default: 3,
            min: 0
        }
    },
    usage: usageTrackingSchema,
    upgradePaths: [upgradePathSchema],
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
        userAgent: String
    },
    notifications: {
        welcomeSent: { type: Boolean, default: false },
        trialEndingSent: { type: Boolean, default: false },
        paymentFailedSent: { type: Boolean, default: false },
        renewalReminderSent: { type: Boolean, default: false },
        upgradeAvailableSent: { type: Boolean, default: false }
    },
    performance: {
        retentionScore: { type: Number, default: 100, min: 0, max: 100 },
        churnRisk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        lastActivity: Date,
        engagementScore: { type: Number, default: 0, min: 0, max: 100 }
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.audit;
            delete ret.metadata.internalNotes;
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Compound indexes for better query performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, 'currentPeriod.end': 1 });
subscriptionSchema.index({ 'currentPeriod.end': 1 });
subscriptionSchema.index({ createdAt: -1 });
subscriptionSchema.index({ 'billingCycle.anchor': 1 });
subscriptionSchema.index({ tier: 1, status: 1 });
subscriptionSchema.index({ 'performance.churnRisk': 1, status: 1 });
subscriptionSchema.index({ 'deliveryPreferences.frequency': 1, status: 1 });
subscriptionSchema.index({ 'usage.currentPeriodUsage.orders': -1 });

// Virtual for days until renewal
subscriptionSchema.virtual('daysUntilRenewal').get(function () {
    const now = new Date();
    const end = new Date(this.currentPeriod.end);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
});

// Virtual for isActive
subscriptionSchema.virtual('isActive').get(function () {
    return this.status === 'active' && new Date() < new Date(this.currentPeriod.end);
});

// Virtual for isTrial
subscriptionSchema.virtual('isTrial').get(function () {
    if (!this.trialSettings.hasTrial) return false;
    const now = new Date();
    return now >= new Date(this.trialSettings.trialStart) && now <= new Date(this.trialSettings.trialEnd);
});

// Virtual for next billing date
subscriptionSchema.virtual('nextBillingDate').get(function () {
    return this.currentPeriod.end;
});

// Virtual for total value
subscriptionSchema.virtual('totalValue').get(function () {
    return this.usage.totalSpent;
});

// Virtual for months subscribed
subscriptionSchema.virtual('monthsSubscribed').get(function () {
    const start = new Date(this.createdAt);
    const now = new Date();
    const diffTime = now - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
});

// Virtual for canPause
subscriptionSchema.virtual('canPause').get(function () {
    return this.status === 'active' &&
        !this.cancelAtPeriodEnd &&
        this.monthsSubscribed >= 1; // At least 1 month subscribed
});

// Virtual for usagePercentage
subscriptionSchema.virtual('usagePercentage').get(function () {
    if (!this.usage.usageLimits.maxOrders) return 0;
    return (this.usage.currentPeriodUsage.orders / this.usage.usageLimits.maxOrders) * 100;
});

// Virtual for isNearLimit
subscriptionSchema.virtual('isNearLimit').get(function () {
    return this.usagePercentage >= 80;
});

// Virtual for canUpgrade
subscriptionSchema.virtual('canUpgrade').get(function () {
    return this.status === 'active' &&
        !this.cancelAtPeriodEnd &&
        this.upgradePaths.length > 0;
});

// Pre-save middleware to initialize status history
subscriptionSchema.pre('save', function (next) {
    if (this.isNew) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            system: true,
            reason: 'Subscription created'
        });
    }
    next();
});

// Pre-save middleware to update performance metrics
subscriptionSchema.pre('save', function (next) {
    // Update engagement score based on recent activity
    if (this.performance.lastActivity) {
        const daysSinceActivity = Math.floor((new Date() - this.performance.lastActivity) / (1000 * 60 * 60 * 24));
        this.performance.engagementScore = Math.max(0, 100 - (daysSinceActivity * 5));
    }

    // Update churn risk based on various factors
    let riskFactors = 0;
    if (this.usagePercentage >= 90) riskFactors++;
    if (this.daysUntilRenewal < 3) riskFactors++;
    if (this.performance.engagementScore < 50) riskFactors++;
    if (this.invoices.some(inv => inv.status === 'payment_failed')) riskFactors++;

    if (riskFactors >= 3) {
        this.performance.churnRisk = 'high';
    } else if (riskFactors >= 2) {
        this.performance.churnRisk = 'medium';
    } else {
        this.performance.churnRisk = 'low';
    }

    next();
});

// Method to update status with history
subscriptionSchema.methods.updateStatus = function (newStatus, reason = '', changedBy = null, system = false) {
    const oldStatus = this.status;
    this.status = newStatus;

    this.statusHistory.push({
        status: newStatus,
        reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
        changedBy,
        timestamp: new Date(),
        system
    });

    // Set canceledAt if cancelling
    if (newStatus === 'cancelled' && !this.canceledAt) {
        this.canceledAt = new Date();
    }

    return this.save();
};

// Method to pause subscription
subscriptionSchema.methods.pause = function (resumesAt, behavior = 'void', reason = 'User requested pause') {
    this.status = 'paused';
    this.pauseCollection = {
        behavior,
        resumesAt: new Date(resumesAt),
        pauseReason: reason
    };

    this.statusHistory.push({
        status: 'paused',
        reason,
        timestamp: new Date()
    });

    return this.save();
};

// Method to resume subscription
subscriptionSchema.methods.resume = function () {
    this.status = 'active';
    this.pauseCollection = undefined;

    this.statusHistory.push({
        status: 'active',
        reason: 'Subscription resumed',
        timestamp: new Date()
    });

    return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = function (atPeriodEnd = false, reason = '') {
    this.cancelAtPeriodEnd = atPeriodEnd;

    if (!atPeriodEnd) {
        this.status = 'cancelled';
        this.canceledAt = new Date();
    }

    this.statusHistory.push({
        status: atPeriodEnd ? 'active' : 'cancelled',
        reason: reason || `Cancelled ${atPeriodEnd ? 'at period end' : 'immediately'}`,
        timestamp: new Date()
    });

    return this.save();
};

// Method to add invoice
subscriptionSchema.methods.addInvoice = function (invoiceData) {
    // Generate invoice number if not provided
    if (!invoiceData.invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const sequence = this.invoices.length + 1;
        invoiceData.invoiceNumber = `INV-${year}-${String(sequence).padStart(6, '0')}`;
    }

    this.invoices.push(invoiceData);
    return this.save();
};

// Method to update usage statistics
subscriptionSchema.methods.updateUsage = function (orderAmount, isSuccessful = true, itemsCount = 1) {
    this.usage.totalOrders += 1;
    this.usage.currentPeriodUsage.orders += 1;
    this.usage.currentPeriodUsage.items += itemsCount;

    if (isSuccessful) {
        this.usage.successfulOrders += 1;
        this.usage.totalSpent += orderAmount;
        this.usage.currentPeriodUsage.value += orderAmount;
        this.usage.averageOrderValue = this.usage.totalSpent / this.usage.successfulOrders;
    } else {
        this.usage.failedOrders += 1;
    }

    this.performance.lastActivity = new Date();
    return this.save();
};

// Method to reset usage for new period
subscriptionSchema.methods.resetUsage = function () {
    this.usage.lastReset = new Date();

    // Calculate next reset date based on reset period
    const nextReset = new Date(this.usage.lastReset);
    switch (this.usage.usageLimits.resetPeriod) {
        case 'monthly':
            nextReset.setMonth(nextReset.getMonth() + 1);
            break;
        case 'quarterly':
            nextReset.setMonth(nextReset.getMonth() + 3);
            break;
        case 'yearly':
            nextReset.setFullYear(nextReset.getFullYear() + 1);
            break;
        case 'never':
            nextReset.setFullYear(nextReset.getFullYear() + 100); // Far future
            break;
    }

    this.usage.nextReset = nextReset;
    this.usage.currentPeriodUsage = { orders: 0, value: 0, items: 0 };

    return this.save();
};

// Method to calculate next order date
subscriptionSchema.methods.calculateNextOrder = function () {
    const nextDate = new Date(this.currentPeriod.end);

    // Set next order date based on interval
    switch (this.interval) {
        case 'month':
            nextDate.setMonth(nextDate.getMonth() + this.intervalCount);
            break;
        case 'quarter':
            nextDate.setMonth(nextDate.getMonth() + (3 * this.intervalCount));
            break;
        case 'year':
            nextDate.setFullYear(nextDate.getFullYear() + this.intervalCount);
            break;
        case 'custom':
            // For custom intervals, use the delivery preferences
            if (this.deliveryPreferences.interval) {
                nextDate.setDate(nextDate.getDate() + this.deliveryPreferences.interval);
            }
            break;
    }

    this.nextOrder = {
        estimatedDate: nextDate,
        items: this.items,
        total: this.pricing.totalPrice,
        status: 'scheduled'
    };

    return this.save();
};

// Method to upgrade subscription
subscriptionSchema.methods.upgrade = function (newPlan, newPricing, proration = 'immediate') {
    const upgradePath = this.upgradePaths.find(up => up.toPlan === newPlan);
    if (!upgradePath) {
        throw new Error(`Upgrade path to ${newPlan} not found`);
    }

    // Update plan and pricing
    this.plan = newPlan;
    this.pricing = { ...this.pricing, ...newPricing };

    // Handle proration
    if (proration === 'immediate') {
        // Calculate prorated amount and create invoice
        const daysUsed = Math.floor((new Date() - this.currentPeriod.start) / (1000 * 60 * 60 * 24));
        const totalDays = Math.floor((this.currentPeriod.end - this.currentPeriod.start) / (1000 * 60 * 60 * 24));
        const proratedAmount = (newPricing.totalPrice - this.pricing.totalPrice) * (daysUsed / totalDays);

        if (proratedAmount > 0) {
            this.addInvoice({
                stripeInvoiceId: `proration_${Date.now()}`,
                invoiceNumber: `PRORATION-${Date.now()}`,
                amount: proratedAmount,
                amountDue: proratedAmount,
                status: 'open',
                periodStart: this.currentPeriod.start,
                periodEnd: new Date(),
                items: [{
                    description: `Proration for upgrade to ${newPlan}`,
                    amount: proratedAmount,
                    quantity: 1,
                    type: 'one_time'
                }]
            });
        }
    }

    this.statusHistory.push({
        status: 'active',
        reason: `Upgraded from ${this.plan} to ${newPlan}`,
        timestamp: new Date()
    });

    return this.save();
};

// Method to downgrade subscription
subscriptionSchema.methods.downgrade = function (newPlan, newPricing, effectiveDate = 'next_period') {
    if (effectiveDate === 'next_period') {
        this.cancelAtPeriodEnd = true;
        this.metadata.cancellationReason = `Downgrade to ${newPlan} scheduled for end of period`;
    } else {
        this.plan = newPlan;
        this.pricing = { ...this.pricing, ...newPricing };
    }

    this.statusHistory.push({
        status: this.status,
        reason: `Downgraded to ${newPlan} effective ${effectiveDate}`,
        timestamp: new Date()
    });

    return this.save();
};

// Method to skip next delivery
subscriptionSchema.methods.skipNextDelivery = function (skipUntil = null) {
    this.deliveryPreferences.skipNext = true;
    if (skipUntil) {
        this.deliveryPreferences.skipUntil = new Date(skipUntil);
    }

    // Reschedule next order
    if (this.nextOrder) {
        this.nextOrder.status = 'cancelled';
    }

    this.calculateNextOrder();
    return this.save();
};

// Method to add payment method
subscriptionSchema.methods.addPaymentMethod = function (paymentMethodData) {
    this.paymentMethods.push(paymentMethodData);

    // If this is the first payment method or marked as default, set as default
    if (this.paymentMethods.length === 1 || paymentMethodData.isDefault) {
        this.paymentMethods.forEach(pm => { pm.isDefault = false; });
        paymentMethodData.isDefault = true;
    }

    return this.save();
};

// Method to set default payment method
subscriptionSchema.methods.setDefaultPaymentMethod = function (paymentMethodId) {
    this.paymentMethods.forEach(pm => {
        pm.isDefault = pm._id.toString() === paymentMethodId.toString();
    });
    return this.save();
};

// Static method to get subscriptions by user
subscriptionSchema.statics.getByUser = function (userId, options = {}) {
    const { status, limit = 20, skip = 0 } = options;
    const query = { userId };
    if (status) query.status = status;

    return this.find(query)
        .populate('items.productId', 'name images pricing inventory')
        .populate('items.customDesignId', 'name designData.previewImages')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

// Static method to get active subscriptions
subscriptionSchema.statics.getActiveSubscriptions = function () {
    return this.find({
        status: 'active',
        'currentPeriod.end': { $gt: new Date() }
    })
        .populate('userId', 'firstName lastName email')
        .populate('items.productId', 'name images inventory')
        .sort({ 'currentPeriod.end': 1 });
};

// Static method to get subscriptions due for renewal
subscriptionSchema.statics.getDueForRenewal = function (days = 7) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.find({
        status: 'active',
        'currentPeriod.end': {
            $lte: targetDate,
            $gt: new Date()
        },
        cancelAtPeriodEnd: false
    })
        .populate('userId', 'firstName lastName email preferences')
        .populate('items.productId', 'name images pricing inventory');
};

// Static method to get subscriptions with high churn risk
subscriptionSchema.statics.getHighRiskSubscriptions = function () {
    return this.find({
        'performance.churnRisk': 'high',
        status: 'active'
    })
        .populate('userId', 'firstName lastName email phone')
        .sort({ 'performance.engagementScore': 1 });
};

// Static method to get subscriptions nearing usage limits
subscriptionSchema.statics.getNearLimitSubscriptions = function (threshold = 80) {
    return this.find({
        status: 'active',
        $expr: {
            $and: [
                { $gt: ['$usage.usageLimits.maxOrders', 0] },
                {
                    $gte: [
                        {
                            $multiply: [
                                { $divide: ['$usage.currentPeriodUsage.orders', '$usage.usageLimits.maxOrders'] },
                                100
                            ]
                        },
                        threshold
                    ]
                }
            ]
        }
    })
        .populate('userId', 'firstName lastName email')
        .populate('items.productId', 'name images');
};

// Static method to get subscription statistics
subscriptionSchema.statics.getStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$pricing.totalPrice' },
                averageValue: { $avg: '$pricing.totalPrice' },
                totalUsers: { $addToSet: '$userId' }
            }
        },
        {
            $group: {
                _id: null,
                totalSubscriptions: { $sum: '$count' },
                activeSubscriptions: {
                    $sum: {
                        $cond: [{ $eq: ['$_id', 'active'] }, '$count', 0]
                    }
                },
                totalMRR: {
                    $sum: {
                        $cond: [
                            { $eq: ['$_id', 'active'] },
                            '$totalRevenue',
                            0
                        ]
                    }
                },
                uniqueCustomers: { $sum: { $size: { $setUnion: '$totalUsers' } } },
                statusBreakdown: {
                    $push: {
                        status: '$_id',
                        count: '$count',
                        revenue: '$totalRevenue',
                        averageValue: '$averageValue'
                    }
                }
            }
        }
    ]);
};

// Static method to get revenue forecast
subscriptionSchema.statics.getRevenueForecast = function (months = 12) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + months);

    return this.aggregate([
        {
            $match: {
                status: 'active',
                'currentPeriod.end': { $gt: now }
            }
        },
        {
            $group: {
                _id: null,
                currentMRR: { $sum: '$pricing.totalPrice' },
                estimatedAnnualRevenue: { $sum: { $multiply: ['$pricing.totalPrice', 12] } },
                averageCustomerLifetime: { $avg: '$monthsSubscribed' }
            }
        }
    ]);
};

// Pre-save middleware to update status history
subscriptionSchema.pre('save', function (next) {
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
subscriptionSchema.methods.toJSON = function () {
    const subscription = this.toObject();

    // Add virtuals
    subscription.daysUntilRenewal = this.daysUntilRenewal;
    subscription.isActive = this.isActive;
    subscription.isTrial = this.isTrial;
    subscription.nextBillingDate = this.nextBillingDate;
    subscription.totalValue = this.totalValue;
    subscription.monthsSubscribed = this.monthsSubscribed;
    subscription.canPause = this.canPause;
    subscription.usagePercentage = this.usagePercentage;
    subscription.isNearLimit = this.isNearLimit;
    subscription.canUpgrade = this.canUpgrade;

    return subscription;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;