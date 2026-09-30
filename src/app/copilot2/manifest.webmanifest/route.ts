// Web app manifest scoped to /copilot2 so the four-tab layout installs as its
// own home-screen app beside the original. Same account, same data. The icons
// are the calm shell's, because this is the calm theme.
//
// Two ways in that skip the app's front door:
//   share_target  Copilot in the phone's share sheet. A budget app's "Export
//                 CSV → Share" lands the file on the Money tab, imported, with
//                 no download and no file picker. public/sw.js takes the POST
//                 (share/route.ts is the server's fallback when it has not).
//   shortcuts     long-press the icon → Log money: its own light page
//                 (/copilot2/log), the keypad in the first HTML.
// An installed app picks either up when Chrome next refreshes it — reinstalling
// from the browser is the immediate way.
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
    share_target: {
      action: '/copilot2/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        // Broad on purpose: budget apps label a CSV text/csv, text/plain,
        // text/comma-separated-values or application/octet-stream, and a type
        // missing here is Copilot missing from the share sheet with no error
        // anywhere. The import says plainly when a file is not a statement.
        files: [{
          name: 'file',
          accept: ['text/*', '.csv', '.ofx', '.qfx', '.pdf', 'application/pdf', 'application/octet-stream', 'application/vnd.ms-excel', 'application/x-ofx', 'image/*'],
        }],
      },
    },
    shortcuts: [
      { name: 'Log money', short_name: 'Log money', description: 'Log a move in your money book', url: '/copilot2/log', icons: [{ src: '/lifeos/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
}
