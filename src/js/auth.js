/**
 * BeautyBite Authentication Manager
 * Handles user authentication, JWT token management, and session management
 * Connects to backend authentication endpoints
 */

class AuthManager {
    constructor() {
        // Same-origin API by default; window.API_BASE override remains supported for cross-origin setups.
        this.baseURL = (window.API_BASE ? `${window.API_BASE}/api/auth` : '/api/auth');
        this.storageKeys = {
            TOKEN: 'beautybite_jwt_token',
            REFRESH_TOKEN: 'beautybite_refresh_token',
            USER_DATA: 'beautybite_user_data',
            TOKEN_EXPIRY: 'beautybite_token_expiry'
        };
        this.currentUser = null;
        this.isAuthenticated = false;

        // Initialize auth state
        this.init();
    }

    /**
     * Initialize authentication state from localStorage
     */
    init() {
        const token = this.getToken();
        const userData = this.getStoredUserData();

        if (token && userData) {
            this.currentUser = userData;
            this.isAuthenticated = true;

            // Check if token is expired
            if (this.isTokenExpired()) {
                console.log('Token expired, attempting refresh...');
                this.refreshToken().catch(() => {
                    this.logout();
                });
            }
        }

        console.log('AuthManager initialized', {
            isAuthenticated: this.isAuthenticated,
            user: this.currentUser
        });
    }

    /**
     * User registration
     */
    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store tokens and user data
            this.storeAuthData(data);
            this.currentUser = data.user;
            this.isAuthenticated = true;

            // Update navigation
            this.updateNavigation();

            return {
                success: true,
                user: data.user,
                message: 'Registration successful'
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * User login
     */
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.baseURL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store tokens and user data
            this.storeAuthData(data, rememberMe);
            this.currentUser = data.user;
            this.isAuthenticated = true;

            // Update navigation
            this.updateNavigation();

            return {
                success: true,
                user: data.user,
                message: 'Login successful'
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * User logout
     */
    async logout() {
        try {
            const token = this.getToken();

            if (token) {
                // Call logout endpoint
                await fetch(`${this.baseURL}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage regardless of API call success
            this.clearAuthData();
            this.currentUser = null;
            this.isAuthenticated = false;

            // Update navigation
            this.updateNavigation();

            // Redirect to home page
            window.location.href = '/';
        }
    }

    /**
     * Refresh JWT token
     */
    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem(this.storageKeys.REFRESH_TOKEN);

            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch(`${this.baseURL}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Token refresh failed');
            }

            // Store new tokens
            this.storeAuthData(data);

            return {
                success: true,
                token: data.token
            };
        } catch (error) {
            console.error('Token refresh error:', error);
            this.logout();
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get current user profile
     */
    async getCurrentUser() {
        try {
            const token = this.getToken();

            if (!token) {
                throw new Error('No authentication token');
            }

            const response = await fetch(`${this.baseURL}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch user data');
            }

            // Update stored user data
            this.currentUser = data.user;
            localStorage.setItem(this.storageKeys.USER_DATA, JSON.stringify(data.user));

            return {
                success: true,
                user: data.user
            };
        } catch (error) {
            console.error('Get current user error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Forgot password
     */
    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.baseURL}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Password reset request failed');
            }

            return {
                success: true,
                message: data.message
            };
        } catch (error) {
            console.error('Forgot password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        try {
            const response = await fetch(`${this.baseURL}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, password: newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Password reset failed');
            }

            return {
                success: true,
                message: data.message
            };
        } catch (error) {
            console.error('Reset password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update password
     */
    async updatePassword(currentPassword, newPassword) {
        try {
            const token = this.getToken();

            if (!token) {
                throw new Error('No authentication token');
            }

            const response = await fetch(`${this.baseURL}/update-password`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Password update failed');
            }

            return {
                success: true,
                message: data.message
            };
        } catch (error) {
            console.error('Update password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify email
     */
    async verifyEmail(token) {
        try {
            const response = await fetch(`${this.baseURL}/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Email verification failed');
            }

            return {
                success: true,
                message: data.message
            };
        } catch (error) {
            console.error('Verify email error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Store authentication data in localStorage
     */
    storeAuthData(authData, rememberMe = false) {
        if (authData.token) {
            localStorage.setItem(this.storageKeys.TOKEN, authData.token);
        }
        if (authData.refreshToken) {
            localStorage.setItem(this.storageKeys.REFRESH_TOKEN, authData.refreshToken);
        }
        if (authData.user) {
            localStorage.setItem(this.storageKeys.USER_DATA, JSON.stringify(authData.user));
        }

        // Calculate token expiry (default 15 minutes from now)
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 15);
        localStorage.setItem(this.storageKeys.TOKEN_EXPIRY, expiryTime.toISOString());
    }

    /**
     * Clear authentication data from localStorage
     */
    clearAuthData() {
        Object.values(this.storageKeys).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    /**
     * Get stored JWT token
     */
    getToken() {
        return localStorage.getItem(this.storageKeys.TOKEN);
    }

    /**
     * Get stored user data
     */
    getStoredUserData() {
        const userData = localStorage.getItem(this.storageKeys.USER_DATA);
        return userData ? JSON.parse(userData) : null;
    }

    /**
     * Check if token is expired
     */
    isTokenExpired() {
        const expiry = localStorage.getItem(this.storageKeys.TOKEN_EXPIRY);
        if (!expiry) return true;

        return new Date() > new Date(expiry);
    }

    /**
     * Check if user is authenticated
     */
    checkAuthStatus() {
        const token = this.getToken();
        const userData = this.getStoredUserData();

        if (token && userData && !this.isTokenExpired()) {
            this.currentUser = userData;
            this.isAuthenticated = true;
            return true;
        } else if (token && this.isTokenExpired()) {
            // Token expired, attempt refresh
            this.refreshToken().catch(() => {
                this.logout();
            });
            return false;
        } else {
            this.isAuthenticated = false;
            return false;
        }
    }

    /**
     * Update navigation based on authentication status
     */
    updateNavigation() {
        // This will be called by the header component
        if (typeof window.updateAuthNavigation === 'function') {
            window.updateAuthNavigation();
        }
    }

    /**
     * Get user initials for avatar
     */
    getUserInitials() {
        if (!this.currentUser) return 'U';

        const firstName = this.currentUser.firstName || '';
        const lastName = this.currentUser.lastName || '';

        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
    }

    /**
     * Get full user name
     */
    getUserFullName() {
        if (!this.currentUser) return 'User';

        const firstName = this.currentUser.firstName || '';
        const lastName = this.currentUser.lastName || '';

        return `${firstName} ${lastName}`.trim() || 'User';
    }

    /**
     * Check if user has specific role
     */
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    /**
     * Get authorization headers for API calls
     */
    getAuthHeaders() {
        const token = this.getToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
}

// Create global instance
window.AuthManager = new AuthManager();
// Backwards-compatible alias used by some pages
window.AuthSystem = window.AuthManager;

// Synchronous helpers for legacy code that expects functions
// (e.g., CartManager checks AuthSystem.isAuthenticated() as a function)
window.AuthSystem.isAuthenticated = function () {
    try {
        return !!(window.AuthManager && window.AuthManager.checkAuthStatus && window.AuthManager.checkAuthStatus());
    } catch (e) {
        return false;
    }
};
window.AuthSystem.getCurrentUser = function () {
    try {
        return window.AuthManager.getStoredUserData ? window.AuthManager.getStoredUserData() : window.AuthManager.currentUser;
    } catch (e) {
        return null;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}