import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import {
  ablageAufraeumen,
  dateiEintragen,
  stromAblegen,
  typVonEndung,
  ZuGross,
} from '../../../../../lib/dateiAblage'
import {
  bildLink,
  istBild,
  MAX_FOTOS,
  FEHLERMELDUNGS_ORDNER,
  fehlermeldungsKoerper,
  fehlermeldungsTitel,
  meldungsKennzeichen,
  repoZerlegen,
  type Umgebung,
} from '../../../../../lib/fehlermeldung'
import { getIntegrations } from '../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Eine Meldung aus dem Büro wird ein Eintrag im Repository.
 *
 * **Wer melden darf: jeder im Büro.** Absichtlich ohne eigene Berechtigung.
 * Eine Hürde vor „hier stimmt was nicht" bekommt man nie wieder weg — gemeldet
 * wird dann nämlich gar nicht mehr, sondern beim nächsten Treffen erzählt.
 *
 * **Das Zugangswort verlässt den Server nicht.** Es steht in den Einstellungen
 * und wird hier eingesetzt; der Browser bekommt es nie zu sehen. Deshalb geht
 * die Meldung diesen Umweg und nicht direkt von der Seite zu GitHub.
 *
 * **Die Reihenfolge ist bewusst so.** Erst liegen die Fotos, dann entsteht der
 * Eintrag mit den Verweisen darauf, und erst danach bekommen die Fotos die
 * Nummer des Eintrags an ihre Bezeichnung. Andersherum ginge es nicht: Der
 * Text braucht die Links, und die Links brauchen die abgelegten Dateien. Geht
 * der letzte Schritt schief, ist das kein Grund zum Scheitern — dann heißt die
 * Datei eben „Meldung (ohne Nummer)", und der Eintrag steht trotzdem.
 */

/** Ein Bildschirmfoto vom Handy ist selten größer; darüber ist es keins mehr. */
const MAX_BYTES = 12 * 1024 * 1024

const fehler = (grund: string, status: number) =>
  NextResponse.json({ error: grund }, { status })

