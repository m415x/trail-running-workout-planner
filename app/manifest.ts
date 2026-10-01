import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'El Parque Team',
    short_name: 'EPT',
    description: 'Planificación, seguimiento y gestión de entrenamiento de trail running para equipos y atletas.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    categories: ['sports', 'fitness'],
    background_color: '#fafcfe',
    theme_color: '#f76215',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
