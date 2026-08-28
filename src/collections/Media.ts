import type { Access, CollectionConfig } from 'payload'

import { admins } from '../access'
import { liveHooks } from '../lib/liveHooks'

/**
 * Wer die Mediathek lesen darf.
 *
 * Bisher stand hier `anyone` — und das war zweimal zu großzügig.
 *
 * **Die Bilddateien selbst: ja, aber nur die im Ordner.** Payload liefert sie
 * unter `/api/media/file/<name>` aus, und das muss es auch: Die Website lebt
 * von ihren Bildern, Google Shopping holt sie dort ab. Der Name wird dabei
 * aber nur gegen `..` geprüft, nicht gegen einen Schrägstrich — und die
 * Werkstattdateien liegen als Unterordner **in** diesem Ordner. Mit einem
 * kodierten Schrägstrich (`werkstattdateien%2F…`) gab die öffentliche
 * Bildadresse deshalb Laserdateien und Zeichnungen heraus, ohne Anmeldung.
 * Bemerkt bei Dominiks Frage (08/2026), ob die Dateien nicht besser auf eine
 * eigene Route gehörten. Ein Dateiname aus dieser Sammlung hat nie einen
 * Schrägstrich; wer einen mitschickt, will aus dem Ordner heraus.
 *
 * **Die Liste: nein.** `/api/media` gab ohne Anmeldung jeden Datensatz
 * heraus — mit Dateinamen, Alternativtext und allem. In der Mediathek liegen
 * aber nicht nur Produktfotos: auch Belegscans, Wareneingänge und das, was
 * Kundschaft an eine Anfrage hängt. Damit waren sie nicht bloß erratbar,
 * sondern der Reihe nach abzählbar. Die Website braucht diese Liste nicht —
 * sie wird auf dem Server gebaut und geht dabei an der Zugriffsprüfung
 * vorbei; im Browser fragt sie niemand ab.
 *
 * Das ist die Absicherung, nicht die Lösung: Ein Beleg gehört nicht in eine
 * Sammlung, deren Dateien öffentlich ausgeliefert werden. Solange er es doch
 * tut, ist er wenigstens nicht mehr aufzählbar. Siehe HANDOVER.md.
 */
const mediathekLesen: Access = ({ data, isReadingStaticFile, req: { user } }) => {
  if (isReadingStaticFile) {
    const name = String(data?.filename ?? '')
    if (/[\\/]/.test(name)) return false
    if (user) return true
    /*
     * Unangemeldete bekommen PDFs nie (die Website braucht öffentlich
     * keine einzige — was als PDF liegt, sind Rechnungen und Belege) und
     * alles andere nur ohne intern-Kennzeichen. Das Kennzeichen steht als
     * **Bedingung** hier, nicht als `data.intern`-Abfrage: Payload reicht
     * der Prüfung bei statischen Dateien nur `{ filename }` herein
     * (nachgelesen in checkFileAccess.js und am Container nachgemessen —
     * ein Feldvergleich wäre still immer wahr gewesen). Eine
     * zurückgegebene Bedingung dagegen läuft in die Datensatz-Suche: kein
     * Treffer, keine Datei.
     */
    if (name.toLowerCase().endsWith('.pdf')) return false
    return { intern: { not_equals: true } }
  }
  return Boolean(user)
}

export const Media: CollectionConfig = {
  slug: 'media',
  // Weggeworfenes bleibt liegen, bis es jemand von Hand endgültig löscht — siehe lib/wegwerfen.ts
  trash: true,
  labels: {
    singular: 'Medien',
    plural: 'Medien',
  },
  admin: {
    group: 'Verwaltung',
  },
  // Offene Büro-Seiten über Änderungen unterrichten
  hooks: liveHooks('medien'),
  access: {
    read: mediathekLesen,
    create: admins,
    update: admins,
    delete: admins,
  },
  upload: {
    staticDir: 'media',
    /*
     * `application/pdf` steht hier für die Belege. Der Hand-Upload
     * (`beleg-upload`-Route) und das Eingabefeld im Büro erlaubten PDF von
     * Anfang an, die Sammlung lehnte es aber ab — Rechnungs-PDFs ließen
     * sich deshalb weder von Hand hochladen noch vom Beleg-Automaten
     * ablegen (`Invalid MIME type: application/pdf`, gefunden 08/2026).
     * Die Dateien werden wie alle hier öffentlich per Namen ausgeliefert;
     * dass Belege eigentlich nicht in diese Sammlung gehören, steht oben
     * und in HANDOVER.md.
     */
    mimeTypes: ['image/*', 'video/mp4', 'video/webm', 'application/pdf'],
    /**
     * Fünf Stufen statt drei, und alle als WebP.
     *
     * Vorher lud ein Handy dieselbe 900-Pixel-Datei wie ein Rechner, und auf
     * einem großen Bildschirm wurde eine 1800er auf 2600 Pixel hochgezogen —
     * bei einer Werkstatt, die von ihren Bildern lebt, ist beides ärgerlich.
     * Mit der Staffelung sucht sich der Browser über `srcset` die passende
     * Größe selbst.
     *
     * Die Originaldatei bleibt unangetastet: Sie ist das Archiv, und wer sie
     * herunterlädt, soll das Original bekommen.
     */
    imageSizes: [
      {
        name: 'klein',
        width: 320,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
      {
        name: 'thumbnail',
        width: 480,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'card',
        width: 900,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'large',
        width: 1800,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'xl',
        width: 2600,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alternativtext',
      type: 'text',
      localized: true,
    },
    {
      /*
       * Die Trennlinie durch die Mediathek: Was die Website zeigt, bleibt
       * öffentlich per Namen abrufbar (davon lebt sie — Google Shopping
       * holt die Bilder dort ab). Alles andere — Belege, Lieferscheine,
       * Übergabefotos, Kundenanhänge — trägt dieses Kennzeichen und wird
       * nur an Angemeldete ausgeliefert. Gesetzt wird es von den
       * Upload-Wegen des Büros; im Admin lässt es sich nachziehen.
       */
      name: 'intern',
      label: 'Intern — nur mit Anmeldung abrufbar',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Belege, Lieferscheine und andere Unterlagen des Betriebs. Ohne Häkchen ist die Datei öffentlich abrufbar, wie es Produktbilder sein müssen.',
      },
    },
  ],
}