export async function POST(req: Request) {
  let abgelegt: string[] = []
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) return fehler('nicht-erlaubt', 403)

    const { github } = await getIntegrations(payload)
    const repo = repoZerlegen(github.repository)
    if (!github.token || !repo) return fehler('nicht-eingerichtet', 503)

    const formular = await req.formData()
    const titel = String(formular.get('titel') ?? '')
    const text = String(formular.get('text') ?? '')
    const art = String(formular.get('art') ?? '')

    let umgebung: Umgebung = {}
    try {
      umgebung = JSON.parse(String(formular.get('umgebung') ?? '{}')) as Umgebung
    } catch {
      // Eine unlesbare Umgebung ist kein Grund, die Meldung wegzuwerfen
    }

    const konto = user as { name?: string; email?: string; username?: string }
    umgebung.melder = umgebung.melder || konto?.name || konto?.email || konto?.username
    umgebung.zeitpunkt = umgebung.zeitpunkt || new Date().toLocaleString('de-DE')
    if (!umgebung.fassung && process.env.APP_VERSION) {
      umgebung.fassung = process.env.APP_VERSION.slice(0, 7)
    }

    if (!titel.trim() && !text.trim()) return fehler('leer', 400)

    // ── Die Fotos zuerst ─────────────────────────────────────────────────────
    const fotos = formular.getAll('fotos').filter((f): f is File => f instanceof File)
    if (fotos.length > MAX_FOTOS) return fehler('zu-viele-fotos', 400)

    const links: string[] = []
    const dateien: (number | string)[] = []
    for (const foto of fotos) {
      /*
       * Geprüft wird die Endung und **nicht** der gemeldete Typ — genau den
       * setzt `dateiEintragen` später auch. Nähme man hier den gemeldeten,
       * liefen Annahme und Ablage auseinander: Eine als Bild gemeldete PDF
       * käme herein und würde als PDF abgelegt, und die Ausgabestelle wiese
       * sie ab. Ein Foto, das im Eintrag nicht zu sehen ist, ist schlimmer
       * als eines, das gar nicht erst angenommen wird.
       */
      if (!istBild(typVonEndung(foto.name))) return fehler('kein-bild', 400)
      const { datei, bytes } = await stromAblegen(foto.stream(), foto.name, MAX_BYTES)
      abgelegt.push(datei)
      const { id } = await dateiEintragen(payload, datei, bytes, foto.name, {
        folder: FEHLERMELDUNGS_ORDNER,
        herkunft: 'haus',
        freigabe: false,
        note: 'Foto einer Meldung aus dem Büro.',
      })
      // Eingetragen heißt: Das Aufräumen erledigt jetzt der Datensatz mit
      abgelegt = abgelegt.filter((d) => d !== datei)
      dateien.push(id)
      links.push(bildLink(id))
    }

    // ── Dann der Eintrag ─────────────────────────────────────────────────────
    const antwort = await fetch(
      `https://api.github.com/repos/${repo.besitzer}/${repo.name}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${github.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: fehlermeldungsTitel(titel, umgebung.seite),
          body: fehlermeldungsKoerper({ text, umgebung, bilder: links }),
        }),
      },
    )

    if (!antwort.ok) {
      const grund = await antwort.text().catch(() => '')
      console.error('Meldung an GitHub fehlgeschlagen:', antwort.status, grund.slice(0, 400))
      /*
       * Die Fotos bleiben liegen. Sie wieder wegzuräumen wäre der aufgeräumte
       * Weg und der falsche: Wer gleich noch einmal auf Senden drückt, lädt
       * sie sonst ein zweites Mal hoch — und wenn es am Zugangswort lag, ist
       * das Bild nach dem Ausbessern noch da.
       */
      return fehler(antwort.status === 401 || antwort.status === 403 ? 'zugang' : 'github', 502)
    }

    const eintrag = (await antwort.json()) as { number?: number; html_url?: string }

    /*
     * ── Die Kennzeichen, und zwar erst jetzt ─────────────────────────────────
     *
     * Sie gehören ausdrücklich **nicht** in den Aufruf oben. Ein Kennzeichen,
     * das es im Repository noch nicht gibt, ist ein Fall, der beim Anlegen
     * schiefgehen könnte — und dann wäre die Meldung weg, obwohl an ihr
     * nichts fehlte. Hier kostet ein Fehlschlag nur die Sortierhilfe: Der
     * Eintrag steht schon, mit Text, Umgebung und Fotos.
     *
     * Vermerkt wird er trotzdem im Protokoll. Fehlen die Kennzeichen dauerhaft,
     * will man das wissen — sie sind der Grund, warum die Liste sortierbar ist.
     */
    if (eintrag.number) {
      await fetch(
        `https://api.github.com/repos/${repo.besitzer}/${repo.name}/issues/${eintrag.number}/labels`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${github.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ labels: meldungsKennzeichen(art, umgebung.fassung) }),
        },
      )
        .then((r) => {
          if (!r.ok) console.warn('Kennzeichen der Meldung nicht gesetzt:', r.status)
        })
        .catch((err) => console.warn('Kennzeichen der Meldung nicht gesetzt:', err))
    }

    // ── Zuletzt die Nummer an die Fotos ──────────────────────────────────────
    for (const [i, id] of dateien.entries()) {
      await payload
        .update({
          collection: 'product-files',
          id,
          overrideAccess: true,
          data: {
            label: `Meldung #${eintrag.number} — Foto ${i + 1}`,
            note: `Gehört zu ${eintrag.html_url}`,
          },
        })
        .catch(() => undefined)
    }

    return NextResponse.json({ ok: true, nummer: eintrag.number, url: eintrag.html_url })
  } catch (err) {
    for (const datei of abgelegt) await ablageAufraeumen(datei)
    if (err instanceof ZuGross) return fehler('zu-gross', 413)
    console.error('Meldung anlegen fehlgeschlagen:', err)
    return fehler('fehlgeschlagen', 500)
  }
}
