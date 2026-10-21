(() => {
  const entryPaths = new Set(['/', '/index.html', '/study', '/study/', '/work', '/work/', '/friends', '/friends/', '/articles', '/articles/', '/admin', '/admin/', '/admin.html']);
  if (!entryPaths.has(location.pathname) || new URLSearchParams(location.search).get('route') === 'global') return;

  let checking = false;
  let redirecting = false;
  let dirtyForm = false;

  function markFormDirty(event) {
    if (event.target?.closest?.('form') || event.target?.isContentEditable) dirtyForm = true;
  }

  async function checkRoute() {
    if (checking || redirecting || dirtyForm || document.visibilityState === 'hidden' || document.querySelector('dialog[open]')) return;
    checking = true;
    try {
      const response = await fetch('/api/route' + location.search, {
        cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return;
      const { target } = await response.json();
      if (typeof target !== 'string' || dirtyForm || document.visibilityState === 'hidden' || document.querySelector('dialog[open]')) return;
      const destination = new URL(target);
      if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || destination.origin === location.origin) return;
      destination.pathname = location.pathname;
      destination.search = location.search;
      destination.hash = location.hash;
      redirecting = true;
      location.replace(destination.href);
    } catch {
    } finally {
      checking = false;
    }
  }

  document.addEventListener('input', markFormDirty, true);
  document.addEventListener('change', markFormDirty, true);
  window.addEventListener('online', checkRoute);
  window.addEventListener('pageshow', checkRoute);
  document.addEventListener('visibilitychange', checkRoute);
  navigator.connection?.addEventListener('change', checkRoute);
  checkRoute();
})();
