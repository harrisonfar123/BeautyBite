// auth-shim.js
// Lightweight shim that waits for AuthManager and exposes a stable AuthSystem API
(function () {
    const MAX_TRIES = 50;
    const INTERVAL = 100; // ms
    let tries = 0;

    function createShim() {
        // Idempotency guard to prevent re-wrapping and recursion across multiple loads
        if (window.__AUTH_SHIM_PATCHED__) return true;
        if (!window.AuthManager) return false;

        if (!window.AuthSystem) {
            window.AuthSystem = {};
        }

        const am = window.AuthManager;

        // Only define methods if not already provided to avoid overwriting aliases or causing recursion
        if (typeof window.AuthSystem.login !== 'function') {
            window.AuthSystem.login = function (email, password, rememberMe) {
                if (!am || typeof am.login !== 'function') return Promise.reject(new Error('AuthManager not ready'));
                return am.login(email, password, rememberMe);
            };
        }

        if (typeof window.AuthSystem.register !== 'function') {
            window.AuthSystem.register = function (userData) {
                if (!am || typeof am.register !== 'function') return Promise.reject(new Error('AuthManager not ready'));
                return am.register(userData);
            };
        }

        if (typeof window.AuthSystem.logout !== 'function') {
            window.AuthSystem.logout = function () {
                try {
                    if (am && typeof am.logout === 'function') {
                        return am.logout();
                    }
                } catch (e) { /* ignore */ }
                // fallback: clear tokens
                try { localStorage.removeItem('beautybite_jwt_token'); } catch (e) { }
                return Promise.resolve();
            };
        }

        if (typeof window.AuthSystem.isAuthenticated !== 'function') {
            window.AuthSystem.isAuthenticated = function () {
                try {
                    return !!(am && am.checkAuthStatus && am.checkAuthStatus());
                } catch (e) {
                    return false;
                }
            };
        }

        if (typeof window.AuthSystem.getCurrentUser !== 'function') {
            window.AuthSystem.getCurrentUser = function () {
                try {
                    return am.getStoredUserData ? am.getStoredUserData() : am.currentUser;
                } catch (e) {
                    return null;
                }
            };
        }

        if (typeof window.AuthSystem.getToken !== 'function') {
            window.AuthSystem.getToken = function () {
                try { return am.getToken(); } catch (e) { return null; }
            };
        }

        // Mark as patched to avoid re-entry on subsequent loads
        window.__AUTH_SHIM_PATCHED__ = true;
        return true;
    }

    const timer = setInterval(() => {
        tries++;
        if (createShim() || tries >= MAX_TRIES) {
            clearInterval(timer);
        }
    }, INTERVAL);
})();