import '../../styles/main.css';
import '../../styles/pages/notfound.css';
import { boot, go } from '../main.js';
import { href, BASE } from '../ui.js';

boot(() => {
  const path = location.pathname.startsWith(BASE) ? '/' + location.pathname.slice(BASE.length) : location.pathname;
  document.querySelector('[data-nf-path]').textContent = path || '/';
  document.querySelector('[data-nf-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.querySelector('#nf-q').value.trim();
    go(href('/directory/') + (q ? '?q=' + encodeURIComponent(q) : ''));
  });
});
