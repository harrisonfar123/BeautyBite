// Header initializer for BeautyBite
// Loads auth/cart dependencies (if needed) and attaches header UI behavior (modals, auth links, cart icon)

(function () {
    // Utility to load a script and return a Promise
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // If already loaded, resolve immediately (exact or suffix match)
            if (document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[src$="${src}"]`)) {
                return resolve();
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    async function ensureDependencies() {
        // Idempotency: run once per page load
        if (window.__BB_HEADER_DEPS_LOADED__) return;
        window.__BB_HEADER_DEPS_LOADED__ = true;

        // Attempt to load from src-relative first, with graceful fallback and single-attempt behavior
        async function loadAny(candidates, label) {
            // If already present by any matching tail path, skip
            if (document.querySelector(`script[src$="${label}"]`)) return;

            for (const src of candidates) {
                // Skip if this exact src already present
                if (document.querySelector(`script[src="${src}"]`)) return;
                try {
                    await loadScript(src);
                    return; // loaded successfully
                } catch (e) {
                    // try next candidate; suppress errors, handled by final warning
                }
            }
            console.warn('Optional header dependency unavailable:', label);
        }

        const candidatesMap = {
            'js/auth-shim.js': ['js/auth-shim.js', '../js/auth-shim.js', '/js/auth-shim.js'],
            'js/auth.js': ['js/auth.js', '../js/auth.js', '/js/auth.js'],
            'js/cartUtils.js': ['js/cartUtils.js', '../js/cartUtils.js', '/js/cartUtils.js'],
            'js/auth-integration.js': ['js/auth-integration.js', '../js/auth-integration.js', '/js/auth-integration.js'],
            'js/backend-integration.js': ['js/backend-integration.js', '../js/backend-integration.js', '/js/backend-integration.js']
        };

        // Core deps (still optional; fail gracefully)
        await loadAny(candidatesMap['js/auth-shim.js'], 'js/auth-shim.js').catch(() => { });
        await loadAny(candidatesMap['js/auth.js'], 'js/auth.js').catch(() => { });
        await loadAny(candidatesMap['js/cartUtils.js'], 'js/cartUtils.js').catch(() => { });

        // Optional integrations (non-fatal)
        await loadAny(candidatesMap['js/auth-integration.js'], 'js/auth-integration.js').catch(() => { });
        await loadAny(candidatesMap['js/backend-integration.js'], 'js/backend-integration.js').catch(() => { });

        // Backwards-compatible global alias (only if not already provided)
        if (window.AuthManager && !window.AuthSystem) {
            window.AuthSystem = window.AuthManager;
        }
    }

    // Attach modal and auth handlers to header markup
    function attachHeaderHandlers() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');

        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const loginModalClose = document.getElementById('loginModalClose');
        const registerModalClose = document.getElementById('registerModalClose');
        const switchToRegister = document.getElementById('switchToRegister');
        const switchToLogin = document.getElementById('switchToLogin');

        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        function openModal(modal) {
            if (!modal) return;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        function closeModal(modal) {
            if (!modal) return;
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            // clear errors in modal
            const errors = modal.querySelectorAll('.error-message');
            errors.forEach(el => el.textContent = '');
        }

        loginBtn?.addEventListener('click', () => openModal(loginModal));
        registerBtn?.addEventListener('click', () => openModal(registerModal));
        loginModalClose?.addEventListener('click', () => closeModal(loginModal));
        registerModalClose?.addEventListener('click', () => closeModal(registerModal));
        switchToRegister?.addEventListener('click', () => { closeModal(loginModal); openModal(registerModal); });
        switchToLogin?.addEventListener('click', () => { closeModal(registerModal); openModal(loginModal); });

        window.addEventListener('click', (e) => {
            if (e.target === loginModal) closeModal(loginModal);
            if (e.target === registerModal) closeModal(registerModal);
        });

        // Form handlers that call AuthSystem (if available)
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = loginForm.querySelector('#loginEmail')?.value || '';
                const password = loginForm.querySelector('#loginPassword')?.value || '';
                const rememberMe = loginForm.querySelector('#rememberMe')?.checked || false;

                const submitBtn = loginForm.querySelector('.auth-submit-btn');
                const spinner = submitBtn?.querySelector('.loading-spinner');
                const buttonText = submitBtn?.querySelector('span');

                if (submitBtn) submitBtn.disabled = true;
                if (buttonText) buttonText.textContent = 'Signing In...';
                if (spinner) spinner.style.display = 'inline-block';

                try {
                    if (window.AuthSystem && typeof window.AuthSystem.login === 'function') {
                        const result = await window.AuthSystem.login(email, password, rememberMe);
                        if (result && result.success) {
                            closeModal(loginModal);
                            updateAuthNavigation();
                            showHeaderNotification('Login successful', 'success');
                        } else {
                            const err = result?.error || 'Login failed';
                            document.getElementById('loginEmailError') && (document.getElementById('loginEmailError').textContent = err);
                            showHeaderNotification(err, 'error');
                        }
                    } else {
                        showHeaderNotification('Auth system unavailable', 'error');
                    }
                } catch (err) {
                    console.error('Login error', err);
                    showHeaderNotification('Login failed', 'error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    if (buttonText) buttonText.textContent = 'Sign In';
                    if (spinner) spinner.style.display = 'none';
                }
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const userData = {
                    firstName: registerForm.querySelector('#registerFirstName')?.value || '',
                    lastName: registerForm.querySelector('#registerLastName')?.value || '',
                    email: registerForm.querySelector('#registerEmail')?.value || '',
                    phone: registerForm.querySelector('#registerPhone')?.value || '',
                    password: registerForm.querySelector('#registerPassword')?.value || '',
                    confirmPassword: registerForm.querySelector('#registerConfirmPassword')?.value || ''
                };

                const submitBtn = registerForm.querySelector('.auth-submit-btn');
                const spinner = submitBtn?.querySelector('.loading-spinner');
                const buttonText = submitBtn?.querySelector('span');

                if (submitBtn) submitBtn.disabled = true;
                if (buttonText) buttonText.textContent = 'Creating Account...';
                if (spinner) spinner.style.display = 'inline-block';

                try {
                    if (window.AuthSystem && typeof window.AuthSystem.register === 'function') {
                        const result = await window.AuthSystem.register(userData);
                        if (result && result.success) {
                            closeModal(registerModal);
                            updateAuthNavigation();
                            showHeaderNotification('Account created', 'success');
                        } else {
                            const err = result?.error || 'Registration failed';
                            document.getElementById('registerEmailError') && (document.getElementById('registerEmailError').textContent = err);
                            showHeaderNotification(err, 'error');
                        }
                    } else {
                        showHeaderNotification('Auth system unavailable', 'error');
                    }
                } catch (err) {
                    console.error('Register error', err);
                    showHeaderNotification('Registration failed', 'error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    if (buttonText) buttonText.textContent = 'Create Account';
                    if (spinner) spinner.style.display = 'none';
                }
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.AuthSystem && typeof window.AuthSystem.logout === 'function') {
                window.AuthSystem.logout();
                updateAuthNavigation();
                showHeaderNotification('Logged out', 'success');
            } else {
                // fallback: clear storage and update UI
                try { localStorage.removeItem('beautybite_jwt_token'); } catch (e) { }
                updateAuthNavigation();
            }
        });

        // Cart icon is handled by page scripts (setupCartIcon), but ensure cart-count exists
    }

    function showHeaderNotification(message, type = 'info') {
        // Simple top-right notification used by header
        const n = document.createElement('div');
        n.className = `header-notification header-notification-${type}`;
        n.textContent = message;
        n.style.cssText = 'position:fixed;top:20px;right:20px;background:#111;color:#fff;padding:10px 14px;border-radius:6px;z-index:20000';
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    // Expose updateAuthNavigation globally so auth.js can call it
    window.updateAuthNavigation = function () {
        const guestLinks = document.getElementById('guestLinks');
        const userLinks = document.getElementById('userLinks');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');

        let isAuthenticated = false;
        let user = null;

        try {
            if (window.AuthSystem) {
                isAuthenticated = !!window.AuthSystem.checkAuthStatus && window.AuthSystem.checkAuthStatus();
                user = window.AuthSystem.currentUser || window.AuthSystem.getStoredUserData && window.AuthSystem.getStoredUserData();
            }
        } catch (e) {
            isAuthenticated = false;
        }

        if (isAuthenticated && user) {
            guestLinks && (guestLinks.style.display = 'none');
            userLinks && (userLinks.style.display = 'flex');
            userAvatar && (userAvatar.textContent = (user.firstName ? user.firstName.charAt(0) : 'U') + (user.lastName ? user.lastName.charAt(0) : ''));
            userName && (userName.textContent = (user.firstName || '') + ' ' + (user.lastName || ''));
        } else {
            guestLinks && (guestLinks.style.display = 'flex');
            userLinks && (userLinks.style.display = 'none');
        }
    };

    // Initialize header: ensure deps then attach handlers and set initial state
    async function initHeaderInternal() {
        try {
            await ensureDependencies();
        } catch (e) {
            console.warn('Header dependencies load error', e);
        }

        attachHeaderHandlers();

        // Initial navigation update
        try { window.updateAuthNavigation(); } catch (e) { /* ignore */ }
    }

    // Provide a named initializer for pages to call after they inject header HTML
    window.initHeader = initHeaderInternal;

    // Auto-run if header is already present
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Delay a bit to allow pages to finish inserting header markup
        setTimeout(() => {
            if (document.getElementById('header-container') || document.getElementById('header')) {
                initHeaderInternal().catch(() => { /* ignore */ });
            }
        }, 50);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (document.getElementById('header-container') || document.getElementById('header')) {
                    initHeaderInternal().catch(() => { /* ignore */ });
                }
            }, 50);
        });
    }
})();