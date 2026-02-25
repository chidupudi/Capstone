// TrainForge Service Worker - Minimal stub
// No caching strategy needed in development
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
