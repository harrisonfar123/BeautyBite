// Shop tier cards — wires the three tier-card canvases to BB3D.
// Pure rendering bootstrap; the cards themselves are static HTML in shop.html.

(function () {
    'use strict';

    const TIER_VIEWS = {
        'clear-bulk': {
            color:    '#FFFFFF',
            bg:       '#0A1929',
            finish:   'clear',
            rotSpeed: 0.0075,
            label:    null,
            labelColor: '#1B2D3E'
        },
        'beautybite-branded': {
            color:    '#F4F6F8',
            bg:       '#13243A',
            finish:   'silicone',
            rotSpeed: 0.0065,
            label:    'Beauty Bite',
            labelColor: '#1B2D3E'
        },
        'custom-branded': {
            color:    '#5C8EA6',
            bg:       '#080F1E',
            finish:   'glossy',
            rotSpeed: 0.011,
            label:    null,
            labelColor: '#1B2D3E'
        }
    };

    function hideLoader (id) {
        const el = document.getElementById('tier-loader-' + id);
        if (el) el.style.opacity = '0';
        setTimeout(() => { if (el) el.style.display = 'none'; }, 250);
    }

    function bootViewer (productId) {
        const canvas = document.getElementById('tier-canvas-' + productId);
        if (!canvas) return;
        const view = TIER_VIEWS[productId];
        if (!view) return;

        if (!window.BB3D) {
            // Fallback: gentle gradient if BB3D never loads.
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width  = canvas.clientWidth  || 380;
                canvas.height = canvas.clientHeight || 240;
                const g = ctx.createRadialGradient(
                    canvas.width/2, canvas.height/2, 20,
                    canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)
                );
                g.addColorStop(0, view.color);
                g.addColorStop(1, view.bg);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            hideLoader(productId);
            return;
        }

        BB3D.registerViewer({
            canvas,
            color:      view.color,
            bg:         view.bg,
            finish:     view.finish,
            rotSpeed:   view.rotSpeed,
            label:      view.label,
            labelColor: view.labelColor,
            scale:      1.85,
            camZ:       4.0,
            camY:       0.6,
            onReady:    function () { hideLoader(productId); },
            onFallback: function () { hideLoader(productId); }
        });
    }

    function bootAll () {
        ['clear-bulk', 'beautybite-branded', 'custom-branded'].forEach(bootViewer);
    }

    function whenBB3DReady (cb, tries) {
        tries = tries || 0;
        if (window.BB3D || tries > 40) { cb(); return; }
        setTimeout(() => whenBB3DReady(cb, tries + 1), 120);
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Inject BB3D dynamically — shop.html doesn't load it directly so this
        // script is the single dependency surface for tier rendering.
        if (!window.BB3D) {
            const s = document.createElement('script');
            s.src = '/js/bb3d.js';
            s.async = true;
            s.onload = function () { whenBB3DReady(bootAll); };
            s.onerror = function () { bootAll(); }; // fall through to gradient fallback
            document.head.appendChild(s);
        } else {
            bootAll();
        }
    });
})();
