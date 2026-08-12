// No offline caching yet — this exists purely so the browser considers
// the site installable (Chrome/Android requires an active service worker
// with a fetch handler before it will fire `beforeinstallprompt`).
self.addEventListener("fetch", () => {});
