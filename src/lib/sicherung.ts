import { execFile } from 'child_process'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import http from 'http'
import https from 'https'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

import type { Payload } from 'payload'

const ausfuehren = promisify(execFile)

/**
 * Sicherung der gesamten Anwendung — Datenbank und Bilder in einem Archiv,
 * anschließend auf die NAS geschoben.
 *
 * Vorher gab es nur einen Nebencontainer, der die Datenbank in ein Volume
 * kippte. Zwei Lücken: Die Bilder fehlten (die Datenbank verweist auf Dateien,
 * die es dann nicht mehr gäbe), und alles lag auf derselben Maschine wie das
 * Original. Deshalb macht die Sicherung jetzt die App selbst — dann ist sie im
 * Büro sichtbar, lässt sich per Knopf auslösen und landet dort, wo sie
 * hingehört: auf einem zweiten Gerät.
 */

const VERZEICHNIS = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')
const MEDIEN = process.env.MEDIA_DIR || path.join(process.cwd(), 'media')

/** Nur was dieses Muster erfüllt, wird angefasst — schützt vor `../` im Namen. */
const NAME_MUSTER = /^vh-\d{8}-\d{4}\.tar\.gz$/

export type Sicherung = { name: string; groesse: number; erstellt: string }

export type SicherungsZiel = {
  protokoll?: 'smb' | 'webdav' | null
  smbServer?: string | null
  smbFreigabe?: string | null
  smbPfad?: string | null
  smbBenutzer?: string | null
  smbPasswort?: string | null
  webdavUrl?: string | null
  webdavBenutzer?: string | null
  webdavPasswort?: string | null
  automatik?: boolean | null
  uhrzeit?: string | null
  behaltenLokal?: number | null
  behaltenNas?: number | null
}

export async function sicherungsZiel(payload: Payload): Promise<SicherungsZiel> {
  const global = (await payload.findGlobal({ slug: 'integrations', depth: 0 })) as Record<
    string,
    any
  >
  return (global?.sicherung ?? {}) as SicherungsZiel
}

/** Ist ein Netzwerkspeicher vollständig hinterlegt? */
export function nasEingerichtet(ziel: SicherungsZiel): boolean {
  if (ziel.protokoll === 'webdav') return Boolean(ziel.webdavUrl?.trim())
  return Boolean(ziel.smbServer?.trim() && ziel.smbFreigabe?.trim())
}

export function zielName(ziel: SicherungsZiel): string {
  return ziel.protokoll === 'webdav' ? 'WebDAV' : 'Samba/CIFS'
}

// ── Ablage auf dem Server ───────────────────────────────────────────────────

export async function sicherungenListe(): Promise<Sicherung[]> {
  try {
    const dateien = await fs.readdir(VERZEICHNIS)
    const treffer = dateien.filter((d) => NAME_MUSTER.test(d))
    const mitStat = await Promise.all(
      treffer.map(async (name) => {
        const s = await fs.stat(path.join(VERZEICHNIS, name))
        return { name, groesse: s.size, erstellt: s.mtime.toISOString() }
      }),
    )
    // Neueste zuerst — im Büro interessiert immer die letzte
    return mitStat.sort((a, b) => b.erstellt.localeCompare(a.erstellt))
  } catch {
    return []
  }
}

export function sicherungsPfad(name: string): string {
  if (!NAME_MUSTER.test(name)) throw new Error('Unbekannter Sicherungsname')
  return path.join(VERZEICHNIS, name)
}

export async function sicherungLoeschen(name: string): Promise<void> {
  await fs.unlink(sicherungsPfad(name))
}

/** Ältere Kopien wegräumen, damit die Platte nicht vollläuft. */
async function lokalAufraeumen(behalten: number): Promise<void> {
  const alle = await sicherungenListe()
  for (const alt of alle.slice(Math.max(1, behalten))) {
    await fs.unlink(path.join(VERZEICHNIS, alt.name)).catch(() => {})
  }
}

/**
 * Datenbank und Medien in ein Archiv packen.
 *
 * `pg_dump -Fc` statt reinem SQL: Das Format lässt sich mit `pg_restore`
 * einzeln zurückspielen und ist deutlich kleiner. Die Textdatei daneben
 * erklärt beim Ernstfall, was zu tun ist — dann liest niemand mehr Doku.
 */
