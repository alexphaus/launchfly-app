// Web app manifest scoped to /copilot so it installs as its own app.
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    name: 'Copilot',
    short_name: 'Copilot',
    description: 'Your opportunity engine. Daily leverage plan, ranked matches, and the skills that unlock more of them.',
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
