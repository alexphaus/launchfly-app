import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: 'launchfly-app',
        name: 'Launchfly Command Center',
        short_name: 'Launchfly',
        description: 'The WhatsApp OS for Service Professionals',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a08',
        theme_color: '#0a0a08',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    };
}
