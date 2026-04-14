// Service Worker Unregister Script
// This will unregister any existing service workers that are causing Vite requests

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Service Worker unregistered:', registration);
        }
    }).then(function () {
        return navigator.serviceWorker.ready;
    }).then(function (registration) {
        if (registration) {
            registration.unregister();
            console.log('Service Worker ready state unregistered');
        }
    }).catch(function (error) {
        console.log('Service Worker unregistration failed:', error);
    });
}

// Clear any existing caches
if ('caches' in window) {
    caches.keys().then(function (cacheNames) {
        cacheNames.forEach(function (cacheName) {
            caches.delete(cacheName);
            console.log('Cache deleted:', cacheName);
        });
    });
}

console.log('Service Worker cleanup completed');