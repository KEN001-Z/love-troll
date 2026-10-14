(() => {
  'use strict';

  const burger = document.querySelector('.burger');
  const menu = document.getElementById('menu');
  if (!burger || !menu) return;

  const setMenu = open => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setMenu(false);
      burger.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.nav')) setMenu(false);
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', () => setMenu(false));
})();
