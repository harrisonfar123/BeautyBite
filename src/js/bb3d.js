/* ============================================================
   BeautyBite Universal 3D Library  (js/bb3d.js)

   ONE shared WebGL context → rendered off-screen → blitted into
   each product / studio canvas via 2D drawImage(). If WebGL is
   unavailable, the same 2D canvas gets a vector-drawn guard
   illustration so nothing ever looks broken.

   Public API:
     BB3D.probeWebGL()               -> true / false
     BB3D.load().then(glb => …)      -> cached GLB scene
     BB3D.registerViewer(cfg)        -> add a viewer
     BB3D.startLoop()                -> start the shared loop
     BB3D.draw2DGuard(canvas, opts)  -> 2D fallback
     BB3D.makeMaterial(opts)         -> themed material
     BB3D.BRAND_BLUE  = '#8BB8CC'

   All pages ship the same GLB:
     /Meshy_AI_Dental_Guard_Design_D_0118023519_generate.glb
   ============================================================ */
(function (global) {
    'use strict';

    const BRAND_BLUE   = '#8BB8CC';
    const BRAND_DARK   = '#5C8EA6';
    const BRAND_LIGHT  = '#B8D5E3';
    const NAVY         = '#1B2D3E';
    const GLB_URL      = '/Meshy_AI_Dental_Guard_Design_D_0118023519_generate.glb';

    const state = {
        webglOk:     null,   // tri-state: null=untested, true/false=result
        renderer:    null,
        glbScene:    null,
        glbPromise:  null,
        viewers:     [],
        loopRunning: false
    };

    // ────────────────────────────────────────────────────────────
    // WebGL probe — never throws. Runs once, caches the result.
    // ────────────────────────────────────────────────────────────
    function probeWebGL () {
        if (state.webglOk !== null) return state.webglOk;
        try {
            const c  = document.createElement('canvas');
            const gl = c.getContext('webgl2') ||
                       c.getContext('webgl')  ||
                       c.getContext('experimental-webgl');
            state.webglOk = !!gl && !!gl.getParameter;
        } catch (_) { state.webglOk = false; }
        return state.webglOk;
    }

    function threeLoaded () { return typeof global.THREE !== 'undefined'; }

    // ────────────────────────────────────────────────────────────
    // Shared renderer — lazily created, only if WebGL is available
    // and THREE is loaded. Low-power, no antialias, pixelRatio = 1
    // → maximum compatibility.
    // ────────────────────────────────────────────────────────────
    function getRenderer () {
        if (state.renderer) return state.renderer;
        if (!probeWebGL() || !threeLoaded()) return null;
        try {
            const off = document.createElement('canvas');
            off.width = 480; off.height = 320;
            const r = new THREE.WebGLRenderer({
                canvas: off,
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'default',
                failIfMajorPerformanceCaveat: false
            });
            r.setPixelRatio(1);
            // Linear output + no tone mapping keeps colors predictable on r128.
            // sRGBEncoding + MeshPhysicalMaterial without an envMap was rendering
            // meshes fully black on some GPUs; linear path avoids that class of bug.
            if ('outputEncoding' in r) r.outputEncoding = THREE.LinearEncoding;
            r.toneMapping    = THREE.NoToneMapping;
            r.toneMappingExposure = 1.0;
            state.renderer = r;
            return r;
        } catch (e) {
            state.webglOk = false;
            return null;
        }
    }

    // ────────────────────────────────────────────────────────────
    // GLB loader — shared Promise, fulfilled once.
    // ────────────────────────────────────────────────────────────
    function load () {
        if (state.glbPromise) return state.glbPromise;
        if (!threeLoaded() || !THREE.GLTFLoader) {
            state.glbPromise = Promise.reject(new Error('THREE / GLTFLoader missing'));
            return state.glbPromise;
        }
        state.glbPromise = new Promise((resolve, reject) => {
            new THREE.GLTFLoader().load(GLB_URL,
                (gltf) => { state.glbScene = gltf.scene; resolve(gltf.scene); },
                undefined,
                (err)  => reject(err)
            );
        });
        return state.glbPromise;
    }

    // ────────────────────────────────────────────────────────────
    // Materials — three presets mapped to the BeautyBite palette
    // ────────────────────────────────────────────────────────────
    function makeMaterial (opts) {
        const o = opts || {};
        const base     = o.color || BRAND_BLUE;
        const color    = new THREE.Color(base);
        const finish   = o.finish || 'silicone';          // silicone | glossy | matte | clear
        // Small emissive floor so the mesh is readable even on very dark backgrounds,
        // but not so high that it washes out the actual color.
        const emiss    = new THREE.Color(base).multiplyScalar(0.12);

        if (finish === 'clear') {
            // "Clear" is now a soft grey silicone — not translucent, just a neutral
            // medical-grade look that reads cleanly on dark backgrounds.
            const grey = new THREE.Color('#C4CDD4');
            return new THREE.MeshStandardMaterial({
                color: grey,
                roughness: 0.55,
                metalness: 0.0,
                emissive: new THREE.Color('#C4CDD4').multiplyScalar(0.10),
                emissiveIntensity: 0.18,
                side: THREE.DoubleSide
            });
        }
        if (finish === 'glossy') {
            return new THREE.MeshStandardMaterial({
                color, roughness: 0.22, metalness: 0.1,
                emissive: emiss, emissiveIntensity: 0.25,
                side: THREE.DoubleSide
            });
        }
        if (finish === 'matte') {
            return new THREE.MeshStandardMaterial({
                color, roughness: 0.75, metalness: 0.0,
                emissive: emiss, emissiveIntensity: 0.2,
                side: THREE.DoubleSide
            });
        }
        // default "silicone" — medical-grade feel, no envMap dependency.
        return new THREE.MeshStandardMaterial({
            color, roughness: 0.4, metalness: 0.0,
            emissive: emiss, emissiveIntensity: 0.22,
            side: THREE.DoubleSide
        });
    }

    // ────────────────────────────────────────────────────────────
    // Build a CanvasTexture with branded text for label decals.
    // ────────────────────────────────────────────────────────────
    function makeLabelTexture (text, opts) {
        const o = opts || {};
        const W = 1024, H = 256;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, W, H);

        // Auto-fit the text width.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let fs = o.fontSize || 160;
        const maxTextWidth = W * 0.9;
        do {
            ctx.font = '700 ' + fs + 'px "Pacifico", "Brush Script MT", cursive';
            if (ctx.measureText(text).width <= maxTextWidth) break;
            fs -= 4;
        } while (fs > 40);

        // White stroke for legibility against any base color.
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth   = Math.max(4, fs * 0.06);
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.strokeText(text, W / 2, H / 2);
        ctx.shadowColor = 'rgba(15,26,46,0.35)';
        ctx.shadowBlur  = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = o.color || '#1B2D3E';
        ctx.fillText(text, W / 2, H / 2);

        const tex = new THREE.CanvasTexture(c);
        if ('encoding' in tex) tex.encoding = THREE.LinearEncoding;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        return tex;
    }

    function makeImageTexture (dataUrl, onLoad) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const tex = new THREE.Texture();
        img.onload = () => {
            tex.image = img;
            if ('encoding' in tex) tex.encoding = THREE.LinearEncoding;
            tex.anisotropy = 4;
            tex.needsUpdate = true;
            if (onLoad) onLoad(img);
        };
        img.src = dataUrl;
        return tex;
    }

    function buildLabelDecal (text, opts) {
        if (!text) return null;
        const o = opts || {};
        const tex = makeLabelTexture(text, { color: o.color || '#1B2D3E' });
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthTest: false,   // sit visibly on top of the mesh
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const w = o.width  || 1.0;
        const h = o.height || 0.25;
        const geom = new THREE.PlaneGeometry(w, h);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 10;
        mesh.userData.isLabelDecal = true;
        return mesh;
    }

    function buildLogoDecal (dataUrl, opts) {
        if (!dataUrl) return null;
        const o = opts || {};
        const mat = new THREE.MeshBasicMaterial({
            map: makeImageTexture(dataUrl),
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const w = o.width  || 0.55;
        const h = o.height || 0.35;
        const geom = new THREE.PlaneGeometry(w, h);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 11;
        mesh.userData.isLogoDecal = true;
        return mesh;
    }

    // ────────────────────────────────────────────────────────────
    // Build a themed scene. bgColor can be a CSS hex.
    // ────────────────────────────────────────────────────────────
    function buildScene (bgHex) {
        const sc = new THREE.Scene();
        sc.background = new THREE.Color(bgHex || NAVY);

        // Hemisphere provides a soft wrap-around fill so the mesh is never fully dark.
        sc.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(BRAND_DARK), 0.45));
        // Ambient — global baseline.
        sc.add(new THREE.AmbientLight(0xffffff, 0.3));
        // Key — front-top.
        const key  = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(4, 6, 5); sc.add(key);
        // Fill — brand light, opposite side.
        const fill = new THREE.DirectionalLight(new THREE.Color(BRAND_LIGHT), 0.5);
        fill.position.set(-4, 2, 3); sc.add(fill);
        // Rim — edge lift from behind.
        const rim  = new THREE.DirectionalLight(new THREE.Color(BRAND_LIGHT), 0.35);
        rim.position.set(0, 1, -5); sc.add(rim);

        return sc;
    }

    function buildMesh (scene, opts) {
        if (!state.glbScene) return null;
        const clone = state.glbScene.clone(true);
        const box   = new THREE.Box3().setFromObject(clone);
        const ctr   = box.getCenter(new THREE.Vector3());
        const sz    = box.getSize(new THREE.Vector3());
        clone.position.sub(ctr);
        const maxDim = Math.max(sz.x, sz.y, sz.z);
        clone.scale.setScalar((opts.scale || 1.6) / maxDim);
        clone.position.y += (opts.yOffset != null ? opts.yOffset : -0.05);
        clone.traverse(c => {
            if (c.isMesh) {
                // The shipped GLB has no vertex normals — without normals, any lit
                // material (Standard / Physical) renders pure black. Generate them
                // on first use so lighting + shading works everywhere.
                if (c.geometry && !c.geometry.getAttribute('normal')) {
                    c.geometry.computeVertexNormals();
                }
                c.material = makeMaterial({ color: opts.color, finish: opts.finish });
                c.castShadow = false; c.receiveShadow = false;
            }
        });
        if (opts.label) {
            const labelScale = 1 / ((opts.scale || 1.6) / maxDim);
            // Two back-to-back decals so the text is readable from either side
            // as the model spins. The mesh's "front wall" (lip side) is on -Z;
            // the "back" (palate side) is on +Z.
            const front = buildLabelDecal(opts.label, { color: opts.labelColor || '#5C8EA6' });
            if (front) {
                front.scale.setScalar(labelScale);
                front.position.set(0, sz.y * 0.05, -sz.z * 0.55);
                front.rotation.y = Math.PI;
                clone.add(front);
            }
            const back = buildLabelDecal(opts.label, { color: opts.labelColor || '#5C8EA6' });
            if (back) {
                back.scale.setScalar(labelScale);
                back.position.set(0, sz.y * 0.05, sz.z * 0.55);
                clone.add(back);
            }
        }
        if (opts.logo) {
            const logoScale = 1 / ((opts.scale || 1.6) / maxDim);
            const logo = buildLogoDecal(opts.logo, { color: opts.logoColor });
            if (logo) {
                logo.scale.setScalar(logoScale);
                logo.position.set(0, sz.y * 0.25, sz.z * 0.55);
                clone.add(logo);
            }
        }
        scene.add(clone);
        return clone;
    }

    function removeDecalsBy (model, key) {
        if (!model) return;
        const toRemove = [];
        model.traverse(c => { if (c.userData && c.userData[key]) toRemove.push(c); });
        toRemove.forEach(n => {
            if (n.parent) n.parent.remove(n);
            if (n.material) {
                if (n.material.map) n.material.map.dispose();
                n.material.dispose();
            }
            if (n.geometry) n.geometry.dispose();
        });
    }

    function setViewerLabel (v, label, opts) {
        if (!v || !v.model) return;
        removeDecalsBy(v.model, 'isLabelDecal');
        v.label = label || null;
        if (!label) return;
        // v.model is scaled; compute world-space bbox, then convert to the
        // model's local space so the decal sits just off the +Z face.
        const box = new THREE.Box3().setFromObject(v.model);
        const sz  = box.getSize(new THREE.Vector3());
        const s   = v.model.scale.x || 1;
        const decal = buildLabelDecal(label, { color: (opts && opts.color) || v.labelColor || '#1B2D3E' });
        if (decal) {
            decal.scale.setScalar(1 / s);
            decal.position.set(0, (sz.y * 0.05) / s, (sz.z * 0.55) / s);
            v.model.add(decal);
        }
    }

    function setViewerLogo (v, dataUrl, opts) {
        if (!v || !v.model) return;
        removeDecalsBy(v.model, 'isLogoDecal');
        v.logo = dataUrl || null;
        if (!dataUrl) return;
        const box = new THREE.Box3().setFromObject(v.model);
        const sz  = box.getSize(new THREE.Vector3());
        const s   = v.model.scale.x || 1;
        const logo = buildLogoDecal(dataUrl, opts || {});
        if (logo) {
            logo.scale.setScalar(1 / s);
            logo.position.set(0, (sz.y * 0.25) / s, (sz.z * 0.55) / s);
            v.model.add(logo);
        }
    }

    // ────────────────────────────────────────────────────────────
    // Viewer registration — {canvas, bg, color, finish, camera, rotSpeed,
    //                        onReady, onFallback}
    // ────────────────────────────────────────────────────────────
    function registerViewer (cfg) {
        if (!cfg || !cfg.canvas) return null;
        if (!probeWebGL() || !threeLoaded()) {
            draw2DGuard(cfg.canvas, cfg);
            if (cfg.onFallback) cfg.onFallback();
            return null;
        }
        const renderer = getRenderer();
        if (!renderer) {
            draw2DGuard(cfg.canvas, cfg);
            if (cfg.onFallback) cfg.onFallback();
            return null;
        }
        const scene  = buildScene(cfg.bg || NAVY);
        const w = cfg.canvas.clientWidth  || cfg.canvas.parentElement.clientWidth  || 380;
        const h = cfg.canvas.clientHeight || cfg.canvas.parentElement.clientHeight || 240;
        const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
        camera.position.set(0, cfg.camY != null ? cfg.camY : 0.4, cfg.camZ || 3.8);

        const v = {
            canvas: cfg.canvas,
            scene, camera,
            model: null,
            color: cfg.color  || BRAND_BLUE,
            finish: cfg.finish || 'silicone',
            rotSpeed: cfg.rotSpeed != null ? cfg.rotSpeed : 0.008,
            yOffset:  cfg.yOffset,
            scale:    cfg.scale,
            label:    cfg.label || null,
            labelColor: cfg.labelColor || '#1B2D3E',
            logo:     cfg.logo || null,
            onReady:  cfg.onReady,
            controls: null,
            _paused:  false,
            interactive: !!cfg.interactive
        };

        load().then(() => {
            v.model = buildMesh(v.scene, v);
            if (cfg.interactive && THREE.OrbitControls) {
                // OrbitControls need a DOM element that receives pointer events.
                // Our 2D canvas IS that element.
                v.controls = new THREE.OrbitControls(v.camera, v.canvas);
                v.controls.enableDamping = true;
                v.controls.dampingFactor = 0.07;
                v.controls.minDistance   = 1.5;
                v.controls.maxDistance   = 10;
                v.controls.enablePan     = true;
            }
            if (v.onReady) v.onReady(v);
        }).catch((e) => {
            console.warn('[BB3D] GLB load failed — using 2D fallback', e);
            draw2DGuard(cfg.canvas, cfg);
            if (cfg.onFallback) cfg.onFallback();
        });

        state.viewers.push(v);
        startLoop();
        return v;
    }

    function isDecal (c) {
        return c.userData && (c.userData.isLabelDecal || c.userData.isLogoDecal);
    }

    function setViewerColor (v, hex) {
        if (!v || !v.model) return;
        v.color = hex;
        v.model.traverse(c => {
            if (c.isMesh && !isDecal(c)) {
                c.material = makeMaterial({ color: v.color, finish: v.finish });
            }
        });
    }

    function setViewerFinish (v, finish) {
        if (!v || !v.model) return;
        v.finish = finish;
        v.model.traverse(c => {
            if (c.isMesh && !isDecal(c)) {
                c.material = makeMaterial({ color: v.color, finish: v.finish });
            }
        });
    }

    function unregisterViewer (v) {
        state.viewers = state.viewers.filter(x => x !== v);
    }

    // ────────────────────────────────────────────────────────────
    // Shared animation loop — copies the off-screen WebGL frame
    // into every registered 2D canvas.
    // ────────────────────────────────────────────────────────────
    function startLoop () {
        if (state.loopRunning) return;
        state.loopRunning = true;
        const renderer = getRenderer();
        function step () {
            if (!state.loopRunning) return;
            requestAnimationFrame(step);
            if (!renderer) { state.loopRunning = false; return; }

            for (const v of state.viewers) {
                if (!v.model || v._paused) continue;
                const c  = v.canvas;
                const w  = c.clientWidth  || c.parentElement.clientWidth  || 380;
                const h  = c.clientHeight || c.parentElement.clientHeight || 240;
                if (w === 0 || h === 0) continue;

                if (v.controls) {
                    v.controls.update();
                } else {
                    v.model.rotation.y += v.rotSpeed;
                }
                renderer.setSize(w, h, false);
                v.camera.aspect = w / h;
                v.camera.updateProjectionMatrix();
                renderer.render(v.scene, v.camera);

                if (c.width  !== w) c.width  = w;
                if (c.height !== h) c.height = h;
                const ctx = c.getContext('2d');
                if (ctx) ctx.drawImage(renderer.domElement, 0, 0, w, h);
            }
        }
        requestAnimationFrame(step);
    }

    // ────────────────────────────────────────────────────────────
    // Canvas-2D fallback. Draws a BeautyBite-blue mouthguard that
    // honours the color/finish/label passed in.
    // ────────────────────────────────────────────────────────────
    function draw2DGuard (canvas, opts) {
        if (!canvas || !canvas.getContext) return;
        const o = opts || {};
        const parent = canvas.parentElement;
        const w = (parent ? parent.clientWidth  : 0) || canvas.clientWidth  || 380;
        const h = (parent ? parent.clientHeight : 0) || canvas.clientHeight || 240;
        canvas.width  = w;
        canvas.height = h;

        const bg     = o.bg       || NAVY;
        const color  = o.color    || BRAND_BLUE;
        const label  = o.label    || null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- background ---
        const gr = ctx.createRadialGradient(w/2, h*0.45, h*0.2, w/2, h*0.5, Math.max(w, h)*0.7);
        gr.addColorStop(0, lighten(bg, 10));
        gr.addColorStop(1, bg);
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);

        // --- guard shape ---
        function guardPath () {
            const cx = w / 2, cy = h * 0.52;
            const ow = w * 0.72, oh = h * 0.60;
            const iw = w * 0.48, ih = h * 0.40;
            const bot = h * 0.84;
            ctx.beginPath();
            ctx.moveTo(cx - ow/2, cy);
            ctx.bezierCurveTo(cx - ow/2, cy - oh*0.55, cx + ow/2, cy - oh*0.55, cx + ow/2, cy);
            ctx.bezierCurveTo(cx + ow/2, cy + oh*0.35, cx + ow/2*0.85, bot, cx, bot);
            ctx.bezierCurveTo(cx - ow/2*0.85, bot, cx - ow/2, cy + oh*0.35, cx - ow/2, cy);
            ctx.closePath();
            ctx.moveTo(cx - iw/2, cy + (oh - ih)*0.12);
            ctx.bezierCurveTo(cx - iw/2, cy - ih*0.38, cx + iw/2, cy - ih*0.38, cx + iw/2, cy + (oh-ih)*0.12);
            ctx.bezierCurveTo(cx + iw/2, cy + ih*0.42, cx + iw/2*0.8, bot - h*0.08, cx, bot - h*0.08);
            ctx.bezierCurveTo(cx - iw/2*0.8, bot - h*0.08, cx - iw/2, cy + ih*0.42, cx - iw/2, cy + (oh-ih)*0.12);
            ctx.closePath();
        }

        // Base fill
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 22;
        const fill = ctx.createLinearGradient(0, h*0.15, 0, h*0.85);
        fill.addColorStop(0, lighten(color, 12));
        fill.addColorStop(1, darken(color, 18));
        ctx.fillStyle = fill;
        guardPath();
        ctx.fill('evenodd');
        ctx.restore();

        // Shine
        ctx.save();
        const shine = ctx.createLinearGradient(w*0.15, h*0.1, w*0.6, h*0.55);
        shine.addColorStop(0, 'rgba(255,255,255,0.55)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        guardPath();
        ctx.fill('evenodd');
        ctx.restore();

        // Edge
        ctx.save();
        ctx.strokeStyle = lighten(color, 18);
        ctx.lineWidth   = 1.6;
        guardPath();
        ctx.stroke();
        ctx.restore();

        // Label
        if (label) {
            const fs = Math.max(12, Math.round(w * 0.048));
            ctx.save();
            ctx.font         = 'bold ' + fs + 'px "Pacifico", cursive';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle  = 'rgba(0,0,0,0.55)';
            ctx.lineWidth    = 3;
            ctx.strokeText(label, w/2, h*0.58);
            ctx.fillStyle    = '#ffffff';
            ctx.fillText(label, w/2, h*0.58);
            ctx.restore();
        }
    }

    // ────────────────────────────────────────────────────────────
    // Color utilities — #RRGGBB → lightened / darkened #RRGGBB
    // ────────────────────────────────────────────────────────────
    function clampByte (n) { return Math.max(0, Math.min(255, Math.round(n))); }
    function hexToRgb (hex) {
        const m = String(hex || '#000').replace('#','');
        const s = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
        const n = parseInt(s, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgbToHex (r, g, b) {
        return '#' + [r,g,b].map(v => clampByte(v).toString(16).padStart(2,'0')).join('');
    }
    function lighten (hex, pct) {
        const {r,g,b} = hexToRgb(hex);
        const k = 1 + pct / 100;
        return rgbToHex(r*k, g*k, b*k);
    }
    function darken (hex, pct) {
        const {r,g,b} = hexToRgb(hex);
        const k = 1 - pct / 100;
        return rgbToHex(r*k, g*k, b*k);
    }

    // ────────────────────────────────────────────────────────────
    // Cleanup
    // ────────────────────────────────────────────────────────────
    window.addEventListener('pagehide', function () {
        state.loopRunning = false;
        if (state.renderer) { try { state.renderer.dispose(); } catch(_){} state.renderer = null; }
        state.viewers = [];
    });

    // Public API
    global.BB3D = {
        BRAND_BLUE, BRAND_DARK, BRAND_LIGHT, NAVY, GLB_URL,
        probeWebGL,
        load,
        registerViewer, unregisterViewer,
        setViewerColor, setViewerFinish, setViewerLabel, setViewerLogo,
        startLoop,
        makeMaterial,
        draw2DGuard,
        _state: state
    };
})(window);
