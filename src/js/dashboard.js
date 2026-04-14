/**
 * BeautyBite Customer Dashboard - Main Functionality
 * Handles navigation, data rendering, and user interactions
 */

const Dashboard = (function () {
    // Current state
    let currentSection = 'overview';
    let currentUser = null;

    // DOM Elements cache
    const elements = {
        sidebar: null,
        mainContent: null,
        sectionTitle: null,
        mobileMenuToggle: null,
        refreshBtn: null
    };

    // Initialize dashboard
    const init = () => {
        cacheElements();
        bindEvents();
        loadUserData();
        showSection('overview');
        setupMobileNavigation();

        console.log('Dashboard initialized');
    };

    // Cache DOM elements
    const cacheElements = () => {
        elements.sidebar = document.getElementById('dashboardSidebar');
        elements.mainContent = document.querySelector('.dashboard-main');
        elements.sectionTitle = document.getElementById('sectionTitle');
        elements.mobileMenuToggle = document.getElementById('mobileMenuToggle');
        elements.refreshBtn = document.getElementById('refreshBtn');
    };

    // Bind event listeners
    const bindEvents = () => {
        // Navigation
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                showSection(section);

                // Close mobile menu if open
                if (window.innerWidth <= 1024 && elements.sidebar) {
                    elements.sidebar.classList.remove('active');
                }
            });
        });

        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', refreshData);
        }

        // Search and filter events
        bindSearchAndFilterEvents();

        // Form submissions
        bindFormEvents();
    };

    // Setup mobile navigation
    const setupMobileNavigation = () => {
        if (elements.mobileMenuToggle) {
            // Show mobile menu toggle on small screens
            const checkScreenSize = () => {
                if (window.innerWidth <= 1024) {
                    elements.mobileMenuToggle.style.display = 'block';
                } else {
                    elements.mobileMenuToggle.style.display = 'none';
                    if (elements.sidebar) elements.sidebar.classList.remove('active');
                }
            };

            checkScreenSize();
            window.addEventListener('resize', checkScreenSize);
        }
    };

    // Load user data and update UI
    const loadUserData = () => {
        try {
            if (window.UserData) {
                currentUser = UserData.getUserProfile();
            } else {
                currentUser = null;
            }
        } catch (e) {
            currentUser = null;
        }
        updateUserProfileUI();
        updateDashboardStats();
    };

    // Update user profile in sidebar
    const updateUserProfileUI = () => {
        if (!currentUser) return;

        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');

        if (userAvatar && currentUser.firstName && currentUser.lastName) {
            userAvatar.textContent = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
        }
        if (userName) {
            userName.textContent = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
        }
        if (userEmail) {
            userEmail.textContent = currentUser.email || '';
        }
    };

    // Update dashboard statistics
    const updateDashboardStats = () => {
        let stats = {
            totalOrders: 0,
            activeSubscriptions: 0,
            savedDesigns: 0,
            totalSpent: '$0.00'
        };

        try {
            if (window.UserData) stats = UserData.getDashboardStats();
        } catch (e) { /* ignore */ }

        const totalOrdersEl = document.getElementById('totalOrders');
        const activeSubscriptionsEl = document.getElementById('activeSubscriptions');
        const savedDesignsEl = document.getElementById('savedDesigns');
        const totalSpentEl = document.getElementById('totalSpent');

        if (totalOrdersEl) totalOrdersEl.textContent = stats.totalOrders;
        if (activeSubscriptionsEl) activeSubscriptionsEl.textContent = stats.activeSubscriptions;
        if (savedDesignsEl) savedDesignsEl.textContent = stats.savedDesigns;
        if (totalSpentEl) totalSpentEl.textContent = stats.totalSpent;
    };

    // Show specific section
    const showSection = (section) => {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(sec => {
            sec.classList.remove('active');
        });

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');

            // Update active nav item
            const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }

            // Update section title
            if (elements.sectionTitle) {
                const sectionTitles = {
                    overview: 'Dashboard Overview',
                    orders: 'Order History',
                    subscriptions: 'My Subscriptions',
                    designs: 'My Designs',
                    tracking: 'Track Orders',
                    profile: 'Profile Settings',
                    billing: 'Billing & Payments'
                };
                elements.sectionTitle.textContent = sectionTitles[section] || 'Dashboard';
            }

            // Load section-specific data
            loadSectionData(section);

            currentSection = section;
        }
    };

    // Load data for specific section
    const loadSectionData = (section) => {
        switch (section) {
            case 'overview':
                loadOverviewData();
                break;
            case 'orders':
                loadOrdersData();
                break;
            case 'subscriptions':
                loadSubscriptionsData();
                break;
            case 'designs':
                loadDesignsData();
                break;
            case 'tracking':
                loadTrackingData();
                break;
            case 'profile':
                loadProfileData();
                break;
            case 'billing':
                loadBillingData();
                break;
        }
    };

    // Overview section data
    const loadOverviewData = () => {
        let orders = [];
        try { orders = UserData.getOrders(); } catch (e) { orders = []; }
        const recentOrders = orders.slice(0, 5); // Get last 5 orders

        renderRecentOrders(recentOrders);
        updateDashboardStats(); // Ensure stats are current
    };

    // Render recent orders table
    const renderRecentOrders = (orders) => {
        const tableBody = document.getElementById('recentOrdersTable');
        if (!tableBody) return;

        if (orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div>📦</div>
                        <p>No orders yet</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${UserData.utils.formatDate(order.date)}</td>
                <td>${order.items.length} item${order.items.length !== 1 ? 's' : ''}</td>
                <td>${UserData.utils.formatCurrency(order.total)}</td>
                <td>
                    <span class="status-badge ${UserData.utils.getStatusColor(order.status)}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </td>
            </tr>
        `).join('');
    };

    // Orders section data
    const loadOrdersData = () => {
        const searchInput = document.getElementById('orderSearch');
        const filterSelect = document.getElementById('orderFilter');
        const sortSelect = document.getElementById('orderSort');

        const query = searchInput ? searchInput.value : '';
        const filter = filterSelect ? filterSelect.value : 'all';
        const sort = sortSelect ? sortSelect.value : 'date-desc';

        const orders = UserData.searchOrders ? UserData.searchOrders(query, filter, sort) : [];
        renderOrdersTable(orders);
    };

    // Render orders table
    const renderOrdersTable = (orders) => {
        const tableBody = document.getElementById('ordersTable');
        if (!tableBody) return;

        if (orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div>📦</div>
                        <p>No orders found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${UserData.utils.formatDate(order.date)}</td>
                <td>${order.items.map(item => item.name).join(', ')}</td>
                <td>${UserData.utils.formatCurrency(order.total)}</td>
                <td>
                    <span class="status-badge ${UserData.utils.getStatusColor(order.status)}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="Dashboard.viewOrderDetails('${order.id}')">
                        View Details
                    </button>
                </td>
            </tr>
        `).join('');
    };

    // Subscriptions section data
    const loadSubscriptionsData = () => {
        const subscriptions = UserData.getSubscriptions ? UserData.getSubscriptions() : [];
        renderSubscriptionsGrid(subscriptions);
    };

    // Render subscriptions grid
    const renderSubscriptionsGrid = (subscriptions) => {
        const grid = document.getElementById('subscriptionsGrid');
        if (!grid) return;

        if (subscriptions.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div>🔄</div>
                    <p>No active subscriptions</p>
                    <button class="btn btn-primary mt-2">Browse Products</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = subscriptions.map(sub => `
            <div class="subscription-card">
                <div class="card-content">
                    <h3 class="card-title">${sub.name}</h3>
                    <div class="card-description">
                        <p><strong>Frequency:</strong> ${sub.frequency}</p>
                        <p><strong>Next Delivery:</strong> ${UserData.utils.formatDate(sub.nextDelivery)}</p>
                        <p><strong>Price:</strong> ${UserData.utils.formatCurrency(sub.price)}</p>
                        <p><strong>Saved:</strong> ${UserData.utils.formatCurrency(sub.savedAmount)}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary btn-small" onclick="Dashboard.manageSubscription('${sub.id}')">
                            Manage
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.pauseSubscription('${sub.id}')">
                            ${sub.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Designs section data
    const loadDesignsData = () => {
        const searchInput = document.getElementById('designSearch');
        const query = searchInput ? searchInput.value : '';

        const designs = UserData.searchDesigns ? UserData.searchDesigns(query) : [];
        renderDesignsGrid(designs);
    };

    // Render designs grid
    const renderDesignsGrid = (designs) => {
        const grid = document.getElementById('designsGrid');
        if (!grid) return;

        if (designs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div>🎨</div>
                    <p>No designs yet</p>
                    <button class="btn btn-primary mt-2" onclick="Dashboard.createNewDesign()">
                        Create Your First Design
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = designs.map(design => `
            <div class="design-card">
                <div class="card-image">
                    <img src="${design.thumbnail}" alt="${design.name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="card-content">
                    <h3 class="card-title">${design.name}</h3>
                    <p class="card-description">${design.description || ''}</p>
                    <div class="card-actions">
                        <button class="btn btn-primary btn-small" onclick="Dashboard.editDesign('${design.id}')">
                            Edit
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.duplicateDesign('${design.id}')">
                            Duplicate
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.orderDesign('${design.id}')">
                            Order
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.deleteDesign('${design.id}')">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Tracking section data
    const loadTrackingData = () => {
        const orders = (UserData.getOrders ? UserData.getOrders() : []).filter(order =>
            order.status === 'processing' || order.status === 'shipped'
        );
        renderTrackingGrid(orders);
    };

    // Render tracking grid
    const renderTrackingGrid = (orders) => {
        const grid = document.getElementById('trackingGrid');
        if (!grid) return;

        if (orders.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div>🚚</div>
                    <p>No orders to track</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = orders.map(order => `
            <div class="subscription-card">
                <div class="card-content">
                    <h3 class="card-title">Order ${order.orderNumber}</h3>
                    <div class="card-description">
                        <p><strong>Status:</strong> 
                            <span class="status-badge ${UserData.utils.getStatusColor(order.status)}">
                                ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                        </p>
                        <p><strong>Estimated Delivery:</strong> ${UserData.utils.formatDate(order.estimatedDelivery)}</p>
                        <p><strong>Tracking:</strong> ${order.trackingNumber}</p>
                        <p><strong>Carrier:</strong> ${order.carrier}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary btn-small" onclick="Dashboard.trackOrder('${order.trackingNumber}')">
                            Track Package
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.viewOrderDetails('${order.id}')">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Profile section data
    const loadProfileData = () => {
        loadUserProfileForm();
        loadAddressesList();
    };

    // Load user profile form
    const loadUserProfileForm = () => {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm || !currentUser) return;

        document.getElementById('firstName').value = currentUser.firstName || '';
        document.getElementById('lastName').value = currentUser.lastName || '';
        document.getElementById('email').value = currentUser.email || '';
        document.getElementById('phone').value = currentUser.phone || '';
    };

    // Load addresses list
    const loadAddressesList = () => {
        const addressesList = document.getElementById('addressesList');
        if (!addressesList) return;

        const addresses = UserData.getAddresses ? UserData.getAddresses() : [];

        if (addresses.length === 0) {
            addressesList.innerHTML = `
                <div class="empty-state">
                    <p>No addresses saved</p>
                </div>
            `;
            return;
        }

        addressesList.innerHTML = addresses.map(address => `
            <div class="form-section" style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>${address.type.charAt(0).toUpperCase() + address.type.slice(1)} Address</h4>
                        <p>
                            ${address.firstName} ${address.lastName}<br>
                            ${address.street1}<br>
                            ${address.street2 ? address.street2 + '<br>' : ''}
                            ${address.city}, ${address.state} ${address.zipCode}<br>
                            ${address.country}
                        </p>
                        ${address.isDefault ? '<span class="status-badge status-delivered">Default</span>' : ''}
                    </div>
                    <div>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.editAddress('${address.id}')">
                            Edit
                        </button>
                        ${!address.isDefault ? `
                            <button class="btn btn-secondary btn-small" onclick="Dashboard.deleteAddress('${address.id}')">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Billing section data
    const loadBillingData = () => {
        loadPaymentMethods();
        loadBillingHistory();
    };

    // Load payment methods
    const loadPaymentMethods = () => {
        const paymentMethodsList = document.getElementById('paymentMethodsList');
        if (!paymentMethodsList) return;

        const paymentMethods = UserData.getPaymentMethods ? UserData.getPaymentMethods() : [];

        if (paymentMethods.length === 0) {
            paymentMethodsList.innerHTML = `
                <div class="empty-state">
                    <p>No payment methods saved</p>
                </div>
            `;
            return;
        }

        paymentMethodsList.innerHTML = paymentMethods.map(pm => `
            <div class="form-section" style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4>${pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} •••• ${pm.lastFour}</h4>
                        <p>Expires ${pm.expiryMonth}/${pm.expiryYear}</p>
                        ${pm.isDefault ? '<span class="status-badge status-delivered">Default</span>' : ''}
                    </div>
                    <div>
                        <button class="btn btn-secondary btn-small" onclick="Dashboard.editPaymentMethod('${pm.id}')">
                            Edit
                        </button>
                        ${!pm.isDefault ? `
                            <button class="btn btn-secondary btn-small" onclick="Dashboard.deletePaymentMethod('${pm.id}')">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };

    // Load billing history
    const loadBillingHistory = () => {
        const billingHistoryTable = document.getElementById('billingHistoryTable');
        if (!billingHistoryTable) return;

        const billingHistory = UserData.getBillingHistory ? UserData.getBillingHistory() : [];

        if (billingHistory.length === 0) {
            billingHistoryTable.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div>💳</div>
                        <p>No billing history</p>
                    </td>
                </tr>
            `;
            return;
        }

        billingHistoryTable.innerHTML = billingHistory.map(bill => `
            <tr>
                <td>${UserData.utils.formatDate(bill.date)}</td>
                <td>${bill.description}</td>
                <td>${UserData.utils.formatCurrency(bill.amount)}</td>
                <td>
                    <span class="status-badge ${UserData.utils.getStatusColor(bill.status)}">
                        ${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="Dashboard.downloadInvoice('${bill.id}')">
                        Download
                    </button>
                </td>
            </tr>
        `).join('');
    };

    // Bind search and filter events
    const bindSearchAndFilterEvents = () => {
        // Order search and filters
        const orderSearch = document.getElementById('orderSearch');
        const orderFilter = document.getElementById('orderFilter');
        const orderSort = document.getElementById('orderSort');

        if (orderSearch) {
            orderSearch.addEventListener('input', debounce(loadOrdersData, 300));
        } else if (orderFilter) {
            orderFilter.addEventListener('change', loadOrdersData);
        }
        if (orderSort) {
            orderSort.addEventListener('change', loadOrdersData);
        }

        // Design search
        const designSearch = document.getElementById('designSearch');
        if (designSearch) {
            designSearch.addEventListener('input', debounce(loadDesignsData, 300));
        }

        // New design button
        const newDesignBtn = document.getElementById('newDesignBtn');
        if (newDesignBtn) {
            newDesignBtn.addEventListener('click', createNewDesign);
        }

        // Add address button
        const addAddressBtn = document.getElementById('addAddressBtn');
        if (addAddressBtn) {
            addAddressBtn.addEventListener('click', addNewAddress);
        }

        // Add payment method button
        const addPaymentMethodBtn = document.getElementById('addPaymentMethodBtn');
        if (addPaymentMethodBtn) {
            addPaymentMethodBtn.addEventListener('click', addNewPaymentMethod);
        }
    };

    // Bind form events
    const bindFormEvents = () => {
        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', handleProfileUpdate);
        }

        // Password form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', handlePasswordChange);
        }
    };

    // Handle profile update
    const handleProfileUpdate = (e) => {
        e.preventDefault();

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value
        };

        if (UserData.updateUserProfile && UserData.updateUserProfile(formData)) {
            showNotification('Profile updated successfully', 'success');
            loadUserData(); // Reload user data to update UI
        } else {
            showNotification('Failed to update profile', 'error');
        }
    };

    // Handle password change
    const handlePasswordChange = (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        // In a real app, this would make an API call
        showNotification('Password updated successfully', 'success');
        e.target.reset();
    };

    // Utility function for debouncing
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Show notification
    const showNotification = (message, type = 'info') => {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    animation: slideInRight 0.3s ease-out;
                }
                .notification-success { border-left: 4px solid #14B8A6; }
                .notification-error { border-left: 4px solid #EF4444; }
                .notification-info { border-left: 4px solid #0066CC; }
                .notification-content {
                    padding: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    min-width: 300px;
                }
                .notification-content button {
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                    margin-left: 1rem;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    };

    // Refresh all data
    const refreshData = () => {
        showNotification('Refreshing data...', 'info');
        loadUserData();
        loadSectionData(currentSection);

        // Simulate loading delay
        setTimeout(() => {
            showNotification('Data refreshed successfully', 'success');
        }, 1000);
    };

    // Public methods for global access
    return {
        init,
        showSection,
        refreshData,

        // Order methods
        viewOrderDetails: (orderId) => {
            const order = UserData.getOrder ? UserData.getOrder(orderId) : null;
            if (order) {
                alert(`Order Details for ${order.orderNumber}\n\nItems: ${order.items.map(item => item.name).join(', ')}\nTotal: ${UserData.utils.formatCurrency(order.total)}\nStatus: ${order.status}`);
            }
        },

        trackOrder: (trackingNumber) => {
            window.open(`https://www.ups.com/track?tracknum=${trackingNumber}`, '_blank');
        },

        // Subscription methods
        manageSubscription: (subscriptionId) => {
            alert(`Manage subscription ${subscriptionId}`);
        },

        pauseSubscription: (subscriptionId) => {
            const subscriptions = UserData.getSubscriptions ? UserData.getSubscriptions() : [];
            const subscription = subscriptions.find(sub => sub.id === subscriptionId);
            if (subscription && UserData.updateSubscription) {
                const newStatus = subscription.status === 'active' ? 'paused' : 'active';
                UserData.updateSubscription(subscriptionId, { status: newStatus });
                loadSubscriptionsData();
                showNotification(`Subscription ${newStatus === 'paused' ? 'paused' : 'resumed'}`, 'success');
            }
        },

        // Design methods
        createNewDesign: () => {
            window.location.href = '/customize.html';
        },

        editDesign: (designId) => {
            window.location.href = `/customize.html?design=${designId}`;
        },

        duplicateDesign: (designId) => {
            if (UserData.addDesign) {
                const designs = UserData.getDesigns ? UserData.getDesigns() : [];
                const design = designs.find(d => d.id === designId);
                if (design) {
                    const newDesign = {
                        ...design,
                        name: `${design.name} (Copy)`,
                        id: undefined
                    };
                    UserData.addDesign(newDesign);
                    loadDesignsData();
                    showNotification('Design duplicated successfully', 'success');
                }
            }
        },

        orderDesign: (designId) => {
            window.location.href = `/cart.html?design=${designId}`;
        },

        deleteDesign: (designId) => {
            if (confirm('Are you sure you want to delete this design? This action cannot be undone.')) {
                if (UserData.deleteDesign) UserData.deleteDesign(designId);
                loadDesignsData();
                showNotification('Design deleted successfully', 'success');
            }
        },

        // Address methods
        addNewAddress: () => {
            alert('Add new address functionality would open a form here');
        },

        editAddress: (addressId) => {
            alert(`Edit address ${addressId}`);
        },

        deleteAddress: (addressId) => {
            if (confirm('Are you sure you want to delete this address?')) {
                if (UserData.deleteAddress) UserData.deleteAddress(addressId);
                loadAddressesList();
                showNotification('Address deleted successfully', 'success');
            }
        },

        // Payment method methods
        addNewPaymentMethod: () => {
            alert('Add new payment method functionality would open a form here');
        },

        editPaymentMethod: (paymentMethodId) => {
            alert(`Edit payment method ${paymentMethodId}`);
        },

        deletePaymentMethod: (paymentMethodId) => {
            if (confirm('Are you sure you want to delete this payment method?')) {
                showNotification('Payment method deleted successfully', 'success');
                loadPaymentMethods();
            }
        },

        // Billing methods
        downloadInvoice: (invoiceId) => {
            alert(`Download invoice ${invoiceId}`);
        }
    };
})();

// Initialize dashboard when DOM is loaded
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
        try { Dashboard.init(); } catch (e) { /* ignore initialization errors on pages that aren't the dashboard */ }
    });
}