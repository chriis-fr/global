'use client'

import { useState, useEffect } from 'react'
import { subscribeUser, unsubscribeUser, sendNotification } from '@/app/actions/push-notifications'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [browserInfo, setBrowserInfo] = useState<{ name: string; isIOS: boolean; isSafari: boolean } | null>(null)

  useEffect(() => {
    // Check if app is installed (standalone mode)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    // Detect browser
    const userAgent = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !('MSStream' in window)
    
    // Check for Chrome first (even on iOS, Chrome's UA contains "Chrome")
    const isChrome = /chrome/i.test(userAgent) && !/edg/i.test(userAgent)
    const isFirefox = /firefox/i.test(userAgent)
    const isEdge = /edg/i.test(userAgent)
    // Safari detection: must not be Chrome, Firefox, or Edge, and must contain Safari
    const isSafari = !isChrome && !isFirefox && !isEdge && /safari/i.test(userAgent)

    let browserName = 'Unknown'
    if (isChrome) browserName = isIOS ? 'Chrome (iOS)' : 'Chrome'
    else if (isSafari) browserName = isIOS ? 'Safari (iOS)' : 'Safari'
    else if (isFirefox) browserName = isIOS ? 'Firefox (iOS)' : 'Firefox'
    else if (isEdge) browserName = isIOS ? 'Edge (iOS)' : 'Edge'
    else if (isIOS) browserName = 'Browser (iOS)'

    setBrowserInfo({ name: browserName, isIOS, isSafari: isSafari || (isIOS && !isChrome && !isFirefox && !isEdge) })

    // Check support
    const hasServiceWorker = 'serviceWorker' in navigator
    const hasPushManager = 'PushManager' in window
    const hasNotification = 'Notification' in window

    if (hasServiceWorker && hasPushManager && hasNotification) {
      setIsSupported(true)
      // Defer service worker registration to avoid blocking initial render
      setTimeout(() => registerServiceWorker(), 100)
    } else {
      setError('Push notifications are not supported in this browser.')
    }
  }, [])

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      setError('Failed to register service worker. Make sure you are using HTTPS.')
    }
  }

  async function subscribeToPush() {
    setError(null)
    
    // Safari iOS specific check
    if (browserInfo?.isIOS && !isStandalone) {
      setError('On iOS Safari, push notifications only work after installing the app to your home screen. Please install the app first.')
      return
    }

    try {
      // Request notification permission first
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notification permission was denied. Please enable notifications in your browser settings.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setError('VAPID public key is not configured. Please check your environment variables.')
        return
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      })
      setSubscription(sub)
      const serializedSub = JSON.parse(JSON.stringify(sub))
      const result = await subscribeUser(serializedSub)
      
      if (!result.success) {
        setError(result.error || 'Failed to save subscription')
        setSubscription(null)
      }
    } catch (error: unknown) {
      console.error('Subscription failed:', error)
      setError((error as { message?: string })?.message || 'Failed to subscribe. Make sure you are using HTTPS and have granted notification permissions.')
    }
  }

  async function unsubscribeFromPush() {
    setError(null)
    try {
      if (subscription) {
        await subscription.unsubscribe()
      }
      setSubscription(null)
      await unsubscribeUser()
    } catch (error: unknown) {
      console.error('Unsubscription failed:', error)
      setError((error as { message?: string })?.message || 'Failed to unsubscribe')
    }
  }

  async function sendTestNotification() {
    if (subscription && message) {
      setError(null)
      try {
        const result = await sendNotification(message)
        if (result.success) {
          setMessage('')
        } else {
          setError(result.error || 'Failed to send notification')
        }
      } catch (error: unknown) {
        console.error('Failed to send notification:', error)
        setError((error as { message?: string })?.message || 'Failed to send notification')
      }
    } else if (!message) {
      setError('Please enter a message')
    }
  }

  if (!isSupported) {
    return (
      <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Push Notifications</h3>
        <p style={{ color: '#d32f2f' }}>{error || 'Push notifications are not supported in this browser.'}</p>
        {browserInfo && (
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            Browser: {browserInfo.name}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>Push Notifications</h3>
      
      {browserInfo && (
        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
          Browser: {browserInfo.name}
          {isStandalone && ' • App Installed'}
        </p>
      )}

      {browserInfo?.isIOS && !isStandalone && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          <strong>iOS ({browserInfo.name.replace(' (iOS)', '')}):</strong> Push notifications only work after installing the app to your home screen.
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#d32f2f',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {subscription ? (
        <>
          <p style={{ color: '#2e7d32', marginBottom: '1rem' }}>✓ You are subscribed to push notifications.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              onClick={unsubscribeFromPush}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Unsubscribe
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="Enter notification message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTestNotification()}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
              <button 
                onClick={sendTestNotification}
                disabled={!message}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: message ? '#1c398e' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: message ? 'pointer' : 'not-allowed',
                  fontSize: '1rem'
                }}
              >
                Send Test
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p style={{ marginBottom: '1rem' }}>You are not subscribed to push notifications.</p>
          <button 
            onClick={subscribeToPush}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1c398e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Subscribe to Push Notifications
          </button>
        </>
      )}
    </div>
  )
}

