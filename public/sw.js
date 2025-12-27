
/**
 * Zylos Neural Service Worker
 * Handles background push notifications and asset caching
 */

const CACHE_NAME = 'zylos-neural-v1';
const ALLOWED_ASSETS = [
    '/',
    '/index.html',
    '/favicon.ico',
    '/manifest.json'
];

// Install: Cache core assets (Network First strategy)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Push Event: Handle incoming push messages
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Zylos', body: 'New Message', icon: '/favicon.ico' };

    // Show notification even when app is closed
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: '/favicon.ico',
            vibrate: [100, 50, 100],
            data: {
                url: self.location.origin
            }
        })
    );
});

// Notification Click: Focus app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
