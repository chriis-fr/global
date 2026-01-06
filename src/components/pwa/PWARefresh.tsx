'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export function PWARefresh() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Check if app is installed (standalone mode)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        setUpdateAvailable(false)
        window.location.reload()
      })

      // Check for updates periodically
      const checkForUpdates = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            await registration.update()
            
            // Check if there's a waiting service worker
            if (registration.waiting) {
              setUpdateAvailable(true)
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error)
        }
      }

      // Check immediately and then every 5 minutes
      checkForUpdates()
      const interval = setInterval(checkForUpdates, 5 * 60 * 1000)

      return () => clearInterval(interval)
    }
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        
        if (registration?.waiting) {
          // Tell the waiting service worker to skip waiting and activate
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          // Force reload
          window.location.reload()
        }
      } else {
        // Fallback: regular reload
        window.location.reload()
      }
    } catch (error) {
      console.error('Error refreshing:', error)
      // Fallback: regular reload
      window.location.reload()
    }
  }

  // Only show in standalone mode (installed PWA)
  if (!isStandalone) {
    return null
  }

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      alignItems: 'flex-end'
    }}>
      {updateAvailable && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#1c398e',
          color: 'white',
          borderRadius: '8px',
          fontSize: '0.875rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '0.5rem'
        }}>
          Update available! Tap to refresh.
        </div>
      )}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        style={{
          padding: '0.75rem',
          backgroundColor: isRefreshing ? '#ccc' : '#1c398e',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s',
        }}
        onMouseDown={(e) => {
          if (!isRefreshing) {
            e.currentTarget.style.transform = 'scale(0.95)'
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Refresh App"
      >
        <RefreshCw 
          size={20} 
          className={isRefreshing ? 'animate-spin' : ''}
        />
      </button>
    </div>
  )
}

