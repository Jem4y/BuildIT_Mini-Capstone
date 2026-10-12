// Navbar menus.
//  - Desktop dropdowns (.nav-dropdown): hover or click/tap opens them.
//  - Mobile menu (.nav-mobile-toggle -> #mobileMenu): shown below 768px.
// Esc or a click outside closes everything.
(function () {
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  const mobileToggle = document.querySelector('.nav-mobile-toggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const navbar = document.querySelector('.itech-navbar');

  function closeDropdowns(except) {
    dropdowns.forEach((d) => {
      if (d === except) return;
      d.classList.remove('open');
      d.querySelector('.nav-dropdown-toggle').setAttribute('aria-expanded', 'false');
    });
  }

  function setMobile(open) {
    if (!mobileToggle || !mobileMenu) return;
    mobileMenu.classList.toggle('open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  dropdowns.forEach((d) => {
    const toggle = d.querySelector('.nav-dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !d.classList.contains('open');
      setMobile(false);
      closeDropdowns(d);
      d.classList.toggle('open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
  });

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdowns();
      setMobile(!mobileMenu.classList.contains('open'));
    });

    // Tapping a link closes the menu (needed for same-page #anchors)
    mobileMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMobile(false);
    });

    // If the window grows to desktop width, make sure the mobile menu is closed
    window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
      if (e.matches) setMobile(false);
    });
  }

  document.addEventListener('click', (e) => {
    closeDropdowns();
    if (!navbar || !navbar.contains(e.target)) setMobile(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openDropdown = document.querySelector('.nav-dropdown.open');
    const mobileWasOpen = mobileMenu && mobileMenu.classList.contains('open');
    closeDropdowns();
    setMobile(false);
    if (openDropdown) openDropdown.querySelector('.nav-dropdown-toggle').focus();
    else if (mobileWasOpen) mobileToggle.focus();
  });
})();