export async function sicherungErstellen(payload: Payload): Promise<Sicherung> {
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('Keine Datenbank-Adresse hinterlegt (DATABASE_URI).')

  await fs.mkdir(VERZEICHNIS, { recursive: true })
  const arbeit = await fs.mkdtemp(path.join(os.tmpdir(), 'vh-sicherung-'))

  const jetzt = new Date()
  const zz = (n: number) => String(n).padStart(2, '0')
  const stempel = `${jetzt.getFullYear()}${zz(jetzt.getMonth() + 1)}${zz(jetzt.getDate())}-${zz(jetzt.getHours())}${zz(jetzt.getMinutes())}`
  const name = `vh-${stempel}.tar.gz`
  const ziel = path.join(VERZEICHNIS, name)

  try {
    await ausfuehren('pg_dump', ['--dbname', uri, '--format', 'custom', '--file', path.join(arbeit, 'datenbank.dump')], {
      timeout: 30 * 60_000,
      maxBuffer: 10 * 1024 * 1024,
    })

    await fs.writeFile(
      path.join(arbeit, 'LIESMICH.txt'),
      [
        'Vincent Hellmann — Komplettsicherung',
        `Erstellt: ${jetzt.toLocaleString('de-DE')}`,
        '',
        'Inhalt:',
        '  datenbank.dump   Die vollständige Datenbank (Format: pg_dump -Fc)',
        '  medien/          Alle Bilder und Videos aus der Mediathek',
        '',
        'Zurückspielen:',
        '  1. Archiv entpacken:  tar -xzf ' + name,
        '  2. Datenbank leeren und zurückspielen:',
        '     pg_restore --clean --if-exists --no-owner -d "$DATABASE_URI" datenbank.dump',
        '  3. Den Inhalt von medien/ in das Volume "media" des Web-Containers kopieren',
        '     (Ziel im Container: /app/media)',
        '  4. Container neu starten — die Migrationen laufen beim Start von selbst.',
        '',
        'Die Datenbank allein reicht nicht: Sie verweist auf die Dateien in medien/.',
      ].join('\n'),
      'utf8',
    )

    const medienDa = await fs
      .stat(MEDIEN)
      .then((s) => s.isDirectory())
      .catch(() => false)

    // GNU tar: mehrere -C hintereinander, dadurch liegen Dump und Medien
    // nebeneinander im Archiv statt in verschachtelten Serverpfaden.
    const argumente = ['-czf', ziel, '-C', arbeit, 'datenbank.dump', 'LIESMICH.txt']
    if (medienDa) argumente.push('-C', path.dirname(MEDIEN), path.basename(MEDIEN))
    await ausfuehren('tar', argumente, { timeout: 60 * 60_000, maxBuffer: 10 * 1024 * 1024 })

    const stat = await fs.stat(ziel)
    const ergebnis: Sicherung = {
      name,
      groesse: stat.size,
      erstellt: stat.mtime.toISOString(),
    }

    const ziele = await sicherungsZiel(payload)
    await lokalAufraeumen(ziele.behaltenLokal ?? 7)
    return ergebnis
  } finally {
    await fs.rm(arbeit, { recursive: true, force: true }).catch(() => {})
  }
}

// ── Netzwerkspeicher ────────────────────────────────────────────────────────

/**
 * Zugangsdatei für smbclient.
 *
 * Bewusst nicht `-U benutzer%passwort`: Das stünde in der Prozessliste und
 * damit für jeden lesbar, der auf dem Host `ps` tippt.
 */
async function smbAuthDatei(ziel: SicherungsZiel): Promise<string> {
  const ordner = await fs.mkdtemp(path.join(os.tmpdir(), 'vh-smb-'))
  const datei = path.join(ordner, 'auth')
  await fs.writeFile(
    datei,
    `username = ${ziel.smbBenutzer ?? ''}\npassword = ${ziel.smbPasswort ?? ''}\n`,
    { mode: 0o600 },
  )
  return datei
}

/** Ein smbclient-Kommando gegen die eingerichtete Freigabe ausführen. */
async function smbBefehl(ziel: SicherungsZiel, befehl: string): Promise<string> {
  const auth = await smbAuthDatei(ziel)
  try {
    const { stdout, stderr } = await ausfuehren(
      'smbclient',
      [`//${ziel.smbServer}/${ziel.smbFreigabe}`, '-A', auth, '-c', befehl],
      // Eine hängende NAS (Netz weg, Freigabe eingefroren) darf den Lauf nicht
      // endlos blockieren.
      { timeout: 30 * 60_000, maxBuffer: 10 * 1024 * 1024 },
    )
    const ausgabe = `${stdout}${stderr}`
    // smbclient meldet manche Fehler mit Rückgabecode 0 — deshalb zusätzlich
    // auf NT_STATUS prüfen.
    if (/NT_STATUS_(?!OK)/.test(ausgabe)) {
      throw new Error(ausgabe.split('\n').find((z) => z.includes('NT_STATUS')) ?? ausgabe)
    }
    return ausgabe
  } finally {
    await fs.rm(path.dirname(auth), { recursive: true, force: true }).catch(() => {})
  }
}

