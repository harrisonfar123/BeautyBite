// Product Catalog Data and Pricing Logic (served for frontend)
window.productCatalog = {
    // Product data for all three product types
    products: {
        'beautybite-branded': {
            id: 'beautybite-branded',
            name: 'BeautyBite Branded',
            tagline: 'Professional protection with our signature look',
            description: 'Medical-grade mouthguard featuring the BeautyBite brand identity. Perfect for athletes, coaches, and health-conscious individuals who want premium protection without compromise.',
            basePrice: 200,
            badge: 'Most Popular',
            badgeClass: 'badge-tier2',
            features: [
                'BeautyBite signature branding',
                'Medical-grade patented material',
                'Custom-molded comfort fit',
                'Professional packaging',
                'Available in all sport sizes'
            ],
            useCases: ['Boxing & MMA', 'Basketball', 'Football', 'Gym & CrossFit', 'General Sports'],
            type: 'branded',
            minQuantity: 1,
            maxQuantity: 10000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'One-time Order', description: 'Single order, no minimums', discount: 0 },
                subscription: { label: 'Monthly Supply', description: 'Auto-reorder every month, save 10%', discount: 0.10 }
            }
        },
        'clear-bulk': {
            id: 'clear-bulk',
            name: 'Clear Classic',
            tagline: 'Clean, professional, unbranded',
            description: 'Crystal-clear medical-grade mouthguard. Sleek, professional look that pairs with any uniform or aesthetic. Ideal for resellers and distributors.',
            basePrice: 100,
            badge: 'Best Value',
            badgeClass: 'badge-tier1',
            features: [
                'Crystal-clear unbranded design',
                'Medical-grade patented material',
                'Sterilizable and reusable',
                'Standard & youth sizing',
                'Ideal for resale'
            ],
            useCases: ['Wrestling', 'Hockey', 'Lacrosse', 'Youth Sports', 'Dental Protection'],
            type: 'bulk',
            minQuantity: 1,
            maxQuantity: 100000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'Standard Order', description: 'Single order', discount: 0 },
                subscription: { label: 'Monthly Supply', description: 'Auto-reorder, save 10%', discount: 0.10 }
            }
        },
        'custom-branded': {
            id: 'custom-branded',
            name: 'Custom Design',
            tagline: 'Your brand, your colors, your identity',
            description: 'Fully custom mouthguard built with our 3D design studio. Upload your logo, choose colors and materials, and create protection that is unmistakably yours.',
            basePrice: 300,
            badge: 'Premium',
            badgeClass: 'badge-tier3',
            features: [
                'Full custom logo & brand colors',
                'Interactive 3D design studio',
                'Matte, glossy, or metallic finish',
                'Custom text engraving',
                'Design saved to your account'
            ],
            useCases: ['Team Branding', 'Gym Identity', 'Merchandise', 'Sponsorship Gear', 'Limited Editions'],
            type: 'custom',
            minQuantity: 1,
            maxQuantity: 5000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'Custom Order', description: 'Single custom production run', discount: 0 }
            }
        }
    },

    // Get all products
    getAllProducts: function () {
        return Object.values(this.products);
    },

    // Get product by ID
    getProduct: function (productId) {
        return this.products[productId];
    },

    // Calculate price for a product based on quantity and purchasing option
    calculatePrice: function (productId, quantity, purchasingOption) {
        const product = this.getProduct(productId);
        if (!product) {
            throw new Error('Product not found');
        }

        // Validate quantity
        if (quantity < product.minQuantity || quantity > product.maxQuantity) {
            throw new Error(`Quantity must be between ${product.minQuantity} and ${product.maxQuantity}`);
        }

        let unitPrice = product.basePrice;

        // Apply bulk pricing for bulk product
        if (product.type === 'bulk' && product.bulkPricingTiers) {
            const tier = product.bulkPricingTiers.find(t =>
                quantity >= t.min && quantity <= t.max
            );
            if (tier) {
                unitPrice = tier.price;
            }
        }

        // Apply purchasing option discount
        const option = product.purchasingOptions[purchasingOption];
        if (option && option.discount > 0) {
            unitPrice = unitPrice * (1 - option.discount / 100);
        }

        const subtotal = unitPrice * quantity;
        const discountAmount = (product.basePrice * quantity) - subtotal;
        const discountPercent = option ? option.discount : 0;

        return {
            unitPrice: unitPrice,
            subtotal: subtotal,
            discount: discountPercent,
            discountAmount: discountAmount,
            quantity: quantity,
            purchasingOption: purchasingOption
        };
    },

    // Get bulk pricing information for display
    getBulkPricingInfo: function (productId) {
        const product = this.getProduct(productId);
        if (product.type !== 'bulk') {
            return null;
        }

        return product.bulkPricingTiers.map(tier => ({
            range: `${tier.min.toLocaleString()} - ${tier.max.toLocaleString()}`,
            price: `$${tier.price.toFixed(2)}`,
            unitPrice: tier.price
        }));
    }
};

