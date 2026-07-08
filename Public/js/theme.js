// === Zairen Lab — Theme Toggle (Dark / Light) ===
// Persists user preference in localStorage

const THEME_KEY = 'zairen-theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedTheme() {
  return localStorage.getItem(THEME_KEY);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update Tailwind's dark mode class as well
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // Update the toggle icon
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }
  // Update theme-responsive logo images
  const webLogo = document.getElementById('web-logo');
  if (webLogo) {
    webLogo.src = theme === 'dark' ? '/assets/brand/logo-dark.svg' : '/assets/brand/logo-light.svg';
  }
  const footerLogo = document.getElementById('footer-logo');
  if (footerLogo) {
    footerLogo.src = theme === 'dark' ? '/assets/brand/logo-dark.svg' : '/assets/brand/logo-light.svg';
  }
  const adminLogo = document.getElementById('admin-logo');
  if (adminLogo) {
    adminLogo.src = theme === 'dark' ? '/assets/brand/logo-dark.svg' : '/assets/brand/logo-light.svg';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

function initTheme() {
  const saved = getSavedTheme();
  const theme = saved || 'light';
  applyTheme(theme);
}

// Initialize on load
initTheme();
