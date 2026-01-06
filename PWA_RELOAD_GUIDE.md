# How to Reload/Refresh a PWA

## Quick Methods

### Method 1: Using the Refresh Button (Recommended)
If you've added the `PWARefresh` component to your app, you'll see a refresh button in the bottom-right corner when the app is installed. Tap it to refresh.

### Method 2: Manual Reload by Platform

#### **iOS (Safari/Chrome)**
1. **Pull down from the top** - This works in Safari but may not work in all PWAs
2. **Close and reopen** - Swipe up to close the app, then tap the icon to reopen
3. **Settings method**:
   - Go to Settings → Safari (or Chrome)
   - Clear Website Data for your site
   - Reopen the app

#### **Android (Chrome)**
1. **Pull down from the top** - Works in Chrome-based PWAs
2. **Menu button** - Tap the three dots (⋮) → Reload
3. **Close and reopen** - Swipe away from recent apps, then reopen

#### **Desktop (Chrome/Edge)**
1. **Keyboard shortcut**: `Ctrl+R` (Windows) or `Cmd+R` (Mac)
2. **Hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. **Menu**: Click the three dots → Reload

## Why Pull-to-Refresh Might Not Work

PWAs in standalone mode (installed apps) don't always support pull-to-refresh because:
- They run in a separate window context
- Some browsers disable it for security/UX reasons
- The gesture conflicts with app navigation

## Service Worker Updates

The service worker automatically checks for updates every 5 minutes. When an update is available:
- A notification will appear
- Tap the refresh button to apply the update
- The app will reload automatically

## Force Update Service Worker

To manually force a service worker update:

1. **Open DevTools** (if available):
   - Chrome: `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
   - Look for "Application" tab → Service Workers
   - Click "Update" or "Unregister" then reload

2. **Clear App Data**:
   - iOS: Settings → Safari → Clear History and Website Data
   - Android: Settings → Apps → [Your App] → Storage → Clear Data

3. **Reinstall the App**:
   - Remove from home screen
   - Visit the website again
   - Reinstall the PWA

## Adding Pull-to-Refresh Support

If you want to add pull-to-refresh functionality, you can use libraries like:
- `pulltorefreshjs` - Lightweight pull-to-refresh library
- Custom touch event handlers

However, note that:
- iOS Safari doesn't support pull-to-refresh in standalone mode
- Android Chrome supports it natively
- It's better to use a refresh button for consistency

## Best Practices

1. **Use the refresh button component** - Most reliable across all platforms
2. **Check for updates on app focus** - The service worker checks automatically
3. **Show update notifications** - Let users know when updates are available
4. **Provide manual refresh option** - Always have a way to refresh

## Troubleshooting

**App won't refresh:**
- Clear browser cache
- Unregister service worker in DevTools
- Reinstall the PWA

**Changes not showing:**
- Service worker might be caching old files
- Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
- Check service worker status in DevTools

**Stuck on old version:**
- Unregister service worker
- Clear site data
- Reinstall PWA

