// Product Catalog Data and Pricing Logic (served for frontend)
window.productCatalog = {
    products: {
        'clear-bulk': {
            id: 'clear-bulk',
            slug: 'clear',
            name: 'BeautyBite Clear',
            tagline: 'Essential isolation guard for electrical facial therapy',
            shortDescription: 'Crystal-clear medical-grade EVA — the discreet workhorse of every facial treatment room.',
            description: 'Our standard-grade isolating guard, made from medical-grade EVA. Provides reliable electrical isolation for patients with metal dental work during microcurrent, TENS, and PEMF facial treatments. Clear, comfortable, universal fit.',
            basePrice: 100,
            badge: 'Essential',
            badgeClass: 'badge-tier1',
            features: [
                'Medical-grade EVA — electrically insulating',
                'Universal adult fit, no molding required',
                'Sterilizable in autoclave — fully reusable',
                'Safe with implants, fillings, crowns & braces',
                'Discreet, near-invisible during treatment'
            ],
            useCases: ['Microcurrent Facials', 'TENS Therapy', 'PEMF Treatment', 'Dental Implant Patients', 'Esthetic Clinics'],
            type: 'standard',
            minQuantity: 1,
            maxQuantity: 100000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'One-time order', description: 'Single purchase', discount: 0 },
                subscription: { label: 'Monthly Supply', description: 'Auto-reorder, save 10%', discount: 0.10 }
            }
        },
        'beautybite-branded': {
            id: 'beautybite-branded',
            slug: 'branded',
            name: 'BeautyBite Signature',
            tagline: 'Premium silicone guard with our signature branding',
            shortDescription: 'A polished, on-brand experience for clinics that take patient comfort seriously.',
            description: 'Premium medical-grade silicone isolating guard featuring the BeautyBite brand. Designed for med spas and clinics who want to offer a polished, professional patient experience. Superior electrical isolation with enhanced comfort.',
            basePrice: 200,
            badge: 'Most Popular',
            badgeClass: 'badge-tier2',
            features: [
                'Premium medical-grade silicone',
                'Superior electrical isolation rating',
                'BeautyBite signature engraving',
                'Enhanced comfort — thinner rear wall',
                'Compatible with all major therapy devices'
            ],
            useCases: ['Med Spa Treatments', 'Microcurrent Facials', 'PEMF Therapy', 'Interferential Therapy', 'Wellness Clinics'],
            type: 'branded',
            minQuantity: 1,
            maxQuantity: 10000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'One-time order', description: 'Single purchase', discount: 0 },
                subscription: { label: 'Monthly Supply', description: 'Auto-reorder, save 10%', discount: 0.10 }
            }
        },
        'custom-branded': {
            id: 'custom-branded',
            slug: 'custom',
            name: 'BeautyBite Custom',
            tagline: 'Your brand on a patented therapy device',
            shortDescription: 'Build your own — pick a design, drop in your logo, and we manufacture it.',
            description: 'Fully custom-branded isolating guard built with our 3D design studio. Choose from our curated design library or upload your own logo and brand colors. Premium silicone, your identity.',
            basePrice: 300,
            badge: 'Premium',
            badgeClass: 'badge-tier3',
            features: [
                'Choose from curated designs or build your own',
                'Logo, brand colors & engraving',
                'Premium medical-grade silicone',
                'Interactive 3D design studio',
                'Design saved to your account'
            ],
            useCases: ['Clinic Branding', 'Med Spa Identity', 'Patient Gifting', 'Treatment Packages', 'Referral Programs'],
            type: 'custom',
            minQuantity: 1,
            maxQuantity: 5000,
            quantityStep: 1,
            purchasingOptions: {
                oneTime: { label: 'Custom Order', description: 'Single custom production run', discount: 0 }
            }
        }
    },

    getAllProducts: function () { return Object.values(this.products); },
    getProduct: function (id) { return this.products[id]; },
    getProductBySlug: function (slug) {
        return Object.values(this.products).find(p => p.slug === slug);
    },

    calculatePrice: function (productId, quantity, purchasingOption) {
        const product = this.getProduct(productId);
        if (!product) throw new Error('Product not found');
        if (quantity < product.minQuantity || quantity > product.maxQuantity) {
            throw new Error(`Quantity must be between ${product.minQuantity} and ${product.maxQuantity}`);
        }
        let unitPrice = product.basePrice;
        const option = product.purchasingOptions[purchasingOption];
        if (option && option.discount > 0) unitPrice = unitPrice * (1 - option.discount);
        const subtotal = unitPrice * quantity;
        return {
            unitPrice,
            subtotal,
            discount: option ? option.discount : 0,
            discountAmount: (product.basePrice * quantity) - subtotal,
            quantity,
            purchasingOption
        };
    },

    validateQuantity: function (productId, quantity) {
        const product = this.getProduct(productId);
        if (!product) return { valid: false, message: 'Product not found' };
        if (quantity < product.minQuantity) return { valid: false, message: `Minimum order is ${product.minQuantity}` };
        if (quantity > product.maxQuantity) return { valid: false, message: `Maximum order is ${product.maxQuantity}` };
        return { valid: true };
    },

    generateQuantityOptions: function (productId) {
        const product = this.getProduct(productId);
        if (!product) return [];
        const opts = [];
        const ladders = {
            'clear-bulk':         [1, 5, 10, 25, 50, 100, 500, 1000],
            'beautybite-branded': [1, 2, 5, 10, 25, 50, 100],
            'custom-branded':     [1, 2, 5, 10, 25, 50, 100]
        };
        return ladders[productId] || [1, 2, 5, 10, 25];
    },

    getPurchasingOptions: function (productId) {
        const product = this.getProduct(productId);
        if (!product) return [];
        return Object.entries(product.purchasingOptions).map(([key, opt]) => ({ key, ...opt }));
    }
};
