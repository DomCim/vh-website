// Erzeugt die App-Icons für das installierbare Büro (PWA):
// helles Icon mit "VH" und Corten-Strich — bewusst anders als der dunkle
// Admin, damit die beiden Apps auf dem Home-Bildschirm unterscheidbar sind.
// Aufruf: node scripts/generate-office-icons.mjs
import sharp from 'sharp'

const svg = (size, padding = 0) => {
  const s = 512
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-padding} ${-padding} ${s + 2 * padding} ${s + 2 * padding}">
  <defs>
    <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a5622d"/>
      <stop offset="0.4" stop-color="#a5622d"/>
      <stop offset="1" stop-color="#a5622d" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="${-padding}" y="${-padding}" width="${s + 2 * padding}" height="${s + 2 * padding}" fill="#f7f6f4"/>
  <g stroke="#1d1d1f" stroke-width="30" fill="none" stroke-linecap="square">
    <polyline points="140,150 197,305 254,150"/>
    <line x1="300" y1="150" x2="300" y2="305"/>
    <line x1="382" y1="150" x2="382" y2="305"/>
    <line x1="300" y1="227" x2="382" y2="227"/>
  </g>
  <rect x="140" y="343" width="257" height="10" rx="5" fill="url(#bronze)"/>
  <text x="256" y="425" font-family="Helvetica,Arial,sans-serif" font-size="58"
        font-weight="600" letter-spacing="10" text-anchor="middle" fill="#6b6b70">BÜRO</text>
</svg>`
}

const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname

await sharp(Buffer.from(svg(512))).png().toFile(out('office-icon-512.png'))
await sharp(Buffer.from(svg(192))).png().toFile(out('office-icon-192.png'))
await sharp(Buffer.from(svg(512, 80))).resize(512, 512).png().toFile(out('office-icon-maskable-512.png'))
await sharp(Buffer.from(svg(180, 40))).resize(180, 180).png().toFile(out('office-icon-180.png'))

console.log('Büro-Icons erzeugt: public/office-icon-*.png')