// Cart Utility Functions
window.cartUtils = {
    // Format currency
    formatCurrency: function (amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    // Format quantity for display
    formatQuantity: function (quantity) {
        if (quantity >= 1000) {
            return quantity.toLocaleString();
        }
        return quantity.toString();
    },

    // Generate quantity options HTML for a product
    generateQuantityOptionsHTML: function (productId) {
        const product = window.productCatalog.getProduct(productId);
        if (!product) return '';

        let options = '';
        for (let qty = product.minQuantity; qty <= product.maxQuantity; qty += product.quantityStep) {
            options += `<option value="${qty}">${this.formatQuantity(qty)}</option>`;
        }
        return options;
    },

    // Generate purchasing options HTML for a product
    generatePurchasingOptionsHTML: function (productId) {
        const product = window.productCatalog.getProduct(productId);
        if (!product) return '';

        let optionsHTML = '';
        Object.entries(product.purchasingOptions).forEach(([key, option]) => {
            const isDefault = key === 'oneTime';
            optionsHTML += `
                <div class="purchasing-option">
                    <input type="radio" id="${productId}-${key}" name="purchasing-${productId}" value="${key}" ${isDefault ? 'checked' : ''}>
                    <label for="${productId}-${key}" class="option-label">
                        ${option.label}
                        <span class="option-description">${option.description}</span>
                    </label>
                </div>
            `;
        });
        return optionsHTML;
    },

    // Get product image URL
    getProductImage: function (productId) {
        const product = window.productCatalog.getProduct(productId);
        return product ? product.image : 'https://via.placeholder.com/60x60/CCCCCC/FFFFFF?text=Product';
    },

    // Validate quantity input
    validateQuantity: function (productId, quantity) {
        const product = window.productCatalog.getProduct(productId);
        if (!product) {
            return { valid: false, error: 'Product not found' };
        }

        if (quantity < product.minQuantity || quantity > product.maxQuantity) {
            return {
                valid: false,
                error: `Quantity must be between ${product.minQuantity} and ${product.maxQuantity}`
            };
        }

        if ((quantity - product.minQuantity) % product.quantityStep !== 0) {
            return {
                valid: false,
                error: `Quantity must be in increments of ${product.quantityStep}`
            };
        }

        return { valid: true };
    },

    // Calculate cart totals
    calculateCartTotals: function (items) {
        const subtotal = items.reduce((sum, item) => sum + item.priceInfo.subtotal, 0);
        const tax = subtotal * 0.08; // 8% tax for example
        const shipping = subtotal > 100 ? 0 : 9.99; // Free shipping over $100
        const total = subtotal + tax + shipping;

        return {
            subtotal: subtotal,
            tax: tax,
            shipping: shipping,
            total: total,
            itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
        };
    }
};