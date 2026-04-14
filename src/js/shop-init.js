// Simple shop initializer: render products into #products-grid using productCatalog
(function () {
    function createProductCardHTML(product) {
        const productId = product.id;

        const tierStyles = {
            'clear-bulk': 'background:linear-gradient(135deg,#e0f7fa,#f0f9ff);',
            'beautybite-branded': 'background:linear-gradient(135deg,#1B2D3E,#3A5570);',
            'custom-branded': 'background:linear-gradient(135deg,#0f1a2e,#1e3a5f);'
        };
        const canvasStyle = tierStyles[productId] || 'background:#f0f4f8;';
        const price = window.cartUtils ? window.cartUtils.formatCurrency(product.basePrice) : ('$' + product.basePrice);

        return `
            <article class="product-card" id="product-${productId}" style="position:relative;cursor:pointer;" onclick="openProductModal('${productId}')">
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
                ${product.tagline ? `<p style="color:#14B8A6;font-size:0.9rem;font-weight:500;margin:0 0 0.75rem;">${escapeHtml(product.tagline)}</p>` : ''}
                <div class="pricing-section">
                    <div class="base-price">${price} <span style="font-size:0.85rem;font-weight:400;color:#64748b;">/ unit</span></div>
                </div>
                <p style="font-size:0.82rem;color:#94a3b8;margin-top:1rem;text-align:center;">Click to view details &amp; order</p>
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
            bgColor: 0x0a1929,
            makeMat: () => new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0xb8e4ff),
                roughness: 0.05, metalness: 0.0,
                clearcoat: 0.8, clearcoatRoughness: 0.1,
                transparent: true, opacity: 0.85,
                side: THREE.DoubleSide,
                emissive: new THREE.Color(0x1a4060),
                emissiveIntensity: 0.4
            }),
            lights: [
                ['ambient',0xd0e8ff,3.3],
                ['key',0xffffff,4.5,[4,6,4]],
                ['fill',0x88ccff,2.7,[-4,2,-3]],
                ['rim',0x44aaff,1.5,[0,-2,-5]]
            ],
            rotSpeed: 0.007
        },
        'beautybite-branded': {
            bgColor: 0x081422,
            makeMat: () => new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x2B5C8E),
                roughness: 0.2, metalness: 0.6,
                emissive: new THREE.Color(0x0d2a50),
                emissiveIntensity: 0.7
            }),
            lights: [
                ['ambient',0xffffff,3.0],
                ['key',0xffffff,5.25,[4,6,4]],
                ['fill',0x8BB8CC,2.25,[-4,2,-3]],
                ['rim',0x14B8A6,1.5,[0,-2,-5]]
            ],
            rotSpeed: 0.006
        },
        'custom-branded': {
            bgColor: 0x080f1e,
            makeMat: () => new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x0066CC),
                roughness: 0.1, metalness: 0.95,
                emissive: new THREE.Color(0x001a3d),
                emissiveIntensity: 0.6
            }),
            lights: [
                ['ambient',0xffffff,2.7],
                ['key',0xffffff,4.5,[4,6,4]],
                ['fill',0x14B8A6,2.7,[-4,2,-3]],
                ['rim',0xf59e0b,1.8,[2,-3,-4]]
            ],
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

    // Canvas-2D mouthguard illustration — used when WebGL is unavailable
    function draw2DGuard(canvas, tierId) {
        const parent = canvas.parentElement;
        const w = (parent ? parent.clientWidth : 0) || 380;
        const h = 200;
        canvas.width = w;
        canvas.height = h;

        const palettes = {
            'clear-bulk':         { bg: '#0a1929', outer: 'rgba(140,210,255,0.82)', inner: 'rgba(100,180,255,0.45)', shine: 'rgba(220,245,255,0.55)', edge: '#44aaff', label: null },
            'beautybite-branded': { bg: '#081422', outer: '#2B5C8E',                inner: '#1a3d6b',               shine: 'rgba(100,180,255,0.35)', edge: '#14B8A6', label: 'Beauty Bite' },
            'custom-branded':     { bg: '#080f1e', outer: '#0066CC',                inner: '#004499',               shine: 'rgba(0,160,255,0.3)',    edge: '#f59e0b', label: null }
        };
        const p = palettes[tierId] || palettes['beautybite-branded'];

        function drawGuardShape(ctx, w, h) {
            const cx = w / 2, cy = h * 0.52;
            const ow = w * 0.76, oh = h * 0.62; // outer bounds
            const iw = w * 0.52, ih = h * 0.42; // inner cutout
            const bot = h * 0.82; // bottom of U

            ctx.beginPath();
            // Outer U: top-left arc → down right side → bottom curve → up left side
            ctx.moveTo(cx - ow/2, cy);
            ctx.bezierCurveTo(cx - ow/2, cy - oh*0.5, cx + ow/2, cy - oh*0.5, cx + ow/2, cy);
            ctx.bezierCurveTo(cx + ow/2, cy + oh*0.3, cx + ow/2 * 0.85, bot, cx, bot);
            ctx.bezierCurveTo(cx - ow/2 * 0.85, bot, cx - ow/2, cy + oh*0.3, cx - ow/2, cy);
            ctx.closePath();

            // Cut out inner channel
            ctx.moveTo(cx - iw/2, cy + (oh - ih) * 0.1);
            ctx.bezierCurveTo(cx - iw/2, cy - ih*0.4, cx + iw/2, cy - ih*0.4, cx + iw/2, cy + (oh - ih)*0.1);
            ctx.bezierCurveTo(cx + iw/2, cy + ih*0.4, cx + iw/2*0.8, bot - h*0.08, cx, bot - h*0.08);
            ctx.bezierCurveTo(cx - iw/2*0.8, bot - h*0.08, cx - iw/2, cy + ih*0.4, cx - iw/2, cy + (oh-ih)*0.1);
            ctx.closePath();
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, w, h);

        // Subtle ambient glow
        const glow = ctx.createRadialGradient(w/2, h*0.5, h*0.05, w/2, h*0.5, h*0.55);
        glow.addColorStop(0, p.edge.replace(')', ',0.12)').replace('rgb', 'rgba').replace('#', 'rgba(') + '');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        // simple glow hack
        ctx.save();
        ctx.fillStyle = p.edge;
        ctx.globalAlpha = 0.07;
        ctx.beginPath();
        ctx.ellipse(w/2, h*0.52, w*0.4, h*0.4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // Main guard fill
        ctx.save();
        ctx.fillStyle = p.outer;
        ctx.shadowColor = p.edge;
        ctx.shadowBlur = 18;
        drawGuardShape(ctx, w, h);
        ctx.fill('evenodd');
        ctx.restore();

        // Shine gradient overlay
        const shine = ctx.createLinearGradient(w*0.15, h*0.1, w*0.6, h*0.55);
        shine.addColorStop(0, p.shine);
        shine.addColorStop(0.5, 'rgba(255,255,255,0.08)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.fillStyle = shine;
        drawGuardShape(ctx, w, h);
        ctx.fill('evenodd');
        ctx.restore();

        // Edge stroke
        ctx.save();
        ctx.strokeStyle = p.edge;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = p.edge;
        ctx.shadowBlur = 6;
        drawGuardShape(ctx, w, h);
        ctx.stroke();
        ctx.restore();

        // "Beauty Bite" label on branded tier
        if (p.label) {
            const fs = Math.max(12, Math.round(w * 0.052));
            ctx.save();
            ctx.font = `bold ${fs}px 'Pacifico', cursive`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lx = w / 2, ly = h * 0.56;
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            ctx.lineWidth = 3;
            ctx.strokeText(p.label, lx, ly);
            ctx.fillStyle = '#14B8A6';
            ctx.fillText(p.label, lx, ly);
            ctx.restore();
        }

        // Animate: gentle pulse using CSS animation on the canvas element
        canvas.style.animation = 'guardPulse 3s ease-in-out infinite';
        if (!document.getElementById('guardPulseStyle')) {
            const st = document.createElement('style');
            st.id = 'guardPulseStyle';
            st.textContent = '@keyframes guardPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.92;transform:scale(1.015)}}';
            document.head.appendChild(st);
        }
    }

    function initModalCanvas(productId) {
        const canvas = document.getElementById('modal-canvas-3d');
        if (!canvas) return;
        if (typeof THREE === 'undefined') return;

        const cfg = TIER_CONFIGS[productId] || TIER_CONFIGS['beautybite-branded'];
        const w = canvas.parentElement.clientWidth || 300;
        const h = 300;

        // Dispose previous modal renderer if any
        if (window._modalRenderer) {
            try { window._modalRenderer.dispose(); } catch(e) {}
            window._modalRenderer = null;
        }

        try {
            const oc = document.createElement('canvas');
            oc.width = w; oc.height = h;
            window._modalRenderer = new THREE.WebGLRenderer({
                canvas: oc, antialias: false, alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'low-power',
                failIfMajorPerformanceCaveat: false
            });
            window._modalRenderer.outputEncoding = THREE.sRGBEncoding;
            window._modalRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            window._modalRenderer.toneMappingExposure = 1.2;

            const scene = buildScene(cfg);
            const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
            camera.position.set(0, 0.5, 3.5);

            canvas.width = w; canvas.height = h;

            if (glbScene) {
                const mesh = buildMesh(glbScene, cfg);
                scene.add(mesh);
                let animId;
                function modalLoop() {
                    animId = requestAnimationFrame(modalLoop);
                    mesh.rotation.y += 0.01;
                    window._modalRenderer.setSize(w, h, false);
                    window._modalRenderer.render(scene, camera);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(window._modalRenderer.domElement, 0, 0, w, h);
                }
                modalLoop();
                // Stop when modal closes
                document.getElementById('product-modal').addEventListener('click', function stop() {
                    cancelAnimationFrame(animId);
                    this.removeEventListener('click', stop);
                }, {once: true});
            } else {
                draw2DGuard(canvas, productId);
            }
        } catch(e) {
            draw2DGuard(canvas, productId);
        }
    }

    function initAll3DViewers(products) {
        if (typeof THREE === 'undefined') {
            setTimeout(() => initAll3DViewers(products), 400);
            return;
        }

        // Guard: don't create a second renderer if one exists
        if (sharedRenderer) return;

        // Create the single shared renderer on a hidden offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = 400; offscreen.height = 220;
        try {
            sharedRenderer = new THREE.WebGLRenderer({
                canvas: offscreen, antialias: false, alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'low-power',
                failIfMajorPerformanceCaveat: false
            });
        } catch(e) {
            console.warn('WebGL not available — using 2D fallback:', e);
            products.forEach(p => {
                const el = document.getElementById('loading3d-' + p.id);
                const cv = document.getElementById('canvas3d-' + p.id);
                if (el) el.style.display = 'none';
                if (cv) draw2DGuard(cv, p.id);
            });
            return;
        }
        sharedRenderer.setPixelRatio(1); // no HiDPI for offscreen — saves memory
        sharedRenderer.outputEncoding = THREE.sRGBEncoding;
        sharedRenderer.toneMapping = THREE.NoToneMapping;
        sharedRenderer.toneMappingExposure = 1.8;
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
                // Overlay "Beauty Bite" brand text on the branded tier
                if (v.id === 'beautybite-branded') {
                    ctx.save();
                    const fontSize = Math.max(11, Math.round(w * 0.052));
                    ctx.font = `bold ${fontSize}px 'Pacifico', cursive`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const cx = w / 2;
                    const cy = Math.round(h * 0.58);
                    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                    ctx.lineWidth = 3;
                    ctx.strokeText('Beauty Bite', cx, cy);
                    ctx.fillStyle = '#14B8A6';
                    ctx.fillText('Beauty Bite', cx, cy);
                    ctx.restore();
                }
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

    window.addEventListener('pagehide', function() {
        if (sharedRenderer) {
            try { sharedRenderer.dispose(); } catch(e) {}
            sharedRenderer = null;
            sharedAnimRunning = false;
            glbModelLoaded = false;
            glbScene = null;
            sharedViewers = [];
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        // Render products on shop page
        renderProducts();

        // Re-run header/cart setup if available
        try { if (typeof initHeader === 'function') initHeader(); } catch (e) { /* ignore */ }
        try { if (window.CartManager) { window.CartManager.updateCartCount(); } } catch (e) { /* ignore */ }

        improveCustomizationPage();
    });
})();