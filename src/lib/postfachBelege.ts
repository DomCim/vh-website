import type { Payload } from 'payload'

import { belegEntwurf } from './belegEntwurf'
import { belegAusPdf } from './facturxLesen'
import { belegAuslesen, kiZugang } from './ki'
import { anhangLaden, nachrichtenListe, nachrichtLesen, postfaecher } from './postfach'
import { benachrichtige } from './push'

/**
 * Rechnungen aus dem Postfach als Beleg-Entwürfe.
 *
 * Auf info@ schlagen Rechnungen von Amazon, Lieferanten und Dienstleistern
 * auf — bisher hieß das: Anhang herunterladen, im Büro hochladen, auslesen
 * lassen. Diesen Weg geht jetzt der Takt von selbst: Neue Mails **mit
 * PDF-Anhang** werden ausgelesen (erst Factur-X, das ist exakt und kostet
 * nichts; sonst die KI) und landen als Entwurf in den Belegen — markiert
 * „ungeprüft", gebucht wird erst nach Vincents Bestätigung.
 *
 * Drei Regeln, alle auf Dominiks Wort:
 *
 * **Die Mail bleibt ungelesen.** Das Postfach ist die Wahrheit über „habe
 * ich gesehen"; ein Automat hat daran nichts zu verstellen. Das Lesen über
 * IMAP fasst die Flags nicht an.
 *
 * **Ein Fehl-Entwurf wird weggeworfen, fertig.** Die Kennung aus Message-ID
 * und Dateiname steht am Beleg und wird samt Papierkorb geprüft — derselbe
 * Anhang ersteht nicht wieder auf, auch wenn die Mail ungelesen liegen
 * bleibt.
 *
 * **Ohne Betrag kein Entwurf** (siehe belegEntwurf.ts): Zeichnungen und
 * Werbe-PDFs sollen keine Belegruinen hinterlassen.
 *
 * Der UID-Merker je Postfach sorgt dafür, dass jede Mail nur einmal
 * angesehen wird — auch die, aus denen kein Beleg wurde. KI-Kosten fallen
 * also je Anhang genau einmal an, nicht je Takt.
 */

/*
 * `postbeleg3`, nicht `postbeleg`: Jede Nummer ist ein einmaliger Neuanlauf
 * über die letzten 30 Mails. Die 2 kam, weil der allererste Lauf (08/2026)
 * den Ungelesen-Fehler hatte und über seine Gründe schwieg; die 3, weil der
 * zweite Lauf ohne Anthropic-Schlüssel lief — er konnte nur Factur-X lesen,
 * rückte den Merker aber trotzdem vor, und die Amazon-Rechnung galt fortan
 * als angesehen, obwohl nie eine KI sie gesehen hatte. Vor Doppel-Anlage
 * schützt ohnehin die Kennung am Beleg, nicht der Merker.
 */
const MERKER = (fachId: string | number) => `postbeleg3-${fachId}`
const MAX_ANHAENGE_JE_MAIL = 3
const MAX_PDF_BYTES = 15 * 1024 * 1024

