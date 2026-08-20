// Erzeugt die Icons der öffentlichen Website.
//
// Dieselbe Handschrift wie Admin und Büro: das VH-Monogramm als Strichzug mit
// dem Corten-Strich darunter. Gezeichnet und nicht gesetzt — ein Font müsste
// mitgeliefert werden und sähe je nach System anders aus.
//
// Aufruf: node scripts/generate-site-icons.mjs
import fs from 'fs'
import sharp from 'sharp'

const GRUND = '#191919'
const CORTEN = '#a5622d'

/**
 * Das Zeichen als SVG — in zwei Zuschnitten.
 *
 * **Warum zwei.** Der Zuschnitt von Admin und Büro ist für 192 Pixel und
 * größer gezeichnet: Strichstärke 30 von 512. Bei 16 Pixeln im Browsertab
 * sind das 0,94 Pixel — der Browser verteilt sie auf zwei Reihen, und aus
 * dem Monogramm wird ein grauer Fleck. Nachgesehen, nicht vermutet: der
 * erste Wurf war bei 32 Pixeln brauchbar und bei 16 unlesbar.
 *
 * `kompakt` zeichnet deshalb größer und kräftiger. Alle Maße sind Vielfache
 * von 32, und das ist der eigentliche Kniff: 512 ÷ 16 = 32, also fällt bei
 * 16 Pixeln jede Kante genau auf eine Pixelgrenze und jeder Strich wird
 * 64 ÷ 32 = 2 Pixel breit — voll deckend statt halb. Mit krummen Werten
 * verteilt der Browser jeden Strich auf zwei Reihen und färbt beide grau;
 * genau daran krankte der zweite Wurf noch. Der Corten-Strich fällt hier weg:
 * 10 von 512 sind bei 16 Pixeln 0,3 Pixel, also kein Strich mehr, sondern
 * eine schmutzige Zeile. Das ist keine Nachlässigkeit, sondern der übliche
 * Weg — ein Zeichen wird für die Größe gezeichnet, in der es steht.
 *
 * `polster` schafft die Sicherheitszone für Android und iOS, die runde und
 * abgerundete Masken über das Icon legen — ohne sie schneidet die Maske dem
 * V die Spitze ab.
 */
const zeichen = (groesse, polster = 0, kompakt = false) => {
  const s = 512
  const striche = kompakt
    ? `<g stroke="#ffffff" stroke-width="64" fill="none" stroke-linecap="square">
    <polyline points="64,128 160,352 256,128"/>
    <line x1="320" y1="128" x2="320" y2="352"/>
    <line x1="448" y1="128" x2="448" y2="352"/>
    <line x1="320" y1="224" x2="448" y2="224"/>
  </g>`
    : `<g stroke="#ffffff" stroke-width="30" fill="none" stroke-linecap="square">
    <polyline points="140,175 197,330 254,175"/>
    <line x1="300" y1="175" x2="300" y2="330"/>
    <line x1="382" y1="175" x2="382" y2="330"/>
    <line x1="300" y1="252" x2="382" y2="252"/>
  </g>
  <rect x="140" y="368" width="257" height="10" rx="5" fill="url(#corten)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}" viewBox="${-polster} ${-polster} ${s + 2 * polster} ${s + 2 * polster}">
  <defs>
    <linearGradient id="corten" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${CORTEN}"/>
      <stop offset="0.4" stop-color="${CORTEN}"/>
      <stop offset="1" stop-color="${CORTEN}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="${-polster}" y="${-polster}" width="${s + 2 * polster}" height="${s + 2 * polster}" fill="${GRUND}"/>
  ${striche}
</svg>`
}

const ziel = (name) => new URL(`../public/${name}`, import.meta.url).pathname

/**
 * Mehrere PNG in eine .ico packen.
 *
 * Warum überhaupt noch eine `.ico`: Browser fragen `/favicon.ico` an der
 * Wurzel an, auch wenn im Markup etwas anderes steht — und alles, was kein
 * Browser ist (Feedleser, Vorschaudienste, Suchmaschinen), sucht oft nur
 * dort. Eingebettet sind PNG-Bilder; das versteht jedes System seit Vista.
 *
 * Aufbau: 6 Byte Kopf, dann je Bild 16 Byte Verzeichniseintrag, dann die
 * Bilddaten am Stück.
 */
function icoPacken(bilder) {
  const kopf = Buffer.alloc(6)
  kopf.writeUInt16LE(0, 0) // reserviert
  kopf.writeUInt16LE(1, 2) // 1 = Icon
  kopf.writeUInt16LE(bilder.length, 4)

  let versatz = 6 + bilder.length * 16
  const eintraege = bilder.map(({ groesse, daten }) => {
    const e = Buffer.alloc(16)
    // 0 bedeutet 256 — mehr passt in ein Byte nicht
    e.writeUInt8(groesse >= 256 ? 0 : groesse, 0)
    e.writeUInt8(groesse >= 256 ? 0 : groesse, 1)
    e.writeUInt8(0, 2) // keine Farbtabelle
    e.writeUInt8(0, 3) // reserviert
    e.writeUInt16LE(1, 4) // Ebenen
    e.writeUInt16LE(32, 6) // Bit je Bildpunkt
    e.writeUInt32LE(daten.length, 8)
    e.writeUInt32LE(versatz, 12)
    versatz += daten.length
    return e
  })

  return Buffer.concat([kopf, ...eintraege, ...bilder.map((b) => b.daten)])
}

const png = (groesse, polster = 0, kompakt = false) =>
  sharp(Buffer.from(zeichen(groesse, polster, kompakt))).resize(groesse, groesse).png().toBuffer()

/*
 * Das SVG bekommt den kompakten Zuschnitt.
 *
 * Aktuelle Browser bevorzugen es vor jedem PNG — und stellen es im Tab mit
 * 16 Pixeln dar. Der großzügige Zuschnitt wäre dort genau das, was er bei
 * 16 Pixeln immer ist: ein grauer Fleck.
 */
fs.writeFileSync(ziel('site-icon.svg'), zeichen(512, 0, true))
fs.writeFileSync(ziel('site-icon-32.png'), await png(32, 0, true))

// Fürs iPhone auf dem Startbildschirm: groß genug für den Corten-Strich,
// mit Sicherheitszone, weil iOS die Ecken rundet
fs.writeFileSync(ziel('apple-touch-icon.png'), await png(180, 40))

// Die .ico trägt drei Größen: 16 fürs Tab, 32 für die Lesezeichenleiste,
// 48 für die Verknüpfung auf dem Schreibtisch — alle kompakt
fs.writeFileSync(
  ziel('favicon.ico'),
  icoPacken([
    { groesse: 16, daten: await png(16, 0, true) },
    { groesse: 32, daten: await png(32, 0, true) },
    { groesse: 48, daten: await png(48, 0, true) },
  ]),
)

console.log('Website-Icons erzeugt: public/favicon.ico, site-icon.svg, site-icon-32.png, apple-touch-icon.png')
