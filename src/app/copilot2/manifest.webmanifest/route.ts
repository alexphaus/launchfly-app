// Web app manifest scoped to /copilot2 so the four-tab layout installs as its
// own home-screen app beside the original. Same account, same data. The icons
// are the calm shell's, because this is the calm theme.
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    name: 'Copilot',
    short_name: 'Copilot',
    description: 'Today’s call with the work already done, the matches found overnight, the business you are building, and the honest numbers on how it is going.',
    id: '/copilot2',
    start_url: '/copilot2',
    scope: '/copilot2',
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
