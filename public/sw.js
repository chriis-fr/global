// Listen for messages from the page to skip waiting
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// When a new service worker is installed, activate it immediately
self.addEventListener('install', function (event) {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting()
})

// When the service worker becomes active, claim all clients
self.addEventListener('activate', function (event) {
  event.waitUntil(
    clients.claim().then(function () {
      // Notify all clients that a new service worker is active
      return clients.matchAll().then(function (clientList) {
        clientList.forEach(function (client) {
          client.postMessage({ type: 'SW_ACTIVATED' })
        })
      })
    })
  )
})

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/chains.PNG',
      badge: '/chains.PNG',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  event.notification.close()
  
  // Get the base URL from the current origin
  const baseUrl = self.location.origin
  event.waitUntil(clients.openWindow(baseUrl))
})

