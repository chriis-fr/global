import type { MetadataRoute } from 'next'

// Static manifest to reduce compilation overhead
export const metadata: MetadataRoute.Manifest = {
  name: 'Chains ERP - Global Finance',
  short_name: 'Global Finance',
  description: 'Global Finance',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#1c398e',
  icons: [
    {
      src: '/chains.PNG',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/chains.PNG',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
  ],
}

export default function manifest(): MetadataRoute.Manifest {
  return metadata
}

