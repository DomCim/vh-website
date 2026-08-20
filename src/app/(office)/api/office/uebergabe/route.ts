import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { briefbogen } from '../../../../../lib/mail'
import { sendMail } from '../../../../../lib/sendMail'
import { firmenAngaben } from '../../../../../lib/settings'
import {
  GUELTIG_TAGE,
  gueltigBis,
  mappenTitel,
  ordnerName,
  passwortErzeugen,
  passwortVerwahren,
  tokenErzeugen,
} from '../../../../../lib/uebergabe'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Übergabemappen verwalten — die Seite des Büros.
 *
 * Anlegen, Ordner vorbereiten, Link erzeugen und verschicken, Zugang
 * zurückziehen, eine Hausdatei für den Auftraggeber freigeben.
 *
 * Das Passwort steht **einmal** in der Antwort — danach nirgends mehr. Was
 * gespeichert wird, ist ein Abdruck; wer es später noch braucht, erzeugt
 * einen neuen Zugang. Das ist unbequemer als ein Feld zum Nachlesen und
 * genau deshalb richtig.
 */

type Zugang = {
  token?: string | null
  passwort?: string | null
  erzeugtAm?: string | null
  gueltigBis?: string | null
  anEmail?: string | null
  zuletztGenutzt?: string | null
  zurueckgezogen?: boolean | null
}

/** Name des Geschäftspartners und Adresse — für Titel und Mailversand. */
async function partnerAngaben(
  payload: Awaited<ReturnType<typeof payloadClient>>,
  id: unknown,
): Promise<{ name: string | null; email: string | null }> {
  if (!id) return { name: null, email: null }
  try {
    const doc = await payload.findByID({
      collection: 'contacts',
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    })
    return { name: doc?.name ?? null, email: doc?.email ?? null }
  } catch {
    return { name: null, email: null }
  }
}

