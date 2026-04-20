// Product detail page controller — drives /product/:slug
// Dependencies on page:
//   window.productCatalog   (src/js/products.js)
//   window.BB3D             (src/js/bb3d.js)

(function () {
    'use strict';

    // ────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    function fmt (n) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(n);
    }

    function escapeHtml (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getSlugFromUrl () {
        const m = location.pathname.match(/\/product\/([a-z0-9-]+)/i);
        if (m) return m[1].toLowerCase();
        const q = new URLSearchParams(location.search).get('slug');
        return q ? q.toLowerCase() : 'branded';
    }

    function toast (msg, isError) {
        const el = $('toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 2400);
    }

    // ────────────────────────────────────────────────────────────
    // Per-product visual + preset config
    // ────────────────────────────────────────────────────────────
    const VIEW_CONFIGS = {
        'clear-bulk': {
            color: '#6E7E88', bg: '#0A1929', finish: 'clear',
            finishLabel: 'Grey Silicone',
            label: null
        },
        'beautybite-branded': {
            color: '#5C8EA6', bg: '#13243A', finish: 'silicone',
            finishLabel: 'Signature Blue',
            label: 'Beauty Bite',
            labelColor:    '#FFFFFF',  // solid white on blue guard
            labelColorway: null        // no badge — plain solid text
        },
        'custom-branded': {
            color: '#5C8EA6', bg: '#080F1E', finish: 'glossy',
            finishLabel: 'Custom Silicone',
            label: null
        }
    };

    const QTY_PRESETS = {
        'clear-bulk':         [1, 10, 50, 100, 500, 1000],
        'beautybite-branded': [1, 5, 25, 50, 100],
        'custom-branded':     [1, 5, 25, 50, 100]
    };

    const SPECS = {
        'clear-bulk': [
            ['Material',              'Medical-grade EVA, autoclave-stable'],
            ['Finish',                'Crystal clear, discreet'],
            ['Patented geometry',     'Electrical isolation profile (US Patent Pending C1688.70001US00)'],
            ['Fit',                   'Universal adult — no molding required'],
            ['Sterilization',         'Autoclave at 121°C · Cold disinfection compatible'],
            ['Indications',           'Microcurrent, TENS, PEMF, interferential facial therapy']
        ],
        'beautybite-branded': [
            ['Material',              'Premium medical-grade silicone'],
            ['Finish',                'Matte-clear with subtle Beauty Bite signature engraving'],
            ['Patented geometry',     'Electrical isolation profile (US Patent Pending C1688.70001US00)'],
            ['Fit',                   'Universal adult — thinner rear wall for enhanced comfort'],
            ['Sterilization',         'Autoclave at 121°C · Cold disinfection compatible'],
            ['Indications',           'Microcurrent, TENS, PEMF, interferential facial therapy']
        ],
        'custom-branded': [
            ['Material',              'Premium medical-grade silicone'],
            ['Personalization',       'Choose from curated library or build in Design Studio'],
            ['Options',               'Brand colors, logo engraving, finish selection'],
            ['Production time',       '2–3 weeks from design approval'],
            ['Patented geometry',     'Electrical isolation profile (US Patent Pending C1688.70001US00)'],
            ['Sterilization',         'Autoclave at 121°C · Cold disinfection compatible']
        ]
    };

    // Curated design library for the $300 tier — drives BB3D color/finish swap.
    const DESIGN_LIBRARY = [
        { id: 'signature-blue',  name: 'Signature Blue',  color: '#8BB8CC', finish: 'silicone' },
        { id: 'navy-clinical',   name: 'Navy Clinical',   color: '#3A5F80', finish: 'silicone' },
        { id: 'platinum',        name: 'Platinum',        color: '#D4DCE3', finish: 'glossy'   },
        { id: 'rose-med-spa',    name: 'Rose Med-Spa',    color: '#D8A7B1', finish: 'glossy'   },
        { id: 'sage-wellness',   name: 'Sage Wellness',   color: '#9DB5A3', finish: 'matte'    },
        { id: 'graphite',        name: 'Graphite',        color: '#2D3A47', finish: 'matte'    },
        { id: 'champagne',       name: 'Champagne',       color: '#D4B896', finish: 'glossy'   },
        { id: 'custom-design',   name: 'Custom…',         custom: true                         }
    ];

    // ────────────────────────────────────────────────────────────
    // Cart helpers (matches ShoppingCart schema in shop.js)
    // ────────────────────────────────────────────────────────────
    const CART_KEY = 'beautybite_cart';

    function loadCart () {
        try {
            const raw = localStorage.getItem(CART_KEY);
            return raw ? JSON.parse(raw) : { items: [], lastUpdated: new Date().toISOString() };
        } catch (_) {
            return { items: [], lastUpdated: new Date().toISOString() };
        }
    }

    function saveCart (cart) {
        cart.lastUpdated = new Date().toISOString();
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    function addToCart (product, quantity, option, customization) {
        const cart = loadCart();
        const priceInfo = window.productCatalog.calculatePrice(product.id, quantity, option);
        const newItem = {
            productId:       product.id,
            productName:     product.name,
            quantity,
            purchasingOption: option,
            customization:    customization || {},
            priceInfo,
            addedAt:          new Date().toISOString()
        };
        const idx = cart.items.findIndex(i =>
            i.productId === product.id &&
            i.purchasingOption === option &&
            JSON.stringify(i.customization) === JSON.stringify(newItem.customization)
        );
        if (idx > -1) {
            cart.items[idx].quantity += quantity;
            cart.items[idx].priceInfo = window.productCatalog.calculatePrice(
                product.id, cart.items[idx].quantity, option
            );
        } else {
            cart.items.push(newItem);
        }
        saveCart(cart);
    }

    // ────────────────────────────────────────────────────────────
    // Page bootstrap
    // ────────────────────────────────────────────────────────────
    let viewer = null;
    let selectedDesign = null;

    function renderFeatures (product) {
        const ul = $('feature-list');
        ul.innerHTML = (product.features || [])
            .map(f => `<li>${escapeHtml(f)}</li>`).join('');
    }

    function renderSpecs (productId) {
        const rows = SPECS[productId] || [];
        $('spec-tbody').innerHTML = rows
            .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
            .join('');
    }

    function renderQtyPresets (product) {
        const min = product.minQuantity || 1;
        const presets = (QTY_PRESETS[product.id] || [1, 5, 10, 25]).filter(q => q >= min);
        if (!presets.includes(min)) presets.unshift(min);
        const wrap = $('qty-presets');
        wrap.innerHTML = presets
            .map(q => `<button type="button" class="qty-preset" data-qty="${q}">${q.toLocaleString()}</button>`)
            .join('');
        wrap.querySelectorAll('.qty-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = parseInt(btn.dataset.qty, 10);
                $('qty-input').value = q;
                wrap.querySelectorAll('.qty-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.recompute();
            });
        });

        // Apply minimum to the input element + show a small note.
        const input = $('qty-input');
        if (input) {
            input.min = String(min);
            input.value = String(min);
        }
        const noteHost = $('qty-presets').parentElement;
        if (noteHost && !noteHost.querySelector('.qty-min-note')) {
            const note = document.createElement('div');
            note.className = 'qty-min-note';
            note.style.cssText = 'font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem;';
            note.textContent = 'Minimum order: ' + min.toLocaleString() + (min === 1 ? ' unit' : ' units');
            noteHost.appendChild(note);
        }
    }

    function renderOptions (product) {
        const opts = Object.entries(product.purchasingOptions || {});
        const wrap = $('opt-radios');
        if (opts.length <= 1) {
            wrap.innerHTML = `
                <div class="opt-radio checked">
                    <input type="radio" id="opt-only" name="purchasing-option" value="${opts[0] ? opts[0][0] : 'oneTime'}" checked>
                    <label for="opt-only" class="opt-label-row">
                        <strong>${escapeHtml(opts[0] ? opts[0][1].label : 'One-time order')}</strong>
                    </label>
                </div>
            `;
            return;
        }
        wrap.innerHTML = opts.map(([key, o], idx) => `
            <label class="opt-radio ${idx === 0 ? 'checked' : ''}" data-opt="${key}">
                <input type="radio" name="purchasing-option" value="${key}" ${idx === 0 ? 'checked' : ''}>
                <span class="opt-label-row">
                    <strong>${escapeHtml(o.label)}</strong>
                    <span>${escapeHtml(o.description || '')}</span>
                </span>
            </label>
        `).join('');

        wrap.querySelectorAll('.opt-radio').forEach(el => {
            el.addEventListener('click', () => {
                wrap.querySelectorAll('.opt-radio').forEach(x => x.classList.remove('checked'));
                el.classList.add('checked');
                const input = el.querySelector('input');
                if (input) input.checked = true;
                state.recompute();
            });
        });
    }

    function renderDesignLibrary (product) {
        const section = $('design-library');
        if (product.id !== 'custom-branded') { section.style.display = 'none'; return; }
        section.style.display = 'block';

        const grid = $('design-grid');
        grid.innerHTML = DESIGN_LIBRARY.map((d, i) => {
            if (d.custom) {
                return `
                    <div class="design-swatch" data-design-idx="${i}" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#EEF6FA,#ffffff);border:2px dashed var(--brand);">
                        <div style="text-align:center;padding:0.5rem;">
                            <div style="font-size:1.3rem;color:var(--brand-dark);margin-bottom:0.2rem;">+</div>
                            <div class="design-swatch-name" style="padding:0;">Build Custom</div>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="design-swatch ${i === 0 ? 'selected' : ''}" data-design-idx="${i}">
                    <div class="design-swatch-preview" style="background:radial-gradient(circle at 35% 30%, ${d.color}, ${shade(d.color, -25)});"></div>
                    <div class="design-swatch-name">${escapeHtml(d.name)}</div>
                </div>
            `;
        }).join('');

        selectedDesign = DESIGN_LIBRARY[0];

        grid.querySelectorAll('.design-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                const idx = parseInt(sw.dataset.designIdx, 10);
                const design = DESIGN_LIBRARY[idx];
                if (design.custom) {
                    // Redirect to Design Studio as requested
                    location.href = '/design-studio';
                    return;
                }
                selectedDesign = design;
                grid.querySelectorAll('.design-swatch').forEach(x => x.classList.remove('selected'));
                sw.classList.add('selected');
                // Live-swap the 3D viewer material
                if (viewer && window.BB3D) {
                    window.BB3D.setViewerColor  && window.BB3D.setViewerColor(viewer, design.color);
                    window.BB3D.setViewerFinish && window.BB3D.setViewerFinish(viewer, design.finish);
                }
                $('viewer-finish').textContent = design.name;
            });
        });
    }

    function shade (hex, pct) {
        // Lighten (+) or darken (-) a hex color by pct %
        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);
        const f = (c) => {
            const v = Math.round(Math.max(0, Math.min(255, c + (c * pct / 100))));
            return v.toString(16).padStart(2, '0');
        };
        return '#' + f(r) + f(g) + f(b);
    }

    function bootViewer (product) {
        const canvas = $('product-canvas');
        const view = VIEW_CONFIGS[product.id] || VIEW_CONFIGS['beautybite-branded'];
        $('viewer-finish').textContent = view.finishLabel;
        $('viewer-wrap').style.background =
            `radial-gradient(circle at 50% 40%, ${shade(view.bg, 30)} 0%, ${view.bg} 100%)`;

        const hideLoader = () => {
            const el = $('viewer-loader');
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => { el.style.display = 'none'; }, 280);
            }
        };

        if (!window.BB3D) {
            hideLoader();
            return;
        }

        const isBranded = product.id === 'beautybite-branded';
        viewer = window.BB3D.registerViewer({
            canvas,
            color:         view.color,
            bg:            view.bg,
            finish:        view.finish,
            label:         view.label || null,
            labelColor:    view.labelColor    || '#5C8EA6',
            labelColorway: view.labelColorway || null,
            rotSpeed:      0.003,
            scale:         2.0,
            camZ:          isBranded ? 3.2 : 3.6,
            camY:          isBranded ? 1.4 : 0.5,
            initRotX:      isBranded ? -Math.PI * 0.42 : null,
            interactive:   true,
            labelLocked:   isBranded,
            onReady:    function () { hideLoader(); if (isBranded) renderColorwayOptions(); },
            onFallback: hideLoader
        });
    }

    // ── Colorway toggle for BeautyBite Signature ──────────────────────────
    function renderColorwayOptions () {
        const foot = document.querySelector('.viewer-foot');
        if (!foot || document.getElementById('colorway-row')) return;

        const row = document.createElement('div');
        row.id = 'colorway-row';
        row.style.cssText = 'display:flex;gap:0.6rem;align-items:center;justify-content:center;margin-top:0.75rem;flex-wrap:wrap;';

        // label above
        const lbl = document.createElement('div');
        lbl.style.cssText = 'width:100%;text-align:center;font-size:0.72rem;font-weight:600;color:#556678;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;';
        lbl.textContent = 'Colorway';
        row.appendChild(lbl);

        const options = [
            {
                label: 'Classic Blue',
                desc:  'BeautyBite blue guard · white text',
                guardColor: '#5C8EA6',
                textColor:  '#FFFFFF',
                chipStyle:  'color:#fff;background:#5C8EA6;border:2px solid #5C8EA6;'
            },
            {
                label: 'Inverse',
                desc:  'Light guard · blue text',
                guardColor: '#C8D4DC',
                textColor:  '#5C8EA6',
                chipStyle:  'color:#5C8EA6;background:#EEF6FA;border:2px solid #5C8EA6;'
            }
        ];

        options.forEach(function (opt, idx) {
            const btn = document.createElement('button');
            btn.type  = 'button';
            btn.title = opt.desc;
            btn.style.cssText = 'padding:0.35rem 1rem;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:Inter,sans-serif;' + opt.chipStyle;
            btn.textContent = opt.label;
            if (idx === 0) btn.style.outline = '3px solid rgba(92,142,166,0.5)';
            btn.addEventListener('click', function () {
                row.querySelectorAll('button').forEach(function (b) { b.style.outline = ''; });
                btn.style.outline = '3px solid rgba(92,142,166,0.5)';
                if (viewer && window.BB3D) {
                    window.BB3D.setViewerColor(viewer, opt.guardColor);
                    window.BB3D.setViewerLabel(viewer, 'Beauty Bite', {
                        color:      opt.textColor,
                        fontFamily: 'Pacifico'
                    });
                }
            });
            row.appendChild(btn);
        });

        foot.parentNode.insertBefore(row, foot.nextSibling);
    }

    // ────────────────────────────────────────────────────────────
    // Live state / pricing
    // ────────────────────────────────────────────────────────────
    const state = {
        product: null,
        currentTotal: 0,
        currentUnit: 0,
        getQty () {
            const v = parseInt($('qty-input').value, 10);
            if (isNaN(v) || v < 1) return 1;
            return Math.min(v, state.product.maxQuantity || 100000);
        },
        getOption () {
            const checked = document.querySelector('#opt-radios input[type="radio"]:checked');
            return checked ? checked.value : 'oneTime';
        },
        recompute () {
            if (!state.product) return;
            const qty = state.getQty();
            const opt = state.getOption();
            try {
                const info = window.productCatalog.calculatePrice(state.product.id, qty, opt);
                state.currentUnit  = info.unitPrice;
                state.currentTotal = info.subtotal;
                $('total-amount').textContent = fmt(info.subtotal);
                $('detail-price').textContent = fmt(info.unitPrice);
            } catch (_) {
                $('total-amount').textContent = fmt(state.product.basePrice * qty);
            }
        }
    };

    function bindActions (product) {
        $('qty-minus').addEventListener('click', () => {
            const v = state.getQty();
            $('qty-input').value = Math.max(1, v - 1);
            state.recompute();
        });
        $('qty-plus').addEventListener('click', () => {
            const v = state.getQty();
            $('qty-input').value = v + 1;
            state.recompute();
        });
        $('qty-input').addEventListener('input', () => {
            let v = parseInt($('qty-input').value, 10);
            if (isNaN(v)) v = 1;
            $('qty-input').value = Math.max(1, Math.min(v, product.maxQuantity || 100000));
            state.recompute();
        });

        $('btn-cart').addEventListener('click', () => {
            const qty = state.getQty();
            const opt = state.getOption();
            const customization = (product.id === 'custom-branded' && selectedDesign)
                ? { design: selectedDesign.id, designName: selectedDesign.name }
                : {};
            try {
                addToCart(product, qty, opt, customization);
                toast('Added to cart ✓');
            } catch (e) {
                toast(e.message || 'Could not add to cart', true);
            }
        });
    }

    function fillMeta (product) {
        document.title = product.name + ' — Beauty Bite';
        $('page-title').textContent = product.name + ' — Beauty Bite';
        $('page-description').setAttribute('content',
            (product.shortDescription || product.description || 'Beauty Bite therapy isolation guard.').slice(0, 160));
        $('crumb-product').textContent = product.name;
        $('detail-tag').textContent = product.badge || 'Beauty Bite';
        $('detail-name').textContent = product.name;
        $('detail-tagline').textContent = product.shortDescription || product.tagline || product.description || '';
        $('detail-price').textContent = fmt(product.basePrice);
    }

    function renderNotFound () {
        document.querySelector('.product-main .container').innerHTML = `
            <div style="text-align:center;padding:5rem 1rem;">
                <h1>Product not found</h1>
                <p style="color:var(--text-secondary);margin:1rem 0 2rem;">That product doesn't exist. Browse our full range below.</p>
                <a href="/shop" class="btn btn-primary btn-lg">View All Tiers</a>
            </div>
        `;
    }

    function whenCatalogReady (cb, tries) {
        tries = tries || 0;
        if (window.productCatalog || tries > 40) { cb(); return; }
        setTimeout(() => whenCatalogReady(cb, tries + 1), 80);
    }

    document.addEventListener('DOMContentLoaded', function () {
        whenCatalogReady(() => {
            const slug = getSlugFromUrl();
            const product = window.productCatalog
                ? window.productCatalog.getProductBySlug(slug)
                : null;

            if (!product) { renderNotFound(); return; }
            state.product = product;

            fillMeta(product);
            renderFeatures(product);
            renderSpecs(product.id);
            renderOptions(product);
            renderQtyPresets(product);
            renderDesignLibrary(product);
            bootViewer(product);
            bindActions(product);
            state.recompute();
        });
    });
})();
