(function() {
  function getCartCount() {
    try {
      const raw = localStorage.getItem('beautybite_cart');
      if (!raw) return 0;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return 0;
      return items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
    } catch (_) { return 0; }
  }

  function buildNav() {
    const isLoggedIn = !!localStorage.getItem('bb_token');
    const currentPath = window.location.pathname;
    const links = [
      {href:'/',label:'Home'},
      {href:'/shop',label:'Shop'},
      {href:'/design-studio',label:'Design Studio'},
      isLoggedIn ? {href:'/dashboard',label:'Dashboard'} : {href:'/login',label:'Login'}
    ];
    const cartCount = getCartCount();
    const cartBadge = cartCount > 0
      ? `<span id="bb-cart-badge" style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;background:#5C8EA6;color:#fff;border-radius:9px;font-family:Inter,sans-serif;font-size:0.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;border:2px solid #fff;">${cartCount}</span>`
      : `<span id="bb-cart-badge" style="display:none;"></span>`;
    const cartIcon = `<a href="/cart" aria-label="Cart" title="Cart" style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:#F0F4F8;color:#1B2D3E;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background='#E2E8F0'" onmouseout="this.style.background='#F0F4F8'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>${cartBadge}</a>`;
    const cta = isLoggedIn
      ? `<a href="/dashboard" style="padding:0.45rem 1.1rem;background:#5C8EA6;color:white;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.875rem;font-weight:600;">My Account</a>`
      : `<a href="/shop" style="padding:0.45rem 1.1rem;background:#5C8EA6;color:white;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.875rem;font-weight:600;">Order Now</a>`;
    return `
<nav class="navbar" style="background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid #E2E8F0;position:sticky;top:0;z-index:100;height:68px;display:flex;align-items:center;padding:0 1.75rem;gap:2rem;box-shadow:0 1px 12px rgba(27,45,62,0.07);">
  <a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;flex-shrink:0;">
    <img src="/logo2.webp" alt="Beauty Bite" style="height:40px;width:auto;border-radius:10px;display:block;">
  </a>
  <ul style="display:flex;align-items:center;gap:0.25rem;flex:1;list-style:none;margin:0;padding:0;">
    ${links.map(l => `<li><a href="${l.href}" style="padding:0.45rem 0.9rem;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.9rem;font-weight:500;color:${currentPath===l.href?'#1B2D3E':'#4A5568'};background:${currentPath===l.href?'#F0F4F8':'transparent'};transition:all 0.15s;" onmouseover="this.style.background='#F0F4F8';this.style.color='#1B2D3E'" onmouseout="this.style.background='${currentPath===l.href?'#F0F4F8':'transparent'}';this.style.color='${currentPath===l.href?'#1B2D3E':'#4A5568'}';">${l.label}</a></li>`).join('')}
  </ul>
  <div style="display:flex;align-items:center;gap:0.75rem;">
    ${cartIcon}
    ${cta}
  </div>
</nav>`;
  }

  function refreshCartBadge() {
    const badge = document.getElementById('bb-cart-badge');
    if (!badge) return;
    const count = getCartCount();
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function initHeader() {
    const existing = document.querySelector('nav.navbar');
    if (!existing) return;
    existing.outerHTML = buildNav();
    window.addEventListener('storage', e => { if (e.key === 'beautybite_cart') refreshCartBadge(); });
    document.addEventListener('beautybite:cart-changed', refreshCartBadge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
  window.initHeader = initHeader;
  window.refreshCartBadge = refreshCartBadge;
})();
