// Shopping Cart Functionality with localStorage
class ShoppingCart {
    constructor() {
        this.cartKey = 'beautybite_cart';
        this.cart = this.loadCart();
        this.init();
    }

    // Initialize cart functionality
    init() {
        this.updateCartCount();
        this.setupEventListeners();
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const cartData = localStorage.getItem(this.cartKey);
            return cartData ? JSON.parse(cartData) : {
                items: [],
                subtotal: 0,
                tax: 0,
                shipping: 0,
                total: 0,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error loading cart from localStorage:', error);
            return this.getEmptyCart();
        }
    }

    // Save cart to localStorage
    saveCart() {
        try {
            this.cart.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
        } catch (error) {
            console.error('Error saving cart to localStorage:', error);
        }
    }

    // Get empty cart structure
    getEmptyCart() {
        return {
            items: [],
            subtotal: 0,
            tax: 0,
            shipping: 0,
            total: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    // Add item to cart
    addItem(productId, quantity, purchasingOption = 'oneTime', customization = {}) {
        const product = window.productCatalog.getProduct(productId);
        if (!product) {
            throw new Error('Product not found');
        }

        // Validate quantity
        const validation = window.productCatalog.validateQuantity(productId, quantity);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        // Calculate price
        const priceInfo = window.productCatalog.calculatePrice(productId, quantity, purchasingOption);

        // Check if item already exists in cart
        const existingItemIndex = this.cart.items.findIndex(item =>
            item.productId === productId &&
            item.purchasingOption === purchasingOption &&
            JSON.stringify(item.customization) === JSON.stringify(customization)
        );

        if (existingItemIndex > -1) {
            // Update existing item quantity
            this.cart.items[existingItemIndex].quantity += quantity;
            this.cart.items[existingItemIndex].priceInfo = priceInfo;
        } else {
            // Add new item
            this.cart.items.push({
                productId,
                productName: product.name,
                quantity,
                purchasingOption,
                customization,
                priceInfo,
                addedAt: new Date().toISOString()
            });
        }

        this.updateCartTotals();
        this.saveCart();
        this.updateCartCount();
        this.dispatchCartUpdate();

        return true;
    }

    // Remove item from cart
    removeItem(index) {
        if (index >= 0 && index < this.cart.items.length) {
            this.cart.items.splice(index, 1);
            this.updateCartTotals();
            this.saveCart();
            this.updateCartCount();
            this.dispatchCartUpdate();
            return true;
        }
        return false;
    }

    // Update item quantity
    updateItemQuantity(index, newQuantity) {
        if (index >= 0 && index < this.cart.items.length) {
            const item = this.cart.items[index];
            const productId = item.productId;

            // Validate quantity
            const validation = window.productCatalog.validateQuantity(productId, newQuantity);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            item.quantity = newQuantity;
            item.priceInfo = window.productCatalog.calculatePrice(productId, newQuantity, item.purchasingOption);

            this.updateCartTotals();
            this.saveCart();
            this.updateCartCount();
            this.dispatchCartUpdate();

            return true;
        }
        return false;
    }

    // Update purchasing option for item
    updateItemPurchasingOption(index, purchasingOption) {
        if (index >= 0 && index < this.cart.items.length) {
            const item = this.cart.items[index];
            const productId = item.productId;

            item.purchasingOption = purchasingOption;
            item.priceInfo = window.productCatalog.calculatePrice(productId, item.quantity, purchasingOption);

            this.updateCartTotals();
            this.saveCart();
            this.dispatchCartUpdate();

            return true;
        }
        return false;
    }

    // Update cart totals
    updateCartTotals() {
        this.cart.subtotal = this.cart.items.reduce((total, item) => {
            return total + item.priceInfo.subtotal;
        }, 0);

        // Calculate tax (8.5% for example)
        this.cart.tax = this.cart.subtotal * 0.085;

        // Calculate shipping (free over $100, otherwise $9.99)
        this.cart.shipping = this.cart.subtotal >= 100 ? 0 : 9.99;

        this.cart.total = this.cart.subtotal + this.cart.tax + this.cart.shipping;
    }

    // Get cart item count
    getCartItemCount() {
        return this.cart.items.reduce((count, item) => count + item.quantity, 0);
    }

    // Update cart count in header
    updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count, [data-cart-count]');
        const count = this.getCartItemCount();

        cartCountElements.forEach(element => {
            element.textContent = count;
            element.style.display = count > 0 ? 'inline' : 'none';
        });
    }

    // Clear entire cart
    clearCart() {
        this.cart = this.getEmptyCart();
        this.saveCart();
        this.updateCartCount();
        this.dispatchCartUpdate();
    }

    // Get cart summary
    getCartSummary() {
        return {
            itemCount: this.getCartItemCount(),
            subtotal: this.cart.subtotal,
            tax: this.cart.tax,
            shipping: this.cart.shipping,
            total: this.cart.total,
            items: this.cart.items
        };
    }

    // Check if cart is empty
    isEmpty() {
        return this.cart.items.length === 0;
    }

    // Dispatch cart update event
    dispatchCartUpdate() {
        const event = new CustomEvent('cartUpdated', {
            detail: { cart: this.cart }
        });
        document.dispatchEvent(event);
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for add to cart events
        document.addEventListener('addToCart', (event) => {
            const { productId, quantity, purchasingOption, customization } = event.detail;
            this.addItem(productId, quantity, purchasingOption, customization);
        });

        // Listen for cart toggle events
        document.addEventListener('toggleCart', () => {
            this.toggleCartDrawer();
        });
    }

    // Toggle cart drawer visibility
    toggleCartDrawer() {
        const cartDrawer = document.getElementById('cart-drawer');
        if (cartDrawer) {
            cartDrawer.classList.toggle('active');
            document.body.classList.toggle('cart-open');
        }
    }

    // Close cart drawer
    closeCartDrawer() {
        const cartDrawer = document.getElementById('cart-drawer');
        if (cartDrawer) {
            cartDrawer.classList.remove('active');
            document.body.classList.remove('cart-open');
        }
    }

    // Open cart drawer
    openCartDrawer() {
        const cartDrawer = document.getElementById('cart-drawer');
        if (cartDrawer) {
            cartDrawer.classList.add('active');
            document.body.classList.add('cart-open');
        }
    }

    // Proceed to checkout
    proceedToCheckout() {
        if (this.isEmpty()) {
            alert('Your cart is empty. Please add items before checking out.');
            return;
        }

        // In a real implementation, this would redirect to a checkout page
        // For now, we'll show a success message
        alert('Proceeding to checkout! This would redirect to a payment processor in a real implementation.');

        // Clear cart after successful checkout
        // this.clearCart();
    }
}

// Initialize global shopping cart
window.shoppingCart = new ShoppingCart();

// Utility functions for cart operations
window.cartUtils = {
    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    // Format large numbers (for bulk quantities)
    formatQuantity(quantity) {
        if (quantity >= 1000) {
            return quantity.toLocaleString();
        }
        return quantity.toString();
    },

    // Get product image URL
    getProductImage(productId) {
        const product = window.productCatalog.getProduct(productId);
        return product ? `src/${product.image}` : 'src/icon.svg';
    },

    // Generate quantity options HTML
    generateQuantityOptionsHTML(productId, selectedQuantity = 1) {
        let options = [];
        let usedFallback = false;
        try {
            if (window.productCatalog && typeof window.productCatalog.generateQuantityOptions === 'function') {
                options = window.productCatalog.generateQuantityOptions(productId) || [];
            } else {
                usedFallback = true;
            }
        } catch (e) {
            usedFallback = true;
        }

        if (usedFallback || options.length === 0) {
            const product = (window.productCatalog && typeof window.productCatalog.getProduct === 'function')
                ? window.productCatalog.getProduct(productId)
                : null;
            const maxQuantity = (product && product.maxQuantity) || 10;
            const minQuantity = (product && product.minQuantity) || 1;
            const step = (product && product.quantityStep) || 1;

            options = [];
            for (let q = minQuantity; q <= maxQuantity; q += step) {
                options.push(q);
            }

            if (!window.__BB_QTY_WARNED__) {
                console.warn('productCatalog.generateQuantityOptions missing - using fallback');
                window.__BB_QTY_WARNED__ = true;
            }
        }

        return options.map(qty => `
            <option value="${qty}" ${qty === selectedQuantity ? 'selected' : ''}>
                ${this.formatQuantity(qty)}
            </option>
        `).join('');
    },

    // Generate purchasing options HTML
    generatePurchasingOptionsHTML(productId, selectedOption = 'oneTime') {
        const options = window.productCatalog.getPurchasingOptions(productId);
        return options.map(option => `
            <label class="purchasing-option">
                <input type="radio" name="purchasing-option" value="${option.key}" 
                       ${option.key === selectedOption ? 'checked' : ''}>
                <span class="option-label">${option.label}</span>
                ${option.description ? `<span class="option-description">${option.description}</span>` : ''}
            </label>
        `).join('');
    }
};