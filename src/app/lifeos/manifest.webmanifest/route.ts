// Web app manifest scoped to /lifeos so the calm shell installs as its own app
// beside Copilot. Same account, same data — a second home-screen icon exists
// only so both can be lived with for a week and one of them chosen.
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    name: 'Life OS',
    short_name: 'Life OS',
    description: 'Real businesses that fit what you sell, an opener drafted for each, and what the market keeps asking for.',
    id: '/lifeos',
    start_url: '/lifeos',
    scope: '/lifeos',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EEF1F7',
    theme_color: '#EEF1F7',
    icons: [
      { src: '/lifeos/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/lifeos/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/lifeos/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
}
