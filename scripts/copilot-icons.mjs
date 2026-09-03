// Regenerates /public/copilot icons. Run: node scripts/copilot-icons.mjs
import sharp from 'sharp';
// Bold mark: cream tile, ink border, blue block + ink "C" bar. Maskable safe zone respected (content inside central 80%).
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FAF8F4"/>
  <rect x="92" y="92" width="328" height="328" rx="44" fill="#FFFFFF" stroke="#111111" stroke-width="22"/>
  <rect x="164" y="164" width="88" height="88" fill="#2B3EF0"/>
  <rect x="164" y="276" width="184" height="72" fill="#111111"/>
  <rect x="276" y="164" width="72" height="88" fill="#111111"/>
</svg>`;
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(`public/copilot/icon-${size}.png`);
}
await sharp(Buffer.from(svg(180))).resize(180, 180).png().toFile('public/copilot/apple-touch-icon.png');
console.log('icons written');
