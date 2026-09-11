// Web app manifest scoped to /copilot so it installs as its own app.
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    name: 'Copilot',
    short_name: 'Copilot',
    description: 'One thing to do each morning, with the work already done, and the honest number on whether it was the right call.',
    id: '/copilot',
    start_url: '/copilot',
    scope: '/copilot',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F4',
    theme_color: '#FAF8F4',
    icons: [
      { src: '/copilot/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/copilot/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/copilot/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
}
