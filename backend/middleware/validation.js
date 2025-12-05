import Joi from 'joi';

// Validation schemas
const schemas = {
    register: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().min(6).required(),
        firstName: Joi.string().max(50).required().trim(),
        lastName: Joi.string().max(50).required().trim(),
        phone: Joi.string().trim().optional().allow('')
    }),

    login: Joi.object({
        email: Joi.string().email().required().trim().lowercase(),
        password: Joi.string().required()
    }),

    forgotPassword: Joi.object({
        email: Joi.string().email().required().trim().lowercase()
    }),

    resetPassword: Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required()
    }),

    updatePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required()
    }),

    verifyEmail: Joi.object({
        token: Joi.string().required()
    }),

    updateProfile: Joi.object({
        firstName: Joi.string().max(50).trim(),
        lastName: Joi.string().max(50).trim(),
        phone: Joi.string().trim().allow(''),
        preferences: Joi.object({
            newsletter: Joi.boolean(),
            notifications: Joi.boolean(),
            marketingEmails: Joi.boolean()
        })
    }),

    address: Joi.object({
        street: Joi.string().required().trim(),
        city: Joi.string().required().trim(),
        state: Joi.string().required().trim(),
        zipCode: Joi.string().required().trim(),
        country: Joi.string().default('United States').trim(),
        isDefault: Joi.boolean().default(false)
    }),

    product: Joi.object({
        name: Joi.string().max(100).required().trim(),
        description: Joi.string().max(2000).required(),
        shortDescription: Joi.string().max(250).trim(),
        type: Joi.string().valid('standard', 'bulk', 'custom').required(),
        category: Joi.string().valid('dental-guards', 'mouthguards', 'custom-fittings', 'accessories').required(),
        subcategory: Joi.string().trim(),
        sku: Joi.string().required().trim().uppercase(),
        images: Joi.array().items(
            Joi.object({
                url: Joi.string().required(),
                alt: Joi.string().allow(''),
                isPrimary: Joi.boolean().default(false),
                order: Joi.number().default(0)
            })
        ),
        model3d: Joi.object({
            url: Joi.string().uri(),
            format: Joi.string().valid('glb', 'gltf', 'obj').default('glb'),
            fileSize: Joi.number(),
            previewImage: Joi.string()
        }),
        pricing: Joi.object({
            basePrice: Joi.number().min(0).required(),
            salePrice: Joi.number().min(0),
            bulkPricing: Joi.array().items(
                Joi.object({
                    minQuantity: Joi.number().min(1).required(),
                    maxQuantity: Joi.number().min(1),
                    price: Joi.number().min(0).required()
                })
            ),
            currency: Joi.string().default('USD')
        }),
        specifications: Joi.object({
            material: Joi.string().required(),
            dimensions: Joi.object({
                length: Joi.number(),
                width: Joi.number(),
                height: Joi.number(),
                unit: Joi.string().default('mm')
            }),
            weight: Joi.object({
                value: Joi.number(),
                unit: Joi.string().default('g')
            }),
            colorOptions: Joi.array().items(Joi.string()),
            compatibility: Joi.array().items(Joi.string()),
            features: Joi.array().items(Joi.string()),
            careInstructions: Joi.string().allow(''),
            warranty: Joi.object({
                duration: Joi.number(),
                unit: Joi.string().valid('days', 'months', 'years').default('months'),
                details: Joi.string().allow('')
            })
        }),
        inventory: Joi.object({
            quantity: Joi.number().default(0),
            lowStockThreshold: Joi.number().default(10),
            trackQuantity: Joi.boolean().default(true),
            allowBackorder: Joi.boolean().default(false)
        }),
        isActive: Joi.boolean().default(true),
        isFeatured: Joi.boolean().default(false),
        tags: Joi.array().items(Joi.string())
    }),

    customDesign: Joi.object({
        productId: Joi.string().required(),
        name: Joi.string().max(100).required().trim(),
        description: Joi.string().max(500).allow(''),
        specifications: Joi.object({
            material: Joi.string().required(),
            thickness: Joi.object({
                value: Joi.number().required(),
                unit: Joi.string().default('mm')
            }),
            color: Joi.string().allow(''),
            finish: Joi.string().allow(''),
            dimensions: Joi.object({
                length: Joi.number(),
                width: Joi.number(),
                height: Joi.number(),
                unit: Joi.string().default('mm')
            }),
            customizations: Joi.object().unknown(true)
        }),
        notes: Joi.string().max(1000).allow(''),
        isPublic: Joi.boolean().default(false)
    }),

    order: Joi.object({
        items: Joi.array().items(
            Joi.object({
                productId: Joi.string().required(),
                customDesignId: Joi.string().allow(''),
                quantity: Joi.number().min(1).required(),
                customizationDetails: Joi.object().unknown(true)
            })
        ).min(1).required(),
        shippingAddress: Joi.object({
            firstName: Joi.string().required().trim(),
            lastName: Joi.string().required().trim(),
            street: Joi.string().required().trim(),
            city: Joi.string().required().trim(),
            state: Joi.string().required().trim(),
            zipCode: Joi.string().required().trim(),
            country: Joi.string().default('United States').trim(),
            phone: Joi.string().trim().allow(''),
            email: Joi.string().email().trim().lowercase()
        }).required(),
        billingAddress: Joi.object({
            firstName: Joi.string().required().trim(),
            lastName: Joi.string().required().trim(),
            street: Joi.string().required().trim(),
            city: Joi.string().required().trim(),
            state: Joi.string().required().trim(),
            zipCode: Joi.string().required().trim(),
            country: Joi.string().default('United States').trim()
        }).required(),
        shippingMethod: Joi.object({
            carrier: Joi.string().required(),
            service: Joi.string().required(),
            cost: Joi.number().min(0).required(),
            estimatedDays: Joi.number().min(1)
        }).required(),
        customerNotes: Joi.string().max(500).allow('')
    }),

    subscription: Joi.object({
        productId: Joi.string().required(),
        plan: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
        quantity: Joi.number().min(1).default(1),
        shippingAddress: Joi.object({
            firstName: Joi.string().required().trim(),
            lastName: Joi.string().required().trim(),
            street: Joi.string().required().trim(),
            city: Joi.string().required().trim(),
            state: Joi.string().required().trim(),
            zipCode: Joi.string().required().trim(),
            country: Joi.string().default('United States').trim()
        }).required(),
        deliveryPreferences: Joi.object({
            frequency: Joi.string().valid('monthly', 'quarterly', 'yearly', 'custom'),
            deliveryInstructions: Joi.string().max(500).allow('')
        })
    }),

    payment: Joi.object({
        paymentMethodId: Joi.string().required(),
        savePaymentMethod: Joi.boolean().default(false),
        orderId: Joi.string().required()
    })
};

// Validation middleware
const validateRequest = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];

        if (!schema) {
            return res.status(500).json({
                success: false,
                error: `Validation schema '${schemaName}' not found`
            });
        }

        const { error } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: false
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errorDetails
            });
        }

        next();
    };
};

// Optional validation (doesn't throw error, just sanitizes)
const sanitizeRequest = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];

        if (!schema) {
            return next();
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: true,
            stripUnknown: true
        });

        if (!error) {
            req.body = value;
        }

        next();
    };
};

// Query parameter validation
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.query, {
            abortEarly: false,
            allowUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                details: errorDetails
            });
        }

        next();
    };
};

// Params validation
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params, {
            abortEarly: false,
            allowUnknown: false
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Invalid URL parameters',
                details: errorDetails
            });
        }

        next();
    };
};

export {
    validateRequest,
    sanitizeRequest,
    validateQuery,
    validateParams,
    schemas
};