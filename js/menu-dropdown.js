(() => {
  const dropdowns = [...document.querySelectorAll('.menu-dropdown')];
  if (!dropdowns.length) return;
  const states = new Map();

  const closeOthers = current => {
    dropdowns.forEach(dropdown => {
      if (dropdown === current) return;
      const state = states.get(dropdown);
      if (state) {
        state.hovering = false;
        state.closedByUser = true;
      }
      dropdown.removeAttribute('open');
    });
  };

  dropdowns.forEach(dropdown => {
    const parent = dropdown.closest('.menu-item-dropdown');
    const desktopHover = parent && window.matchMedia('(hover: hover) and (min-width: 992px)').matches;
    const state = { desktopHover, hovering: false, closedByUser: false };
    states.set(dropdown, state);

    dropdown.addEventListener('toggle', () => {
      if (dropdown.open) closeOthers(dropdown);
      if (state.desktopHover && state.hovering && !dropdown.open && !state.closedByUser) {
        dropdown.setAttribute('open', '');
      }
    });

    // Desktop pointers get the Cosine-style hover affordance.  Touch devices
    // keep native disclosure behavior so the same menu remains usable there.
    if (state.desktopHover) {
      parent.addEventListener('mouseenter', () => {
        state.hovering = true;
        state.closedByUser = false;
        closeOthers(dropdown);
        dropdown.setAttribute('open', '');
      });
      parent.addEventListener('mouseleave', () => {
        state.hovering = false;
        state.closedByUser = false;
        dropdown.removeAttribute('open');
      });

      // A hover-open <details> still needs a reliable click toggle.  Prevent
      // the native toggle, then mark an intentional close so the hover handler
      // does not immediately reopen it while the pointer remains over the
      // summary.
      parent.querySelector('.menu-dropdown-summary')?.addEventListener('click', event => {
        event.preventDefault();
        if (dropdown.open) {
          state.closedByUser = true;
          dropdown.removeAttribute('open');
          return;
        }

        state.closedByUser = false;
        closeOthers(dropdown);
        dropdown.setAttribute('open', '');
      });
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.menu-dropdown')) {
      dropdowns.forEach(dropdown => {
        const state = states.get(dropdown);
        if (state?.desktopHover) {
          state.hovering = false;
          state.closedByUser = true;
        }
        dropdown.removeAttribute('open');
      });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = dropdowns.find(dropdown => dropdown.open);
    if (!open) return;
    const state = states.get(open);
    if (state?.desktopHover) {
      state.hovering = false;
      state.closedByUser = true;
    }
    open.removeAttribute('open');
    open.querySelector('.menu-dropdown-summary')?.focus();
  });
})();
