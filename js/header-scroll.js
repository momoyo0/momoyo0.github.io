/* global NexT, CONFIG */

(function() {
  const header = document.querySelector('.header');
  if (!header) return;

  // Cosine-style auto-hide: hide while scrolling down, show while scrolling up.
  const THROTTLE = 80;   // ms
  const START_DIST = 80; // px scrolled before hide kicks in
  const COSINE_TRIGGER_RATIO = .45;
  const root = document.documentElement;
  const siteNav = document.querySelector('.site-nav');
  const navToggle = document.querySelector('.site-nav-toggle .toggle');
  const brandBar = header.querySelector('.site-brand-container');
  const documentTop = element => {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  };

  let lastY = window.scrollY;
  let pendingDirection = 0;
  let throttleId = null;
  let dividerThreshold = START_DIST;

  function setHidden(hidden) {
    const changed = header.classList.contains('hide') !== hidden;
    header.classList.toggle('hide', hidden);
    if (changed) window.dispatchEvent(new Event('header:visibilitychange'));
  }

  function setDividerVisible(visible) {
    header.classList.toggle('header-divider-visible', visible);
  }

  // Cosine calls this state `with-background`: the header remains transparent
  // until the first content section is reached, then its surface and divider
  // fade in together.  The CSS scopes the visual effect to the Cosine preset.
  function setHeaderSurfaceVisible(visible) {
    header.classList.toggle('with-background', visible);
  }

  function syncDividerThreshold() {
    // Cosine's Navigator uses useScrollTrigger({ triggerDistance: 0.45 }),
    // i.e. 45% of the viewport, for its `with-background` state.  Keep the
    // legacy content-start threshold for the default/paper presets.
    if (root.dataset.background === 'cosine-pink') {
      dividerThreshold = Math.max(START_DIST, window.innerHeight * COSINE_TRIGGER_RATIO);
      return;
    }

    const postBody = document.querySelector(
      '.content.posts-expand article.post-block > .post-body[itemprop="articleBody"]'
    );
    const pagePanel = document.querySelector('.content .page-hero + .post-block');
    const firstContent = document.querySelector('.content .post-block');
    const target = postBody || pagePanel || firstContent;
    if (!target) {
      dividerThreshold = START_DIST;
      return;
    }

    const headerHeight = header.offsetHeight || 0;
    dividerThreshold = Math.max(START_DIST, documentTop(target) - headerHeight);
  }

  function apply() {
    const y = window.scrollY;
    const menuOpen = (siteNav && siteNav.classList.contains('site-nav-on')) ||
      (navToggle && navToggle.classList.contains('toggle-close'));

    // Keep the navigation reachable while its mobile menu is expanded, and
    // always reset the hidden state near the top of the page.
    if (menuOpen || y <= START_DIST) {
      setHidden(false);
      setHeaderSurfaceVisible(false);
      setDividerVisible(false);
      pendingDirection = 0;
      return;
    }

    if (pendingDirection > 0) {
      setHidden(true);
    } else if (pendingDirection < 0) {
      setHidden(false);
    }
    // Cosine keeps the `with-background` state tied to scroll position, even
    // while the header is hidden on a downward scroll. When the header is
    // shown again, its gradient and border are therefore already in place.
    const surfaceVisible = y > dividerThreshold;
    setHeaderSurfaceVisible(surfaceVisible);
    setDividerVisible(surfaceVisible && !header.classList.contains('hide'));
    pendingDirection = 0;
  }

  function onScroll() {
    const y = window.scrollY;
    const diff = y - lastY;
    lastY = y;
    if (diff > 0) pendingDirection = 1;
    if (diff < 0) pendingDirection = -1;

    if (throttleId) return;
    throttleId = setTimeout(() => {
      throttleId = null;
      apply();
    }, THROTTLE);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('background:change', () => {
    syncDividerThreshold();
    apply();
  });

  function syncHeaderHeight() {
    const headerInner = header.querySelector('.header-inner');
    const innerStyle = headerInner && getComputedStyle(headerInner);
    const innerBorder = innerStyle ?
      parseFloat(innerStyle.borderTopWidth) + parseFloat(innerStyle.borderBottomWidth) : 0;
    const height = (brandBar || header).offsetHeight + innerBorder;
    document.documentElement.style.setProperty('--header-height', height + 'px');
    syncDividerThreshold();
    window.dispatchEvent(new Event('header:heightchange'));
  }

  if (window.ResizeObserver) {
    new ResizeObserver(syncHeaderHeight).observe(brandBar || header);
  }
  window.addEventListener('resize', syncHeaderHeight);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight);
  syncHeaderHeight();
  apply();
  window.addEventListener('load', () => {
    syncDividerThreshold();
    apply();
  }, { once: true });
})();