async function merkerLesen(payload: Payload, schluessel: string): Promise<number> {
  const { docs } = await payload.find({
    collection: 'counters',
    where: { key: { equals: schluessel } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return Number(docs[0]?.lastNumber) || 0
}

async function merkerSchreiben(payload: Payload, schluessel: string, wert: number): Promise<void> {
  const { docs } = await payload.find({
    collection: 'counters',
    where: { key: { equals: schluessel } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) {
    await payload.update({
      collection: 'counters',
      id: docs[0].id,
      overrideAccess: true,
      data: { lastNumber: wert },
    })
  } else {
    await payload.create({
      collection: 'counters',
      overrideAccess: true,
      data: { key: schluessel, lastNumber: wert },
    })
  }
}

/** Gibt es zu dieser Kennung schon einen Beleg — auch im Papierkorb? */
async function schonAngelegt(payload: Payload, kennung: string): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'expenses',
    where: { quelleMail: { equals: kennung } },
    overrideAccess: true,
    // Papierkorb zählt mit: Ein weggeworfener Fehl-Entwurf bleibt weggeworfen
    trash: true,
  })
  return totalDocs > 0
}

export async function belegeAusPostfach(payload: Payload): Promise<number> {
  const faecher = await postfaecher(payload)
  if (!faecher.length) return 0

  // Einmal je Lauf, nicht je Anhang: Der Zugang ändert sich nicht zwischendrin
  const zugang = await kiZugang(payload)
  if (!zugang) {
    // Ohne Schlüssel liest nur Factur-X — gewöhnliche PDF-Rechnungen bleiben
    // liegen, und das soll im Protokoll stehen statt still zu passieren
    payload.logger.warn(
      'Postfach-Belege: Kein Anthropic-Schlüssel unter Integrationen — es werden nur elektronische Rechnungen (Factur-X) erkannt.',
    )
  }

  // Bekannte Lieferanten, damit die KI deren Schreibweise trifft — dieselbe
  // Hilfe, die auch die Hand-Erfassung bekommt (api/ki)
  const lieferanten = zugang
    ? (
        await payload.find({
          collection: 'contacts',
          where: { role: { in: ['lieferant', 'beides'] } },
          limit: 60,
          depth: 0,
          overrideAccess: true,
        })
      ).docs
        .map((k) => k.name)
        .filter((n): n is string => Boolean(n))
    : []

  let angelegt = 0

  for (const fach of faecher) {
    try {
      const schluessel = MERKER(fach.id)
      const zuletzt = await merkerLesen(payload, schluessel)
      const { nachrichten } = await nachrichtenListe(fach, 'INBOX', 30)

      const neue = nachrichten
        .filter((k) => k.uid > zuletzt && k.anhaenge)
        .sort((a, b) => a.uid - b.uid)
      // Der Merker rückt auch ohne Anhänge vor — sonst sähe der Lauf
      // dieselben anhanglosen Mails bei jedem Takt erneut an
      const hoechste = nachrichten.reduce((m, k) => Math.max(m, k.uid), zuletzt)
      /*
       * Aber nie über eine gescheiterte Mail hinweg. Ein API-Aussetzer oder
       * ein leeres Guthaben beim KI-Anbieter warf früher genau eine Mail
       * weg: Der Fehler wurde protokolliert, der Merker rückte trotzdem vor,
       * und die Rechnung galt für immer als angesehen. Bleibt die Grenze vor
       * der gescheiterten Mail stehen, versucht der nächste Takt sie erneut
       * — und was dahinter schon gelang, legt die Kennung am Beleg nicht
       * doppelt an.
       */
      let grenze = hoechste

      for (const kopf of neue) {
        try {
          // Ausdrücklich ohne Gelesen-Stempel — der Automat sieht nur durch
          const nachricht = await nachrichtLesen(fach, 'INBOX', kopf.uid, false)
          if (!nachricht) continue

          const pdfs = (nachricht.dateien ?? [])
            .filter(
              (d) =>
                (d.typ === 'application/pdf' || d.name.toLowerCase().endsWith('.pdf')) &&
                d.groesse > 0 &&
                d.groesse <= MAX_PDF_BYTES,
            )
            .slice(0, MAX_ANHAENGE_JE_MAIL)
          if (!pdfs.length) continue

          const basis = nachricht.messageId || `${fach.id}:${kopf.uid}`

          for (const pdf of pdfs) {
            const kennung = `${basis}#${pdf.name}`
            if (await schonAngelegt(payload, kennung)) continue

            const anhang = await anhangLaden(fach, 'INBOX', kopf.uid, pdf.name)
            if (!anhang) continue

            // Erst die exakte Quelle (Factur-X/ZUGFeRD im PDF), dann die KI
            let daten = belegAusPdf(anhang.daten)
            if (!daten && zugang) {
              daten = await belegAuslesen(
                zugang,
                { daten: anhang.daten, mimetype: 'application/pdf' },
                lieferanten,
              )
            }

            /*
             * Jede Entscheidung steht im Protokoll. Der erste Lauf schwieg —
             * und als eine Amazon-Rechnung nicht auftauchte, gab es nichts,
             * woran man hätte sehen können, warum.
             */
            if (!daten) {
              payload.logger.info(
                { betreff: kopf.betreff, datei: pdf.name },
                zugang
                  ? 'Postfach-Beleg: nichts ausgelesen'
                  : 'Postfach-Beleg: übersprungen — kein Factur-X und kein KI-Schlüssel',
              )
            } else if (!daten.brutto || daten.brutto <= 0) {
              payload.logger.info(
                { betreff: kopf.betreff, datei: pdf.name },
                'Postfach-Beleg: übersprungen — kein Bruttobetrag (vermutlich kein Beleg)',
              )
            }

            const entwurf = belegEntwurf(
              daten,
              {
                von: kopf.von,
                vonAdresse: kopf.vonAdresse,
                betreff: kopf.betreff,
                datum: kopf.datum,
                kennung,
              },
              new Date().toISOString().slice(0, 10),
            )
            if (!entwurf) continue

            /*
             * Das PDF wandert in die Mediathek und hängt am Beleg — genau wie
             * ein von Hand hochgeladener Scan. Der Dateiname bekommt die UID
             * vorangestellt, damit zwei „rechnung.pdf" verschiedener Mails
             * sich nicht in die Quere kommen.
             */
            const medium = await payload.create({
              collection: 'media',
              overrideAccess: true,
              data: { alt: `Beleg: ${entwurf.supplierName}` },
              file: {
                data: anhang.daten,
                mimetype: 'application/pdf',
                name: `postbeleg-${kopf.uid}-${pdf.name}`,
                size: anhang.daten.length,
              },
            })

            const beleg = await payload.create({
              collection: 'expenses',
              overrideAccess: true,
              data: { ...entwurf, document: medium.id },
            })
            angelegt += 1
            payload.logger.info(
              { beleg: beleg.id, lieferant: entwurf.supplierName, brutto: entwurf.grossAmount },
              'Postfach-Beleg: Entwurf angelegt',
            )

            await benachrichtige(payload, {
              titel: `Beleg-Entwurf: ${entwurf.supplierName}`,
              text: `${entwurf.grossAmount.toFixed(2)} € aus dem Postfach — bitte prüfen.`,
              url: `/office/belege/${beleg.id}`,
              tag: `postbeleg-${beleg.id}`,
            }).catch(() => undefined)
          }
        } catch (err) {
          // Eine kaputte Mail hält die nächste nicht auf — aber der Merker
          // bleibt vor ihr stehen, damit sie noch einmal drankommt
          grenze = Math.min(grenze, kopf.uid - 1)
          payload.logger.warn(
            { err, uid: kopf.uid },
            'Postfach-Beleg: Mail übersprungen, wird beim nächsten Takt erneut versucht',
          )
        }
      }

      /*
       * Ohne KI-Schlüssel bleibt der Merker stehen. Genau das hat einmal
       * eine Rechnung verschluckt: Der Lauf konnte nur Factur-X lesen,
       * hakte die Mails aber trotzdem ab — als der Schlüssel kam, galt die
       * Amazon-Rechnung als erledigt. Steht der Merker still, sieht sich
       * der nächste Lauf mit Schlüssel dieselben Mails noch einmal an; vor
       * doppelten Entwürfen schützt die Kennung am Beleg.
       */
      if (zugang && grenze > zuletzt) await merkerSchreiben(payload, schluessel, grenze)
    } catch (err) {
      payload.logger.error({ err, fach: fach.id }, 'Postfach-Belege fehlgeschlagen')
    }
  }

  return angelegt
}
