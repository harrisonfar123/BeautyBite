// Simple shop initializer: render products into #products-grid using productCatalog
(function () {
    function createProductCardHTML(product) {
        const productId = product.id;
        const quantityOptions = window.cartUtils ? window.cartUtils.generateQuantityOptionsHTML(productId) : `<option value="${product.minQuantity}">${product.minQuantity}</option>`;
        const purchasingOptions = window.cartUtils ? window.cartUtils.generatePurchasingOptionsHTML(productId) : '';

        const tierStyles = {
            'clear-bulk': 'background:linear-gradient(135deg,#e0f7fa,#f0f9ff);',
            'beautybite-branded': 'background:linear-gradient(135deg,#1B2D3E,#3A5570);',
            'custom-branded': 'background:linear-gradient(135deg,#0f1a2e,#1e3a5f);'
        };
        const canvasStyle = tierStyles[productId] || 'background:#f0f4f8;';

        return `
            <article class="product-card" id="product-${productId}" style="position:relative;">
                ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                <div class="product-3d-viewer" style="width:100%;height:200px;border-radius:8px;overflow:hidden;margin-bottom:1.5rem;position:relative;${canvasStyle}">
                    <canvas id="canvas3d-${productId}" style="display:block;width:100%;height:100%;"></canvas>
                    <div id="loading3d-${productId}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
                        <div style="text-align:center;color:rgba(255,255,255,0.7);">
                            <div style="width:28px;height:28px;border:2px solid rgba(255,255,255,0.3);border-top-color:#14B8A6;border-radius:50%;animation:spin3d 0.8s linear infinite;margin:0 auto 6px;"></div>
                            <span style="font-size:0.75rem;">Loading 3D…</span>
                        </div>
                    </div>
                </div>
                <h3 class="product-title">${escapeHtml(product.name)}</h3>
                <p class="product-description">${escapeHtml(product.description || '')}</p>

                <div class="product-features">
                    <ul class="feature-list">
                        ${(product.features || []).slice(0, 5).map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                </div>

                <div class="pricing-section">
                    <div class="base-price">${window.cartUtils ? window.cartUtils.formatCurrency(product.basePrice) : '$' + (product.basePrice || 0)}</div>
                </div>

                <div class="purchasing-options" id="purchasing-options-${productId}">
                    ${purchasingOptions}
                </div>

                <div class="quantity-section">
                    <label class="quantity-label" for="quantity-${productId}">Quantity</label>
                    <select id="quantity-${productId}" class="quantity-select">
                        ${quantityOptions}
                    </select>
                </div>

                <div class="price-display">
                    <div>Price: <span class="calculated-price" id="price-${productId}">${window.cartUtils ? window.cartUtils.formatCurrency(product.basePrice) : ('$' + product.basePrice)}</span></div>
                </div>

                <button class="add-to-cart-btn" onclick="addToCart('${productId}')">Add to Cart</button>
                ${product.type === 'custom' ? `<button class="customization-btn" onclick="startCustomization('${productId}')">Customize</button>` : ''}
            </article>
        `;
    }

    function escapeHtml(s) {
        return (s || '').toString()
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }

    function renderProducts() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;

        let products = [];
        try {
            products = window.productCatalog && window.productCatalog.getAllProducts ? window.productCatalog.getAllProducts() : [];
        } catch (e) {
            console.warn('productCatalog not available', e);
        }

        if (!products || products.length === 0) {
            grid.innerHTML = `<div class="container"><p style="text-align:center;color:var(--medium-gray);padding:2rem;">No products available.</p></div>`;
            return;
        }

        grid.innerHTML = products.map(p => createProductCardHTML(p)).join('');

        // Initialize 3D viewers after DOM is ready
        setTimeout(() => initAll3DViewers(products), 50);

        // Update price displays when quantity or purchasing option changes
        products.forEach(p => {
            const qtyEl = document.getElementById(`quantity-${p.id}`);
            const optionInputs = document.querySelectorAll(`#purchasing-options-${p.id} input[type="radio"]`);
            function updatePriceDisplay() {
                let qty = parseInt(qtyEl ? qtyEl.value : p.minQuantity) || p.minQuantity;
                let option = 'oneTime';
                if (optionInputs && optionInputs.length) {
                    const checked = Array.from(optionInputs).find(i => i.checked);
                    if (checked) option = checked.value;
                }

                let priceText = '';
                try {
                    const priceInfo = window.productCatalog.calculatePrice(p.id, qty, option);
                    priceText = window.cartUtils.formatCurrency(priceInfo.unitPrice) + ` each (${window.cartUtils.formatCurrency(priceInfo.subtotal)} total)`;
                } catch (e) {
                    priceText = window.cartUtils ? window.cartUtils.formatCurrency(p.basePrice) : '$' + p.basePrice;
                }

                const priceEl = document.getElementById(`price-${p.id}`);
                if (priceEl) priceEl.textContent = priceText;
            }

            if (qtyEl) qtyEl.addEventListener('change', updatePriceDisplay);
            optionInputs && optionInputs.forEach(i => i.addEventListener('change', updatePriceDisplay));
            updatePriceDisplay();
        });
    }

    // ── Three.js 3D product viewers (shared single WebGL context) ─────────────
    // Uses ONE renderer for all products to avoid WebGL context limit errors.
    // Each product card has a 2D canvas; we render to the shared WebGL renderer
    // then copy each frame via drawImage().

    const TIER_CONFIGS = {
        'clear-bulk': {
            bgColor: 0x0d1f3c,
            makeMat: () => new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0xddeeff),
                roughness: 0.05, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05,
                transparent: true, opacity: 0.6, side: THREE.DoubleSide
            }),
            lights: [['ambient',0xffffff,0.8],['key',0xffffff,1.2,[4,6,4]],['fill',0xaaddff,0.6,[-4,2,-3]],['rim',0x88bbff,0.3,[0,-2,-5]]],
            rotSpeed: 0.007
        },
        'beautybite-branded': {
            bgColor: 0x0a1929,
            makeMat: () => new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0x1B2D3E),
                roughness: 0.1, metalness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.08
            }),
            lights: [['ambient',0xffffff,0.6],['key',0xffffff,1.4,[4,6,4]],['fill',0x8BB8CC,0.5,[-4,2,-3]],['rim',0x14B8A6,0.35,[0,-2,-5]]],
            rotSpeed: 0.006
        },
        'custom-branded': {
            bgColor: 0x0f1a2e,
            makeMat: () => new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x0066CC),
                roughness: 0.2, metalness: 0.85
            }),
            lights: [['ambient',0xffffff,0.5],['key',0xffffff,1.3,[4,6,4]],['fill',0x14B8A6,0.6,[-4,2,-3]],['rim',0xf59e0b,0.4,[2,-3,-4]]],
            rotSpeed: 0.013
        }
    };

    // The single shared WebGL renderer — created once, renders to offscreen canvas
    let sharedRenderer = null;
    let sharedViewers = []; // [{scene, camera, canvas2d, model, rotSpeed}]
    let sharedAnimRunning = false;
    let glbModelLoaded = false;
    let glbScene = null; // Stores the original gltf.scene for cloning

    function buildScene(cfg) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(cfg.bgColor);
        cfg.lights.forEach(l => {
            if (l[0] === 'ambient') {
                scene.add(new THREE.AmbientLight(l[1], l[2]));
            } else {
                const dl = new THREE.DirectionalLight(l[1], l[2]);
                if (l[3]) dl.position.set(...l[3]);
                scene.add(dl);
            }
        });
        return scene;
    }

    function buildMesh(gltfScene, cfg) {
        const clone = gltfScene.clone(true);
        const box = new THREE.Box3().setFromObject(clone);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        clone.position.sub(center);
        clone.scale.setScalar(1.8 / Math.max(size.x, size.y, size.z));
        clone.position.y -= 0.1;
        clone.traverse(child => {
            if (child.isMesh) {
                child.material = cfg.makeMat();
                child.castShadow = true;
            }
        });
        return clone;
    }

    function initAll3DViewers(products) {
        if (typeof THREE === 'undefined') {
            setTimeout(() => initAll3DViewers(products), 400);
            return;
        }

        // Create the single shared renderer on a hidden offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = 400; offscreen.height = 220;
        try {
            sharedRenderer = new THREE.WebGLRenderer({ canvas: offscreen, antialias: true, alpha: false, preserveDrawingBuffer: true });
        } catch(e) {
            console.warn('WebGL not available:', e);
            products.forEach(p => {
                const el = document.getElementById('loading3d-' + p.id);
                if (el) el.style.display = 'none';
            });
            return;
        }
        sharedRenderer.setPixelRatio(1); // no HiDPI for offscreen — saves memory
        sharedRenderer.outputEncoding = THREE.sRGBEncoding;
        sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        sharedRenderer.toneMappingExposure = 1.15;
        sharedRenderer.shadowMap.enabled = false; // disabled for performance

        // Build viewer records
        products.forEach(p => {
            const canvas2d = document.getElementById('canvas3d-' + p.id);
            if (!canvas2d) return;
            const cfg = TIER_CONFIGS[p.id] || TIER_CONFIGS['beautybite-branded'];
            const container = canvas2d.parentElement;
            const w = container.clientWidth || 380;
            const h = container.clientHeight || 200;
            const scene = buildScene(cfg);
            const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
            camera.position.set(0, 0.8, 4.2);
            sharedViewers.push({ id: p.id, scene, camera, canvas2d, model: null, rotSpeed: cfg.rotSpeed, cfg });
        });

        // Load GLB once, clone for each viewer
        const loader = new THREE.GLTFLoader();
        loader.load('/Meshy_AI_Dental_Guard_Design_D_0118023519_generate.glb', (gltf) => {
            glbScene = gltf.scene;
            sharedViewers.forEach(v => {
                const mesh = buildMesh(glbScene, v.cfg);
                v.model = mesh;
                v.scene.add(mesh);
                const loadEl = document.getElementById('loading3d-' + v.id);
                if (loadEl) loadEl.style.display = 'none';
            });
            glbModelLoaded = true;
            if (!sharedAnimRunning) startSharedAnimation();
        }, undefined, (err) => {
            console.error('GLB load error:', err);
            sharedViewers.forEach(v => {
                const loadEl = document.getElementById('loading3d-' + v.id);
                if (loadEl) loadEl.innerHTML = '<span style="color:rgba(255,255,255,0.4);font-size:0.75rem;">Preview unavailable</span>';
            });
        });
    }

    function startSharedAnimation() {
        sharedAnimRunning = true;
        function loop() {
            requestAnimationFrame(loop);
            sharedViewers.forEach(v => {
                if (!v.model) return;
                const container = v.canvas2d.parentElement;
                const w = container.clientWidth || 380;
                const h = container.clientHeight || 200;
                v.model.rotation.y += v.rotSpeed;
                sharedRenderer.setSize(w, h, false);
                v.camera.aspect = w / h;
                v.camera.updateProjectionMatrix();
                sharedRenderer.render(v.scene, v.camera);
                const ctx = v.canvas2d.getContext('2d');
                if (v.canvas2d.width !== w) v.canvas2d.width = w;
                if (v.canvas2d.height !== h) v.canvas2d.height = h;
                ctx.drawImage(sharedRenderer.domElement, 0, 0, w, h);
            });
        }
        loop();
    }

    // Improve customization page small visual tweaks (if on customize page)
    function improveCustomizationPage() {
        const main = document.querySelector('main.customization-container');
        if (!main) return;
        // ensure main has container spacing
        main.classList.add('container');
        // make the canvas taller for better preview on desktops
        const canvas = document.getElementById('threejs-canvas');
        if (canvas) {
            canvas.style.minHeight = '520px';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Render products on shop page
        renderProducts();

        // Re-run header/cart setup if available
        try { if (typeof initHeader === 'function') initHeader(); } catch (e) { /* ignore */ }
        try { if (window.CartManager) { window.CartManager.updateCartCount(); } } catch (e) { /* ignore */ }

        improveCustomizationPage();
    });
})();