async function anfrageAngaben(
  payload: Awaited<ReturnType<typeof payloadClient>>,
  id: unknown,
): Promise<{ name: string | null; email: string | null }> {
  if (!id) return { name: null, email: null }
  try {
    const doc = await payload.findByID({
      collection: 'inquiries',
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    })
    return { name: doc?.name ?? null, email: doc?.email ?? null }
  } catch {
    return { name: null, email: null }
  }
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'angebote.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    // ── Anlegen ───────────────────────────────────────────────────────────
    if (!b.aktion || b.aktion === 'anlegen') {
      /*
       * Ohne Bezug geht es nicht.
       *
       * Eine Mappe, die an nichts hängt, ist in einem halben Jahr ein Rätsel:
       * „Zeichnungen 3" sagt niemandem, wessen Zeichnungen das sind, und
       * wiederfinden lässt sie sich nur, wer noch weiß, wie er sie genannt
       * hat. Deshalb: ein Geschäftspartner oder eine Anfrage. Beides geht
       * auch, eines muss.
       */
      if (!b.contact && !b.anfrage) {
        return NextResponse.json({ error: 'kein-bezug' }, { status: 400 })
      }

      const partner = await partnerAngaben(payload, b.contact)
      const anfrage = await anfrageAngaben(payload, b.anfrage)

      const doc = await payload.create({
        collection: 'customer-uploads',
        overrideAccess: true,
        data: {
          title:
            String(b.title ?? '').trim() ||
            mappenTitel({
              kontakt: partner.name ?? anfrage.name,
              anfrage: b.anfrage ? Number(b.anfrage) : null,
              betreff: b.betreff,
            }),
          // Die Adresse kommt aus dem Vorgang, wenn keine eingetippt wurde —
          // getippte Adressen sind die häufigste Quelle für Links, die niemand bekommt
          email: b.email || anfrage.email || partner.email || undefined,
          contact: b.contact ? Number(b.contact) : undefined,
          anfrage: b.anfrage ? Number(b.anfrage) : undefined,
          angebot: b.angebot ? Number(b.angebot) : undefined,
          auftrag: b.auftrag ? Number(b.auftrag) : undefined,
          note: b.note || undefined,
          folders: (b.ordner ?? ['Zeichnungen'])
            .map((n: unknown) => ordnerName(n))
            .filter(Boolean)
            .map((name: string) => ({ name })),
        },
      })
      return NextResponse.json({ ok: true, id: doc.id, title: doc.title })
    }

    if (!b.id) return NextResponse.json({ error: 'keine-mappe' }, { status: 400 })

    const mappe = await payload.findByID({
      collection: 'customer-uploads',
      id: b.id,
      depth: 0,
      overrideAccess: true,
    })
    if (!mappe) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    // ── Angaben ändern ────────────────────────────────────────────────────
    if (b.aktion === 'aendern') {
      const doc = await payload.update({
        collection: 'customer-uploads',
        id: b.id,
        overrideAccess: true,
        data: {
          ...(b.title !== undefined ? { title: b.title } : {}),
          ...(b.email !== undefined ? { email: b.email || null } : {}),
          ...(b.note !== undefined ? { note: b.note || null } : {}),
          ...(b.geschlossen !== undefined ? { geschlossen: Boolean(b.geschlossen) } : {}),
          ...(b.contact !== undefined ? { contact: b.contact || null } : {}),
          ...(b.anfrage !== undefined ? { anfrage: b.anfrage || null } : {}),
          ...(b.angebot !== undefined ? { angebot: b.angebot || null } : {}),
          ...(b.auftrag !== undefined ? { auftrag: b.auftrag || null } : {}),
        },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    // ── Ordner ────────────────────────────────────────────────────────────
    if (['ordner-anlegen', 'ordner-umbenennen', 'ordner-loeschen'].includes(b.aktion)) {
      const bisher = (mappe.folders ?? []) as { name: string }[]

      if (b.aktion === 'ordner-anlegen') {
        const name = ordnerName(b.name)
        if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
        if (bisher.some((o) => o.name === name)) {
          return NextResponse.json({ error: 'gibt-es-schon' }, { status: 400 })
        }
        await payload.update({
          collection: 'customer-uploads',
          id: b.id,
          overrideAccess: true,
          data: { folders: [...bisher, { name }] },
        })
        return NextResponse.json({ ok: true, name })
      }

      if (b.aktion === 'ordner-umbenennen') {
        const alt = ordnerName(b.name)
        const neu = ordnerName(b.neuerName)
        if (!alt || !neu) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
        if (bisher.some((o) => o.name === neu)) {
          return NextResponse.json({ error: 'gibt-es-schon' }, { status: 400 })
        }
        await payload.update({
          collection: 'customer-uploads',
          id: b.id,
          overrideAccess: true,
          data: { folders: bisher.map((o) => (o.name === alt ? { name: neu } : o)) },
        })
        // Die Dateien ziehen mit — sie tragen den Ordner als Namen
        const dateien = await payload.find({
          collection: 'product-files',
          where: { and: [{ mappe: { equals: b.id } }, { folder: { equals: alt } }] },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const d of dateien.docs) {
          await payload.update({
            collection: 'product-files',
            id: d.id,
            overrideAccess: true,
            data: { folder: neu },
          })
        }
        return NextResponse.json({ ok: true, name: neu })
      }

      // Löschen: nur ein leerer Ordner. Einer, der beim Verschwinden
      // Zeichnungen mitnimmt, ist keine Aufräumhilfe, sondern ein Unfall.
      const name = ordnerName(b.name)
      const drin = await payload.count({
        collection: 'product-files',
        where: { and: [{ mappe: { equals: b.id } }, { folder: { equals: name } }] },
        overrideAccess: true,
      })
      if (drin.totalDocs > 0) return NextResponse.json({ error: 'nicht-leer' }, { status: 400 })
      await payload.update({
        collection: 'customer-uploads',
        id: b.id,
        overrideAccess: true,
        data: { folders: bisher.filter((o) => o.name !== name) },
      })
      return NextResponse.json({ ok: true })
    }

    // ── Eine Hausdatei freigeben oder wieder zurückhalten ──────────────────
    if (b.aktion === 'datei-freigeben') {
      const datei = await payload.findByID({
        collection: 'product-files',
        id: b.datei,
        depth: 0,
        overrideAccess: true,
      })
      // Nur Dateien dieser Mappe — sonst gäbe diese Aktion eine Werkstattdatei
      // eines fremden Artikels frei, und niemand sähe, wie sie hinausgelangte
      if (String((datei as { mappe?: unknown }).mappe ?? '') !== String(b.id)) {
        return NextResponse.json({ error: 'gehoert-nicht-dazu' }, { status: 400 })
      }
      await payload.update({
        collection: 'product-files',
        id: b.datei,
        overrideAccess: true,
        data: { freigabe: Boolean(b.freigabe) } as never,
      })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'datei-loeschen') {
      const datei = await payload.findByID({
        collection: 'product-files',
        id: b.datei,
        depth: 0,
        overrideAccess: true,
      })
      if (String((datei as { mappe?: unknown }).mappe ?? '') !== String(b.id)) {
        return NextResponse.json({ error: 'gehoert-nicht-dazu' }, { status: 400 })
      }
      await payload.delete({ collection: 'product-files', id: b.datei, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    // ── Zugang erzeugen und verschicken ───────────────────────────────────
    if (b.aktion === 'link') {
      const an = String(b.an || mappe.email || '').trim()
      const token = tokenErzeugen()
      const passwort = passwortErzeugen()
      const bis = gueltigBis()

      const zugaenge = [
        ...((mappe.zugaenge ?? []) as Zugang[]),
        {
          token,
          passwort: passwortVerwahren(passwort),
          erzeugtAm: new Date().toISOString(),
          gueltigBis: bis,
          anEmail: an || undefined,
          zurueckgezogen: false,
        },
      ]

      await payload.update({
        collection: 'customer-uploads',
        id: b.id,
        overrideAccess: true,
        data: { zugaenge, ...(an && !mappe.email ? { email: an } : {}) },
      })

      const basis = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const url = `${basis}/de/uebergabe/${token}`

      let verschickt = false
      if (an && b.senden !== false) {
        const einstellungen = await payload
          .findGlobal({ slug: 'site-settings', depth: 0 })
          .catch(() => null)
        const firma = firmenAngaben(einstellungen as never)
        const html = briefbogen(
          `
          <p>Guten Tag,</p>
          <p>für den Austausch der Unterlagen steht ein Ordner bereit:
             <strong>${mappe.title}</strong></p>
          <p>Dort können Sie Ihre Zeichnungen und Dateien ablegen — und finden
             umgekehrt alles, was wir für Sie bereitstellen.</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#a86b3d;color:#fff;text-decoration:none;border-radius:6px">Ordner öffnen</a></p>
          <p>Passwort: <strong style="font-size:18px;letter-spacing:2px">${passwort}</strong></p>
          <p style="color:#666">Der Zugang gilt ${GUELTIG_TAGE} Tage. Wenn Sie danach noch etwas
             nachreichen möchten, melden Sie sich einfach — Sie bekommen dann einen neuen Link
             auf denselben Ordner.</p>
        `,
          firma,
        )
        try {
          await sendMail(payload, {
            to: an,
            subject: `Unterlagen austauschen: ${mappe.title}`,
            html,
            art: 'sonstiges',
          })
          verschickt = true
        } catch (err) {
          payload.logger.error({ err }, 'Übergabelink konnte nicht verschickt werden')
        }
      }

      /*
       * Das Passwort geht **einmal** hier heraus, damit es im Büro
       * dastehen kann — zum Durchsagen am Telefon, falls die Mail nicht
       * ankommt. Gespeichert ist nur der Abdruck.
       */
      return NextResponse.json({ ok: true, url, passwort, gueltigBis: bis, verschickt })
    }

    // ── Zugang zurückziehen ───────────────────────────────────────────────
    if (b.aktion === 'zurueckziehen') {
      const zugaenge = ((mappe.zugaenge ?? []) as Zugang[]).map((z) =>
        z.token === b.token ? { ...z, zurueckgezogen: true } : z,
      )
      await payload.update({
        collection: 'customer-uploads',
        id: b.id,
        overrideAccess: true,
        data: { zugaenge },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Übergabemappe fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
