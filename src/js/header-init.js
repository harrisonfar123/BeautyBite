(function() {
  function buildNav() {
    const isLoggedIn = !!localStorage.getItem('bb_token');
    const currentPath = window.location.pathname;
    const links = [
      {href:'/',label:'Home'},
      {href:'/shop',label:'Shop'},
      {href:'/design-studio',label:'Design Studio'},
      isLoggedIn ? {href:'/dashboard',label:'Dashboard'} : {href:'/login',label:'Login'}
    ];
    return `
<nav class="navbar" style="background:rgba(255,255,255,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid #E2E8F0;position:sticky;top:0;z-index:100;height:68px;display:flex;align-items:center;padding:0 1.75rem;gap:2rem;box-shadow:0 1px 12px rgba(27,45,62,0.07);">
  <a href="/" style="display:flex;align-items:center;gap:0.5rem;text-decoration:none;flex-shrink:0;">
    <img src="/logo2.webp" alt="Beauty Bite" style="height:40px;width:auto;border-radius:10px;display:block;">
  </a>
  <ul style="display:flex;align-items:center;gap:0.25rem;flex:1;list-style:none;margin:0;padding:0;">
    ${links.map(l => `<li><a href="${l.href}" style="padding:0.45rem 0.9rem;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.9rem;font-weight:500;color:${currentPath===l.href?'#1B2D3E':'#4A5568'};background:${currentPath===l.href?'#F0F4F8':'transparent'};transition:all 0.15s;" onmouseover="this.style.background='#F0F4F8';this.style.color='#1B2D3E'" onmouseout="this.style.background='${currentPath===l.href?'#F0F4F8':'transparent'}';this.style.color='${currentPath===l.href?'#1B2D3E':'#4A5568'}';">${l.label}</a></li>`).join('')}
  </ul>
  <div style="display:flex;align-items:center;gap:0.75rem;">
    ${isLoggedIn ? `<a href="/dashboard" style="padding:0.45rem 1.1rem;background:#14B8A6;color:white;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.875rem;font-weight:600;">My Account</a>` : `<a href="/shop" style="padding:0.45rem 1.1rem;background:#14B8A6;color:white;border-radius:8px;text-decoration:none;font-family:Inter,sans-serif;font-size:0.875rem;font-weight:600;">Order Now</a>`}
  </div>
</nav>`;
  }

  function initHeader() {
    const existing = document.querySelector('nav.navbar');
    if (!existing) return;
    existing.outerHTML = buildNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
  window.initHeader = initHeader;
})();
