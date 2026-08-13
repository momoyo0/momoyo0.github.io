(() => {
  const root = document.documentElement;
  const picker = document.querySelector('[data-background-picker]');
  if (!picker) return;

  const actions = picker.querySelector('[data-background-picker-actions]');
  const action = picker.querySelector('.background-picker-action');
  const toggle = picker.querySelector('.background-picker-toggle');
  const magicIcon = picker.querySelector('.background-picker-icon-magic');
  const closeIcon = picker.querySelector('.background-picker-icon-close');
  const panel = picker.querySelector('.background-picker-panel');
  const close = picker.querySelector('.background-picker-close');
  const options = Array.from(picker.querySelectorAll('[data-background-option]'));
  if (!actions || !action || !toggle || !magicIcon || !closeIcon || !panel || options.length === 0) return;

  const validValues = new Set(['default', 'paper', 'cosine-pink']);
  const storageKey = 'blog-background';

  const setPanelOpen = (open, restoreFocus = false) => {
    picker.classList.toggle('is-panel-open', open);
    action.setAttribute('aria-label', open ? '关闭背景设置' : '打开背景设置');
    action.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (!open && restoreFocus) action.focus();
  };

  const setExpanded = (expanded) => {
    picker.classList.toggle('is-expanded', expanded);
    actions.hidden = false;
    actions.setAttribute('aria-hidden', String(!expanded));
    action.tabIndex = expanded ? 0 : -1;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? '收起背景工具' : '展开背景工具');
    toggle.title = expanded ? '收起背景工具' : '展开背景工具';
    magicIcon.hidden = expanded;
    closeIcon.hidden = !expanded;
    if (!expanded) setPanelOpen(false);
  };

  const setBackground = (value, persist = true) => {
    const next = validValues.has(value) ? value : 'default';
    root.dataset.background = next;
    options.forEach(option => {
      const active = option.dataset.backgroundOption === next;
      option.setAttribute('aria-pressed', String(active));
      option.classList.toggle('is-active', active);
    });

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, next);
      } catch (error) {
        // The selected preset still applies for this page if storage is blocked.
      }
    }
    window.dispatchEvent(new CustomEvent('background:change', { detail: { background: next } }));
  };

  const current = validValues.has(root.dataset.background) ? root.dataset.background : 'default';
  setBackground(current, false);

  action.addEventListener('click', () => setPanelOpen(panel.hidden));
  toggle.addEventListener('click', () => setExpanded(!picker.classList.contains('is-expanded')));
  close?.addEventListener('click', () => setPanelOpen(false, true));

  options.forEach(option => {
    option.addEventListener('click', () => {
      setBackground(option.dataset.backgroundOption || 'default');
    });
  });

  document.addEventListener('click', event => {
    if (picker.contains(event.target)) return;
    if (panel.contains(event.target)) return;
    setPanelOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setPanelOpen(false, true);
  });

  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    setBackground(event.newValue || 'default', false);
  });

  // Cosine's FloatingGroup starts expanded, leaving the settings action
  // visible and using the magic wand as the collapse-state affordance.
  setExpanded(true);
})();