/** Datei per WebDAV hochladen (HTTP PUT, gestreamt statt im Speicher). */
async function webdavPut(ziel: SicherungsZiel, datei: string): Promise<void> {
  const basis = (ziel.webdavUrl ?? '').replace(/\/+$/, '')
  const adresse = new URL(`${basis}/${path.basename(datei)}`)
  const stat = await fs.stat(datei)
  const modul = adresse.protocol === 'http:' ? http : https

  await new Promise<void>((fertig, fehler) => {
    const anfrage = modul.request(
      adresse,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/gzip', 'Content-Length': stat.size },
        auth: ziel.webdavBenutzer ? `${ziel.webdavBenutzer}:${ziel.webdavPasswort ?? ''}` : undefined,
        timeout: 30 * 60_000,
      },
      (antwort) => {
        antwort.resume()
        const code = antwort.statusCode ?? 0
        if (code >= 200 && code < 300) fertig()
        else fehler(new Error(`Der Speicher hat die Sicherung abgelehnt (HTTP ${code}).`))
      },
    )
    anfrage.on('error', fehler)
    anfrage.on('timeout', () => anfrage.destroy(new Error('Zeitüberschreitung beim Hochladen.')))
    createReadStream(datei).pipe(anfrage)
  })
}

/** Namen der Sicherungen auf dem Netzwerkspeicher, neueste zuerst. */
async function nasListe(ziel: SicherungsZiel): Promise<string[]> {
  if (ziel.protokoll === 'webdav') {
    const basis = (ziel.webdavUrl ?? '').replace(/\/+$/, '')
    const adresse = new URL(`${basis}/`)
    const modul = adresse.protocol === 'http:' ? http : https
    const rumpf = await new Promise<string>((fertig, fehler) => {
      const anfrage = modul.request(
        adresse,
        {
          method: 'PROPFIND',
          headers: { Depth: '1', 'Content-Type': 'application/xml' },
          auth: ziel.webdavBenutzer
            ? `${ziel.webdavBenutzer}:${ziel.webdavPasswort ?? ''}`
            : undefined,
          timeout: 60_000,
        },
        (antwort) => {
          let text = ''
          antwort.setEncoding('utf8')
          antwort.on('data', (t) => (text += t))
          antwort.on('end', () => fertig(text))
        },
      )
      anfrage.on('error', fehler)
      anfrage.end()
    })
    const namen = [...rumpf.matchAll(/vh-\d{8}-\d{4}\.tar\.gz/g)].map((t) => t[0])
    return [...new Set(namen)].sort().reverse()
  }

  const pfad = (ziel.smbPfad ?? '').replace(/^\/+|\/+$/g, '')
  const ausgabe = await smbBefehl(ziel, `${pfad ? `cd "${pfad}"; ` : ''}ls vh-*.tar.gz`)
  const namen = [...ausgabe.matchAll(/vh-\d{8}-\d{4}\.tar\.gz/g)].map((t) => t[0])
  return [...new Set(namen)].sort().reverse()
}

/** Alte Sicherungen auf dem Netzwerkspeicher entfernen. */
async function nasAufraeumen(ziel: SicherungsZiel): Promise<void> {
  const behalten = Math.max(1, ziel.behaltenNas ?? 30)
  const vorhanden = await nasListe(ziel).catch(() => [])
  const weg = vorhanden.slice(behalten)
  if (!weg.length) return

  if (ziel.protokoll === 'webdav') {
    const basis = (ziel.webdavUrl ?? '').replace(/\/+$/, '')
    for (const name of weg) {
      const adresse = new URL(`${basis}/${name}`)
      const modul = adresse.protocol === 'http:' ? http : https
      await new Promise<void>((fertig) => {
        const anfrage = modul.request(
          adresse,
          {
            method: 'DELETE',
            auth: ziel.webdavBenutzer
              ? `${ziel.webdavBenutzer}:${ziel.webdavPasswort ?? ''}`
              : undefined,
            timeout: 60_000,
          },
          (antwort) => {
            antwort.resume()
            fertig()
          },
        )
        anfrage.on('error', () => fertig())
        anfrage.end()
      })
    }
    return
  }

  const pfad = (ziel.smbPfad ?? '').replace(/^\/+|\/+$/g, '')
  const befehle = weg.map((name) => `del "${name}"`).join('; ')
  await smbBefehl(ziel, `${pfad ? `cd "${pfad}"; ` : ''}${befehle}`)
}

