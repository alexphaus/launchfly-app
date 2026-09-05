// A stand-in for your real supply agent. Zero dependencies.
//
//   node scripts/copilot-mock-supply.mjs 4010 dev-secret
//   COPILOT_SUPPLY_URL=http://localhost:4010 COPILOT_SUPPLY_SECRET=dev-secret npm run dev
//
// Use it to prove the seam works end to end before pointing COPILOT_SUPPLY_URL
// at n8n, and to see exactly what the app sends. It echoes each request to
// stdout and returns candidates shaped like the real contract — including two
// deliberately malformed rows, so you can watch the app drop them.

import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 4010);
const secret = process.argv[3] ?? process.env.COPILOT_SUPPLY_SECRET ?? '';

const server = createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });

  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      console.log('✗ rejected: bad or missing bearer');
      return send(401, { error: 'unauthorized' });
    }
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: 'bad json' }); }

    const p = body.profile ?? {};
    console.log('\n─── discover ───────────────────────────────');
    console.log('limit         :', body.limit);
    console.log('offer.sells   :', p.offer?.sells ?? '(none)');
    console.log('offer.for_who :', p.offer?.for_who ?? '(none)');
    console.log('segments      :', (p.target_segments ?? []).join(', ') || '(none)');
    console.log('area          :', p.target_area ?? p.location ?? '(none)');

    const who = p.offer?.for_who || p.target_segments?.[0] || 'small businesses';
    const area = p.target_area || p.location || 'your area';

    send(200, {
      candidates: [
        {
          external_id: `mock:${Date.now()}:1`,          // stable per row in a real source
          title: `Sample ${who} lead in ${area}`,
          summary: `Mock candidate proving the seam. In your real agent this is a factual line about why this one is worth a message — not adjectives.`,
          type: 'client',
          url: 'https://example.com/listing/1',
          contact: { name: 'Sample Contact', phone: '0917 123 4567' },   // "phone" is accepted and normalised
          effort: 'medium',
          data: { note: 'anything here reaches the agent verbatim' },
        },
        {
          external_id: 'mock:community:1',
          title: `${who} owners group`,
          summary: 'A community candidate — no contact, so the app will not offer a draft, only the link.',
          type: 'community',
          url: 'https://example.com/group',
          value_label: 'Join',
          effort: 'light',
        },
        { title: 'Dropped: no external_id' },
        { external_id: 'mock:no-title' },
      ],
    });
  });
});

server.listen(port, () => {
  console.log(`mock supply agent on http://localhost:${port}`);
  console.log(secret ? `expecting: Authorization: Bearer ${secret}` : 'no secret set — auth check disabled');
});
