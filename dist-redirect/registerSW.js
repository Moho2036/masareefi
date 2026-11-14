// Minimal registerSW.js for redirect site - registers the redirect SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}
