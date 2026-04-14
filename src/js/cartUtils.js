/**
 * Cart Utilities for BeautyBite
 * Provides helper functions for cart calculations, validation, and formatting
 */

window.cartUtils = {
    // Calculate cart totals
    calculateCartTotals: function (cartItems) {
        let subtotal = 0;
        let taxRate = 0.08; // 8% tax rate
        let shippingRate = 5.99; // Flat rate shipping

        // Calculate subtotal
        cartItems.forEach(item => {
            if (item.priceInfo && item.priceInfo.subtotal) {
                subtotal += item.priceInfo.subtotal;
            }
        });

        // Calculate tax and shipping
        const tax = subtotal * taxRate;
        const shipping = subtotal > 0 ? shippingRate : 0;
        const total = subtotal + tax + shipping;

        return {
            subtotal: subtotal,
            tax: tax,
            shipping: shipping,
            total: total,
            itemCount: cartItems.length,
            totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0)
        };
    },

    // Validate quantity for a product
    validateQuantity: function (productId, quantity) {
        const product = window.productCatalog ? window.productCatalog.getProduct(productId) : null;

        if (!product) {
            return {
                valid: false,
                error: 'Product not found'
            };
        }

        if (quantity < product.minQuantity) {
            return {
                valid: false,
                error: `Minimum quantity is ${product.minQuantity}`
            };
        }

        if (quantity > product.maxQuantity) {
            return {
                valid: false,
                error: `Maximum quantity is ${product.maxQuantity}`
            };
        }

        if (quantity % product.quantityStep !== 0) {
            return {
                valid: false,
                error: `Quantity must be in multiples of ${product.quantityStep}`
            };
        }

        return {
            valid: true,
            error: null
        };
    },

    // Format currency
    formatCurrency: function (amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    },

    // Format quantity with proper units
    formatQuantity: function (quantity) {
        return quantity.toString();
    },

    // Get product image URL
    getProductImage: function (productId) {
        const product = window.productCatalog ? window.productCatalog.getProduct(productId) : null;
        if (product && product.images && product.images.length > 0) {
            return product.images[0];
        }
        return '/images/placeholder-product.jpg'; // Fallback image
    },

    // Check if product is in stock
    isInStock: function (productId, quantity = 1) {
        const product = window.productCatalog ? window.productCatalog.getProduct(productId) : null;
        if (!product) return false;

        return product.stock >= quantity;
    },

    // Get stock status message
    getStockStatus: function (productId) {
        const product = window.productCatalog ? window.productCatalog.getProduct(productId) : null;
        if (!product) return 'Product not found';

        if (product.stock === 0) {
            return 'Out of stock';
        } else if (product.stock <= 10) {
            return `Only ${product.stock} left in stock`;
        } else {
            return 'In stock';
        }
    },

    // Calculate estimated delivery date
    getEstimatedDelivery: function () {
        const today = new Date();
        const deliveryDate = new Date(today);
        deliveryDate.setDate(today.getDate() + 5); // 5 business days

        return deliveryDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Validate cart before checkout
    validateCartForCheckout: function (cartItems) {
        const errors = [];

        if (cartItems.length === 0) {
            errors.push('Cart is empty');
            return {
                valid: false,
                errors: errors
            };
        }

        // Check stock availability
        cartItems.forEach((item, index) => {
            if (!this.isInStock(item.productId, item.quantity)) {
                errors.push(`${item.productName} is out of stock`);
            }
        });

        // Check quantity validity
        cartItems.forEach((item, index) => {
            const validation = this.validateQuantity(item.productId, item.quantity);
            if (!validation.valid) {
                errors.push(`${item.productName}: ${validation.error}`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    // Generate cart summary text
    getCartSummaryText: function (cartItems) {
        const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const total = this.calculateCartTotals(cartItems).total;

        return `${itemCount} item${itemCount !== 1 ? 's' : ''} • ${this.formatCurrency(total)}`;
    },

    // Get display name for product
    getDisplayName: function (productId, customization) {
        const product = window.productCatalog ? window.productCatalog.getProduct(productId) : null;
        if (!product) return 'Unknown Product';

        let displayName = product.name;
        if (customization && customization.color) {
            displayName = `${customization.color} ${displayName}`;
        }
        return displayName;
    },

    // Get customization summary
    getCustomizationSummary: function (customization) {
        if (!customization || Object.keys(customization).length === 0) {
            return null;
        }

        const parts = [];
        if (customization.color) parts.push(`Color: ${customization.color}`);
        if (customization.size) parts.push(`Size: ${customization.size}`);
        if (customization.branding) parts.push(`Branding: ${customization.branding}`);
        if (customization.hasLogo) parts.push('Logo: Yes');

        return parts.join(', ');
    },

    // Apply discount code (placeholder for future implementation)
    applyDiscount: function (cartItems, discountCode) {
        // This would integrate with a discount/offer system
        console.log('Discount code applied:', discountCode);
        return this.calculateCartTotals(cartItems);
    },

    // Get shipping options
    getShippingOptions: function () {
        return [
            {
                id: 'standard',
                name: 'Standard Shipping',
                cost: 5.99,
                estimatedDays: '5-7 business days'
            },
            {
                id: 'express',
                name: 'Express Shipping',
                cost: 12.99,
                estimatedDays: '2-3 business days'
            },
            {
                id: 'overnight',
                name: 'Overnight Shipping',
                cost: 24.99,
                estimatedDays: 'Next business day'
            }
        ];
    }
};

// Initialize product catalog if it doesn't exist
if (typeof window.productCatalog === 'undefined') {
    window.productCatalog = {
        getProduct: function (productId) {
            // Mock product data - in a real app, this would come from an API
            const mockProducts = {
                'product-001': {
                    id: 'product-001',
                    name: 'BeautyBite Dental Guard',
                    minQuantity: 1,
                    maxQuantity: 10,
                    quantityStep: 1,
                    stock: 50,
                    basePrice: 29.99,
                    images: ['/images/dental-guard.jpg']
                },
                'product-002': {
                    id: 'product-002',
                    name: 'Custom Dental Guard',
                    minQuantity: 1,
                    maxQuantity: 5,
                    quantityStep: 1,
                    stock: 25,
                    basePrice: 49.99,
                    images: ['/images/custom-guard.jpg']
                }
            };

            return mockProducts[productId] || null;
        },

        calculatePrice: function (productId, quantity, purchasingOption) {
            const product = this.getProduct(productId);
            if (!product) return null;

            let unitPrice = product.basePrice;

            // Apply pricing based on purchasing option
            if (purchasingOption === 'subscription') {
                unitPrice *= 0.8; // 20% discount for subscription
            } else if (purchasingOption === 'bulk') {
                if (quantity >= 3) unitPrice *= 0.9; // 10% discount for bulk
                if (quantity >= 5) unitPrice *= 0.85; // 15% discount for larger bulk
            }

            const subtotal = unitPrice * quantity;

            return {
                unitPrice: unitPrice,
                subtotal: subtotal,
                quantity: quantity,
                purchasingOption: purchasingOption
            };
        }
    };
}

console.log('Cart utilities loaded');