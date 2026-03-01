/**
 * app.js — App shell
 *
 * Responsibilities:
 *  - Call db.init() once (db.js is idempotent so auth-ui.js calling it again is safe)
 *  - Populate the header with the logged-in username/avatar
 *  - Wire up the logout button
 *  - Highlight the active nav link
 *  - Hide/show <main> based on auth state
 *    (auth-ui.js also does this after React mounts — no conflict)
 */

async function startApp() {
  try {
    await db.init();
  } catch (err) {
    console.error('[app] db.init() failed:', err);
    return;
  }

  updateHeader();
  setupLogout();
  setActiveNav();

  // Show/hide page content based on session
  const main = document.querySelector('main.page');
  if (main) main.style.display = auth.isLoggedIn() ? 'block' : 'none';
}

function updateHeader() {
  const user = auth.getUser();
  if (!user) return;
  const av = document.getElementById('userAvatar');
  const un = document.getElementById('username');
  if (av) av.textContent = user.avatar || (user.username || 'U').slice(0, 2).toUpperCase();
  if (un) un.textContent = user.username || user.email || 'User';
}

function setupLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    auth.logout();
    location.reload();
  });
}

function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
    const href = btn.getAttribute('href') || '';
    if (href === page || (href === 'index.html' && (page === '' || page === 'index.html'))) {
      btn.classList.add('active');
    }
  });
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', startApp)
  : startApp();