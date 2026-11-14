// Redirect Service Worker for masareefi-81676.web.app
// Purpose: Intercept ALL requests, unregister this SW, and redirect to baseer-finance.web.app
// Once this SW activates, it claims all clients immediately and sends them to the new domain.

const NEW_ORIGIN = 'https://baseer-finance.web.app';

self.addEventListener('install', (event) => {
  // Skip waiting so this SW activates immediately, replacing any old cached SW
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Claim all open clients so we can redirect them
      await self.clients.claim();

      // Clear ALL caches from the old domain
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      // Send a redirect message to all open clients
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        const newUrl = client.url.replace(/^https?:\/\/masareefi-81676\.(web\.app|firebaseapp\.com)/, NEW_ORIGIN);
        client.postMessage({ type: 'REDIRECT_TO_NEW_DOMAIN', url: newUrl });
      }

      // Unregister self so this SW doesn't block future navigations
      await self.registration.unregister();
    })()
  );
});

// Intercept all navigation requests and redirect to new domain
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.hostname === 'masareefi-81676.web.app' ||
    url.hostname === 'masareefi-81676.firebaseapp.com'
  ) {
    const newUrl = event.request.url.replace(
      /^https?:\/\/masareefi-81676\.(web\.app|firebaseapp\.com)/,
      NEW_ORIGIN
    );
    event.respondWith(Response.redirect(newUrl, 301));
  }
  // All other requests (fonts, Firebase, etc.) pass through normally
});
