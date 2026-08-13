(() => {
  const button = document.querySelector('.theme-toggle');
  if (!button || !window.BlogTheme) return;

  const label = button.querySelector('.theme-toggle-label');

  const syncButton = () => {
    const theme = BlogTheme.getTheme();
    const preference = BlogTheme.getPreference();
    const isDark = theme === 'dark';
    const nextTheme = isDark ? '浅色' : '深色';
    const currentMode = preference ? (isDark ? '深色' : '浅色') : `跟随系统（${isDark ? '深色' : '浅色'}）`;
    const action = `切换到${nextTheme}模式`;

    button.dataset.theme = theme;
    button.dataset.preference = preference || 'system';
    button.setAttribute('aria-label', action);
    button.setAttribute('aria-pressed', String(isDark));
    button.title = `当前：${currentMode}。点击${action}`;
    if (label) label.textContent = action;
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('theme-transition');

    if (!document.startViewTransition || reduceMotion) {
      BlogTheme.toggle();
      root.classList.remove('theme-transition');
      return;
    }

    const transition = document.startViewTransition(() => BlogTheme.toggle());
    transition.finished.finally(() => root.classList.remove('theme-transition'));
  };

  button.addEventListener('click', toggleTheme);
  window.addEventListener('theme:change', syncButton);
  syncButton();
})();
