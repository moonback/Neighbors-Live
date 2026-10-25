import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Neighbors Live',
    short_name: 'Neighbors',
    description: 'Ce qui se passe à deux pas de chez vous, filmé par vos voisins.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0d10',
    theme_color: '#0b0d10',
    categories: ['social', 'news', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Filmer',
        short_name: 'Filmer',
        description: 'Filmer ce qui se passe autour de moi',
        url: '/filmer',
        icons: [{ src: '/icons/badge-96.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Carte',
        short_name: 'Carte',
        description: 'Voir les vidéos du quartier sur la carte',
        url: '/carte',
        icons: [{ src: '/icons/badge-96.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  };
}
