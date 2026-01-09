# PWA Icon Setup

## Current Status

The PWA manifest is currently using `/chains.PNG` for both 192x192 and 512x512 icon sizes. This will work, but for best results, you should create properly sized icons.

## Recommended Icon Sizes

For a complete PWA icon set, create the following sizes:

- **icon-192x192.png** - 192x192 pixels (required)
- **icon-512x512.png** - 512x512 pixels (required)
- **icon-144x144.png** - 144x144 pixels (optional, for older Android)
- **icon-384x384.png** - 384x384 pixels (optional)
- **apple-touch-icon.png** - 180x180 pixels (for iOS)

## Creating Icons

You can use tools like:
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

## After Creating Icons

Update `src/app/manifest.ts` to use the new icon paths:

```typescript
icons: [
  {
    src: '/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: '/icon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
],
```

Also update `src/app/layout.tsx` to reference the new icons in the metadata.

