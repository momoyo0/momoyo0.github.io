(() => {
  const dropdowns = [...document.querySelectorAll('.menu-dropdown')];
  if (!dropdowns.length) return;

  const closeOthers = current => {
    dropdowns.forEach(dropdown => {
      if (dropdown !== current) dropdown.removeAttribute('open');
    });
  };

  dropdowns.forEach(dropdown => {
    const parent = dropdown.closest('.menu-item-dropdown');
    let hovering = false;

    dropdown.addEventListener('toggle', () => {
      if (dropdown.open) closeOthers(dropdown);
      if (hovering && !dropdown.open) dropdown.setAttribute('open', '');
    });

    // Desktop pointers get the Cosine-style hover affordance.  Touch devices
    // keep native disclosure behavior so the same menu remains usable there.
    if (parent && window.matchMedia('(hover: hover) and (min-width: 992px)').matches) {
      parent.addEventListener('mouseenter', () => {
        hovering = true;
        closeOthers(dropdown);
        dropdown.setAttribute('open', '');
      });
      parent.addEventListener('mouseleave', () => {
        hovering = false;
        dropdown.removeAttribute('open');
      });
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.menu-dropdown')) {
      dropdowns.forEach(dropdown => dropdown.removeAttribute('open'));
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = dropdowns.find(dropdown => dropdown.open);
    if (!open) return;
    open.removeAttribute('open');
    open.querySelector('.menu-dropdown-summary')?.focus();
  });
})();