/** Eine fertige Sicherung auf den Netzwerkspeicher schieben (und dort aufräumen). */
export async function sicherungHochladen(payload: Payload, name: string): Promise<string> {
  const datei = sicherungsPfad(name)
  await fs.access(datei)

  const ziel = await sicherungsZiel(payload)
  if (!nasEingerichtet(ziel)) {
    throw new Error('Es ist kein Netzwerkspeicher hinterlegt (Verwaltung → Integrationen → Sicherung).')
  }

  if (ziel.protokoll === 'webdav') {
    await webdavPut(ziel, datei)
  } else {
    const pfad = (ziel.smbPfad ?? '').replace(/^\/+|\/+$/g, '')
    await smbBefehl(ziel, `${pfad ? `cd "${pfad}"; ` : ''}put "${datei}" "${name}"`)
  }

  await nasAufraeumen(ziel).catch(() => {})
  return zielName(ziel)
}

// ── Automatik ───────────────────────────────────────────────────────────────

/** Zustand lesen/schreiben — dient als Tages-Riegel und als Lebenszeichen. */
export async function zustandLesen(payload: Payload, key: string) {
  const { docs } = await payload.find({
    collection: 'system-state',
    where: { key: { equals: key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] as { id: number | string; lastRun?: string; ok?: boolean; note?: string } | undefined
}

export async function zustandMerken(
  payload: Payload,
  key: string,
  daten: { ok?: boolean; note?: string | null; zeitpunkt?: Date },
): Promise<void> {
  const vorhanden = await zustandLesen(payload, key)
  const werte = {
    key,
    lastRun: (daten.zeitpunkt ?? new Date()).toISOString(),
    ok: daten.ok ?? true,
    note: daten.note ?? undefined,
  }
  if (vorhanden) {
    await payload.update({
      collection: 'system-state',
      id: vorhanden.id,
      overrideAccess: true,
      data: werte,
    })
  } else {
    await payload.create({ collection: 'system-state', overrideAccess: true, data: werte })
  }
}

const tagesStempel = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Nächtliche Sicherung — gedacht für einen Cron, der viertelstündlich klopft.
 *
 * Die Uhrzeit steht in den Einstellungen, nicht in der crontab: Wer sie ändern
 * will, soll das im Admin tun können. Deshalb prüft der Lauf selbst, ob die
 * Zeit erreicht und heute noch nichts passiert ist.
 */
export async function sicherungAutomatik(payload: Payload): Promise<string | null> {
  const ziel = await sicherungsZiel(payload)
  if (ziel.automatik === false) return null

  const uhrzeit = /^([01]\d|2[0-3]):[0-5]\d$/.test(ziel.uhrzeit ?? '')
    ? (ziel.uhrzeit as string)
    : '03:30'
  const jetzt = new Date()
  const aktuell = `${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}`
  if (aktuell < uhrzeit) return null

  const zustand = await zustandLesen(payload, 'sicherung')
  if (zustand?.lastRun && tagesStempel(new Date(zustand.lastRun)) >= tagesStempel(jetzt)) return null

  // Riegel vor dem eigentlichen Lauf setzen: Ein zweiter Cron-Aufruf während
  // des Packens soll nicht dieselbe Sicherung ein zweites Mal anwerfen.
  await zustandMerken(payload, 'sicherung', { ok: true, note: 'läuft …' })

  try {
    const fertig = await sicherungErstellen(payload)
    let hinweis = `${fertig.name} (${(fertig.groesse / 1048576).toFixed(1)} MB, nur lokal)`
    if (nasEingerichtet(ziel)) {
      const weg = await sicherungHochladen(payload, fertig.name)
      hinweis = `${fertig.name} (${(fertig.groesse / 1048576).toFixed(1)} MB) über ${weg}`
    }
    await zustandMerken(payload, 'sicherung', { ok: true, note: hinweis })
    payload.logger.info(`Sicherung: ${hinweis}`)
    return hinweis
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    await zustandMerken(payload, 'sicherung', { ok: false, note: text.slice(0, 300) })
    payload.logger.error({ err }, 'Sicherung fehlgeschlagen')
    throw err
  }
}
