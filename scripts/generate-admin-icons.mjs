// Erzeugt die App-Icons für den installierbaren Admin (PWA):
// dunkles Icon mit geometrischem "VH"-Monogramm und Corten-Strich.
// Aufruf: node scripts/generate-admin-icons.mjs
import sharp from 'sharp'

// Buchstaben als Strichzüge (kein Font nötig — rendert überall gleich)
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
  <rect x="${-padding}" y="${-padding}" width="${s + 2 * padding}" height="${s + 2 * padding}" fill="#191919"/>
  <g stroke="#ffffff" stroke-width="30" fill="none" stroke-linecap="square">
    <!-- V -->
    <polyline points="140,175 197,330 254,175"/>
    <!-- H -->
    <line x1="300" y1="175" x2="300" y2="330"/>
    <line x1="382" y1="175" x2="382" y2="330"/>
    <line x1="300" y1="252" x2="382" y2="252"/>
  </g>
  <rect x="140" y="368" width="257" height="10" rx="5" fill="url(#bronze)"/>
</svg>`
}

const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname

// Standard-Icons (voller Ausschnitt) + maskable (mit Sicherheitszone) + Apple-Touch
await sharp(Buffer.from(svg(512))).png().toFile(out('admin-icon-512.png'))
await sharp(Buffer.from(svg(192))).png().toFile(out('admin-icon-192.png'))
await sharp(Buffer.from(svg(512, 80))).resize(512, 512).png().toFile(out('admin-icon-maskable-512.png'))
await sharp(Buffer.from(svg(180, 40))).resize(180, 180).png().toFile(out('admin-icon-180.png'))

console.log('Admin-Icons erzeugt: public/admin-icon-*.png')
