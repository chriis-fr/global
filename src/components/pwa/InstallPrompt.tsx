'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Check if already installed
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase()
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const isAndroid = /android/.test(userAgent)

    if (isIOS) {
      setPlatform('ios')
    } else if (isAndroid) {
      setPlatform('android')
    } else {
      setPlatform('desktop')
    }

    // Listen for the beforeinstallprompt event (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log(`User response to install prompt: ${outcome}`)
      setDeferredPrompt(null)
    }
  }

  if (isStandalone) {
    return null // Don't show install button if already installed
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3>Install App</h3>
      
      {platform === 'ios' && (
        <div>
          <p>
            To install this app on your iOS device:
          </p>
          <ol style={{ marginLeft: '1.5rem' }}>
            <li>Tap the share button <span role="img" aria-label="share icon">⎋</span> in Safari</li>
            <li>Scroll down and tap &quot;Add to Home Screen&quot; <span role="img" aria-label="plus icon">➕</span></li>
            <li>Tap &quot;Add&quot; to confirm</li>
          </ol>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            <strong>Note:</strong> Push notifications on iOS only work after installing the app to your home screen.
          </p>
        </div>
      )}

      {platform === 'android' && (
        <div>
          {deferredPrompt ? (
            <>
              <p>Install this app on your Android device for a better experience.</p>
              <button 
                onClick={handleInstallClick}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#1c398e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  marginTop: '0.5rem'
                }}
              >
                Install App
              </button>
            </>
          ) : (
            <div>
              <p>To install this app on your Android device:</p>
              <ol style={{ marginLeft: '1.5rem' }}>
                <li>Tap the menu button (three dots) in Chrome</li>
                <li>Select &quot;Add to Home screen&quot; or &quot;Install app&quot;</li>
                <li>Tap &quot;Install&quot; to confirm</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {platform === 'desktop' && (
        <div>
          <p>To install this app:</p>
          {deferredPrompt ? (
            <button 
              onClick={handleInstallClick}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#1c398e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                marginTop: '0.5rem'
              }}
            >
              Install App
            </button>
          ) : (
            <ul style={{ marginLeft: '1.5rem' }}>
              <li><strong>Chrome/Edge:</strong> Look for the install icon in the address bar</li>
              <li><strong>Safari (macOS):</strong> File → Add to Dock (for macOS)</li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

