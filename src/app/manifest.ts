import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Launchfly Swarm',
        short_name: 'Launchfly',
        description: 'Autonomous Agent Orchestrator',
        start_url: '/command',
        display: 'standalone',
        background_color: '#0a0a08',
        theme_color: '#f97316',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            },
        ],
    };
}
