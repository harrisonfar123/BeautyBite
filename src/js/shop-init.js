// Shop page initializer.
// Product grid rendering + 3D viewers delegated to the universal BB3D library
// (js/bb3d.js). BB3D handles WebGL probing, GLB loading, shared-context
// rendering, and the Canvas-2D fallback — so every product card works on
// every browser without special flags.

(function () {

    // ── Product tiers & their BB3D viewer configs ────────────────────────
    const TIER_VIEWS = {
        'clear-bulk':         { color: '#6E7E88', bg: '#0A1929', finish: 'clear',    rotSpeed: 0.0035, label: null,           labelColor: '#5C8EA6' },
        'beautybite-branded': { color: '#5C8EA6', bg: '#13243A', finish: 'silicone', rotSpeed: 0.0030, label: 'Beauty Bite', labelColor: '#FFFFFF', labelColorway: null },
        'custom-branded':     { color: '#5C8EA6', bg: '#080F1E', finish: 'glossy',   rotSpeed: 0.0050, label: null,           labelColor: '#5C8EA6' }
    };

    function tierStyle (tierId) {
        const m = {
            'clear-bulk':         'background:linear-gradient(135deg,#e0f7fa,#f0f9ff);',
            'beautybite-branded': 'background:linear-gradient(135deg,#1B2D3E,#3A5570);',
            'custom-branded':     'background:linear-gradient(135deg,#0f1a2e,#1e3a5f);'
        };
        return m[tierId] || 'background:#f0f4f8;';
    }

    function escapeHtml (s) {
        return (s || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function createProductCardHTML (product) {
        const productId = product.id;
        const canvasStyle = tierStyle(productId);
        const price = window.cartUtils
            ? window.cartUtils.formatCurrency(product.basePrice)
            : ('$' + product.basePrice);

        return `
            <article class="product-card" id="product-${productId}" style="position:relative;cursor:pointer;" onclick="openProductModal('${productId}')">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                <div class="product-3d-viewer" style="width:100%;height:200px;border-radius:8px;overflow:hidden;margin-bottom:1.5rem;position:relative;${canvasStyle}">
                    <canvas id="canvas3d-${productId}" style="display:block;width:100%;height:100%;"></canvas>
                    <div id="loading3d-${productId}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                        <div style="text-align:center;color:rgba(255,255,255,0.7);">
                            <div style="width:28px;height:28px;border:2px solid rgba(255,255,255,0.3);border-top-color:#8BB8CC;border-radius:50%;animation:spin3d 0.8s linear infinite;margin:0 auto 6px;"></div>
                            <span style="font-size:0.75rem;">Loading 3D…</span>
                        </div>
                    </div>
                </div>
                <h3 class="product-title">${escapeHtml(product.name)}</h3>
                ${product.tagline ? `<p style="color:#5C8EA6;font-size:0.9rem;font-weight:500;margin:0 0 0.75rem;">${escapeHtml(product.tagline)}</p>` : ''}
                <div class="pricing-section">
                    <div class="base-price">${price} <span style="font-size:0.85rem;font-weight:400;color:#64748b;">/ unit</span></div>
                </div>
                <p style="font-size:0.82rem;color:#94a3b8;margin-top:1rem;text-align:center;">Click to view details &amp; order</p>
            </article>
        `;
    }

    // ── Render the grid ──────────────────────────────────────────────────
    function renderProducts () {
        const grid = document.getElementById('products-grid');
        if (!grid) return;

        let products = [];
        try {
            products = (window.productCatalog && window.productCatalog.getAllProducts)
                ? window.productCatalog.getAllProducts()
                : [];
        } catch (e) {
            console.warn('productCatalog not available', e);
        }

        if (!products.length) {
            grid.innerHTML = `<div class="container"><p style="text-align:center;color:var(--medium-gray);padding:2rem;">No products available.</p></div>`;
            return;
        }

        grid.innerHTML = products.map(createProductCardHTML).join('');

        // Spin up viewers after the DOM settles (and after three.js/BB3D load).
        setTimeout(() => initViewers(products), 60);

        // Re-price on qty/option change — unchanged from the original.
        products.forEach(p => {
            const qtyEl = document.getElementById(`quantity-${p.id}`);
            const optionInputs = document.querySelectorAll(`#purchasing-options-${p.id} input[type="radio"]`);
            function updatePriceDisplay () {
                let qty = parseInt(qtyEl ? qtyEl.value : p.minQuantity) || p.minQuantity;
                let option = 'oneTime';
                if (optionInputs && optionInputs.length) {
                    const checked = Array.from(optionInputs).find(i => i.checked);
                    if (checked) option = checked.value;
                }

                let priceText = '';
                try {
                    const info = window.productCatalog.calculatePrice(p.id, qty, option);
                    priceText = window.cartUtils.formatCurrency(info.unitPrice) +
                                ` each (${window.cartUtils.formatCurrency(info.subtotal)} total)`;
                } catch (e) {
                    priceText = window.cartUtils
                        ? window.cartUtils.formatCurrency(p.basePrice)
                        : '$' + p.basePrice;
                }

                const priceEl = document.getElementById(`price-${p.id}`);
                if (priceEl) priceEl.textContent = priceText;
            }

            if (qtyEl) qtyEl.addEventListener('change', updatePriceDisplay);
            if (optionInputs) optionInputs.forEach(i => i.addEventListener('change', updatePriceDisplay));
            updatePriceDisplay();
        });
    }

    // ── Wait until BB3D is on the page, then register each viewer ─────────
    function initViewers (products) {
        if (!window.BB3D) {
            // BB3D script still loading — poll a handful of times.
            let tries = 0;
            const iv = setInterval(() => {
                tries++;
                if (window.BB3D || tries > 30) {
                    clearInterval(iv);
                    if (window.BB3D) initViewers(products);
                }
            }, 150);
            return;
        }

        products.forEach(p => {
            const canvas = document.getElementById('canvas3d-' + p.id);
            if (!canvas) return;

            const view = TIER_VIEWS[p.id] || TIER_VIEWS['beautybite-branded'];
            const hideLoader = () => {
                const el = document.getElementById('loading3d-' + p.id);
                if (el) el.style.display = 'none';
            };

            BB3D.registerViewer({
                canvas,
                color:         view.color,
                bg:            view.bg,
                finish:        view.finish,
                rotSpeed:      view.rotSpeed,
                label:         view.label,
                labelColor:    view.labelColor,
                labelColorway: view.labelColorway,
                scale:         1.8,
                camZ:          4.2,
                camY:          0.8,
                onReady:    hideLoader,
                onFallback: hideLoader
            });
        });
    }

    // ── Modal: re-use BB3D to render the larger product preview ──────────
    function initModalCanvas (productId) {
        const canvas = document.getElementById('modal-canvas-3d');
        if (!canvas || !window.BB3D) return;
        const view = TIER_VIEWS[productId] || TIER_VIEWS['beautybite-branded'];
        BB3D.registerViewer({
            canvas,
            color:         view.color,
            bg:            view.bg,
            finish:        view.finish,
            rotSpeed:      view.rotSpeed + 0.0015,
            label:         view.label,
            labelColor:    view.labelColor,
            labelColorway: view.labelColorway,
            scale:         1.9,
            camZ:          3.5,
            camY:          0.5,
            interactive:   true
        });
    }

    // Customize page tweaks — unchanged.
    function improveCustomizationPage () {
        const main = document.querySelector('main.customization-container');
        if (!main) return;
        main.classList.add('container');
        const canvas = document.getElementById('threejs-canvas');
        if (canvas) canvas.style.minHeight = '520px';
    }

    // Expose for the product modal code.
    window.initModalCanvas = initModalCanvas;

    document.addEventListener('DOMContentLoaded', function () {
        renderProducts();
        try { if (typeof initHeader === 'function') initHeader(); } catch (_) {}
        try { if (window.CartManager) window.CartManager.updateCartCount(); } catch (_) {}
        improveCustomizationPage();
    });

})();
