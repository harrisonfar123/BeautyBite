import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema({
    street: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    zipCode: {
        type: String,
        required: true,
        trim: true,
        match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    },
    country: {
        type: String,
        default: 'United States',
        trim: true,
        maxlength: 100
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    addressType: {
        type: String,
        enum: ['home', 'work', 'billing', 'shipping'],
        default: 'home'
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
    }
}, {
    _id: true
});

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (email) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
            },
            message: 'Please enter a valid email address'
        },
        index: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        validate: {
            validator: function (password) {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters'],
        match: [/^[a-zA-Z\s\-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters'],
        match: [/^[a-zA-Z\s\-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes']
    },
    phone: {
        type: String,
        trim: true,
        sparse: true,
        validate: {
            validator: function (phone) {
                if (!phone) return true; // Optional field
                return /^\+?[\d\s\-\(\)]{10,}$/.test(phone);
            },
            message: 'Please enter a valid phone number'
        }
    },
    addresses: [addressSchema],
    role: {
        type: String,
        enum: {
            values: ['customer', 'admin', 'moderator', 'support'],
            message: '{VALUE} is not a valid role'
        },
        default: 'customer'
    },
    permissions: {
        type: [String],
        enum: [
            'read:users', 'write:users', 'delete:users',
            'read:products', 'write:products', 'delete:products',
            'read:orders', 'write:orders', 'delete:orders',
            'read:designs', 'write:designs', 'delete:designs',
            'read:subscriptions', 'write:subscriptions', 'delete:subscriptions',
            'read:analytics', 'write:analytics'
        ],
        default: []
    },
    stripeCustomerId: {
        type: String,
        sparse: true,
        index: true
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        notifications: {
            type: Boolean,
            default: true
        },
        marketingEmails: {
            type: Boolean,
            default: true
        },
        language: {
            type: String,
            enum: ['en', 'es', 'fr', 'de'],
            default: 'en'
        },
        currency: {
            type: String,
            enum: ['USD', 'EUR', 'GBP', 'CAD'],
            default: 'USD'
        },
        timezone: {
            type: String,
            default: 'America/New_York'
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    verificationLevel: {
        type: String,
        enum: ['unverified', 'email_verified', 'phone_verified', 'identity_verified'],
        default: 'unverified'
    },
    lastLogin: {
        type: Date,
        index: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    loginAttempts: {
        type: Number,
        default: 0,
        max: 5
    },
    lockUntil: Date,
    emailVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: {
        type: String,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        select: false
    },
    emailVerificationToken: {
        type: String,
        select: false
    },
    emailVerificationExpires: {
        type: Date,
        select: false
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
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
        ipAddress: String,
        userAgent: String
    },
    metadata: {
        signupSource: {
            type: String,
            enum: ['web', 'mobile', 'api', 'admin'],
            default: 'web'
        },
        referralCode: String,
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        campaign: String,
        utmSource: String,
        utmMedium: String,
        utmCampaign: String
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
            delete ret.emailVerificationToken;
            delete ret.emailVerificationExpires;
            delete ret.twoFactorSecret;
            return ret;
        }
    },
    toObject: {
        virtuals: true
    }
});

// Compound indexes for better query performance
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'metadata.signupSource': 1, createdAt: -1 });
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });
userSchema.index({ verificationLevel: 1, isActive: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for account age in days
userSchema.virtual('accountAge').get(function () {
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Virtual for isLocked (account lock status)
userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for requiresVerification
userSchema.virtual('requiresVerification').get(function () {
    return !this.emailVerified || this.verificationLevel === 'unverified';
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update timestamps and audit fields on save
userSchema.pre('save', function (next) {
    if (this.isModified() && !this.isNew) {
        this.audit.updatedAt = new Date();
    }
    next();
});

// Enhanced compare password method with account lock
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (this.isLocked) {
        throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    const isMatch = await bcrypt.compare(candidatePassword, this.password);

    if (isMatch) {
        // Reset login attempts on successful login
        if (this.loginAttempts > 0) {
            this.loginAttempts = 0;
            this.lockUntil = undefined;
            await this.save();
        }
        return true;
    } else {
        // Increment login attempts
        this.loginAttempts += 1;

        // Lock account if too many failed attempts
        if (this.loginAttempts >= 5) {
            this.lockUntil = Date.now() + (2 * 60 * 60 * 1000); // Lock for 2 hours
        }

        await this.save();
        return false;
    }
};

// Update last login and activity
userSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    this.lastActivity = new Date();
    return this.save();
};

// Update last activity
userSchema.methods.updateActivity = function () {
    this.lastActivity = new Date();
    return this.save();
};

// Get default address method
userSchema.methods.getDefaultAddress = function () {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
};

// Add new address
userSchema.methods.addAddress = function (addressData) {
    // If this is the first address or marked as default, set as default
    if (this.addresses.length === 0 || addressData.isDefault) {
        // Remove default from existing addresses
        this.addresses.forEach(addr => { addr.isDefault = false; });
        addressData.isDefault = true;
    }

    this.addresses.push(addressData);
    return this.save();
};

// Set default address
userSchema.methods.setDefaultAddress = function (addressId) {
    this.addresses.forEach(addr => {
        addr.isDefault = addr._id.toString() === addressId.toString();
    });
    return this.save();
};

// Remove address
userSchema.methods.removeAddress = function (addressId) {
    const addressIndex = this.addresses.findIndex(addr =>
        addr._id.toString() === addressId.toString()
    );

    if (addressIndex === -1) {
        throw new Error('Address not found');
    }

    const wasDefault = this.addresses[addressIndex].isDefault;
    this.addresses.splice(addressIndex, 1);

    // If we removed the default address and there are other addresses, set a new default
    if (wasDefault && this.addresses.length > 0) {
        this.addresses[0].isDefault = true;
    }

    return this.save();
};

// Check permission
userSchema.methods.hasPermission = function (permission) {
    if (this.role === 'admin') return true;
    return this.permissions.includes(permission);
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = function () {
    this.loginAttempts += 1;

    if (this.loginAttempts >= 5 && !this.lockUntil) {
        this.lockUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
    }

    return this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    return this.save();
};

// Verify email
userSchema.methods.verifyEmail = function () {
    this.emailVerified = true;
    this.verificationLevel = this.phoneVerified ? 'identity_verified' : 'email_verified';
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
    return this.save();
};

// Verify phone
userSchema.methods.verifyPhone = function () {
    this.phoneVerified = true;
    this.verificationLevel = this.emailVerified ? 'identity_verified' : 'phone_verified';
    return this.save();
};

// Enable two-factor authentication
userSchema.methods.enableTwoFactor = function (secret) {
    this.twoFactorEnabled = true;
    this.twoFactorSecret = secret;
    return this.save();
};

// Disable two-factor authentication
userSchema.methods.disableTwoFactor = function () {
    this.twoFactorEnabled = false;
    this.twoFactorSecret = undefined;
    return this.save();
};

// Static method to find by email (case insensitive)
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

// Static method to find active users
userSchema.statics.findActiveUsers = function () {
    return this.find({ isActive: true, isLocked: false });
};

// Static method to get user statistics
userSchema.statics.getUserStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                    $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                },
                verifiedUsers: {
                    $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] }
                },
                adminUsers: {
                    $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
                },
                averageAccountAge: {
                    $avg: {
                        $divide: [
                            { $subtract: [new Date(), '$createdAt'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            }
        }
    ]);
};

const User = mongoose.model('User', userSchema);

export default User;