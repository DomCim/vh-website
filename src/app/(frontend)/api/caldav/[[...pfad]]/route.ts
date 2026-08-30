import { payloadClient } from '../../../../../lib/data'
import { bereichErlaubt } from '../../../../../lib/bereiche'
import {
  ausDokument,
  dateiname,
  einzelnesDokument,
  etagVon,
  kennungAus,
  mehrfachAntwort,
  terminLoeschen,
  terminSpeichern,
  xml,
} from '../../../../../lib/kalender/caldav'
import type { Termin } from '../../../../../lib/kalender/ical'
import { alleTermine } from '../../../../../lib/kalender/quellen'
import { kontoZuSchluessel } from '../../../../../lib/kalender/zugang'
import { rechteFuer } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Der CalDAV-Server — damit am iPhone angelegte Termine im Büro ankommen.
 *
 * Warum das nötig ist, steht in `lib/kalender/caldav.ts`: Ein abonnierter
 * Kalender lässt sich am Telefon nicht beschreiben, ein Konto schon.
 *
 * Eingerichtet wird das am iPhone unter Einstellungen → Apps → Kalender →
 * Accounts → Account hinzufügen → Andere → CalDAV-Account. Als Server die
 * Adresse aus dem Büro, als Benutzername die E-Mail, als Passwort der
 * Kalender-Schlüssel.
 *
 * Der Nachweis läuft über HTTP Basic. Das ist hier vertretbar und anderswo
 * nicht: Die Verbindung ist TLS-verschlüsselt, und übertragen wird nicht das
 * Passwort des Kontos, sondern der Kalender-Schlüssel — der nur den Kalender
 * öffnet und sich einzeln zurückziehen lässt, ohne dass jemand sein Passwort
 * ändern muss.
 *
 * Was hier absichtlich fehlt: `MKCALENDAR` (es gibt genau einen Kalender),
 * geteilte Kalender und Aufgaben. iOS fragt danach, verkraftet aber ein
 * Nein — was es unbedingt braucht, ist die Kette
 * `current-user-principal` → `calendar-home-set` → Kalenderliste.
 */

const WURZEL = '/api/caldav'

/** Die Verben, die WebDAV zusätzlich zu HTTP mitbringt. */
const ERLAUBT = 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT, PROPPATCH'

type Zugang = {
  payload: Awaited<ReturnType<typeof payloadClient>>
  konto: Record<string, any>
  schluessel: string
  /** Was nach dem Schlüssel in der Adresse steht. */
  rest: string[]
}

/**
 * Wer klopft da?
 *
 * Der Schlüssel darf aus dem Pfad kommen oder aus dem Basic-Nachweis. Beides,
 * weil iOS beim Einrichten zuerst ohne Nachweis anfragt und erst nach einem
 * `401` mit einem wiederkommt — die Adresse allein muss also schon reichen,
 * damit das Einrichten überhaupt anspringt.
 */
async function anmelden(req: Request, pfad: string[]): Promise<Zugang | null> {
  const payload = await payloadClient()

  // 1. Der Schlüssel steckt im Pfad
  const ausPfad = pfad[0] ?? ''
  let konto = ausPfad ? await kontoZuSchluessel(payload, ausPfad) : null
  let schluessel = ausPfad
  let rest = pfad.slice(1)

  // 2. Sonst im Basic-Nachweis — Benutzername egal, das Passwort ist der Schlüssel
  if (!konto) {
    const kopf = req.headers.get('authorization') ?? ''
    const treffer = /^Basic\s+(.+)$/i.exec(kopf)
    if (treffer) {
      const entpackt = Buffer.from(treffer[1], 'base64').toString('utf8')
      const wort = entpackt.slice(entpackt.indexOf(':') + 1)
      konto = await kontoZuSchluessel(payload, wort)
      if (konto) {
        schluessel = wort
        rest = pfad
      }
    }
  }

  if (!konto) return null

  // Der Schlüssel ersetzt die Anmeldung, hebt die Rechte aber nicht auf
  const rechte = await rechteFuer(payload, konto)
  if (!bereichErlaubt('termine', rechte)) return null

  return { payload, konto, schluessel, rest }
}

/**
 * Nach einem Nachweis fragen.
 *
 * Anders als beim Abonnement ist `401` hier richtig: Ein CalDAV-Konto hat ein
 * Eingabefeld für Benutzername und Passwort, das Telefon kann also etwas
 * damit anfangen.
 */
function nachweisVerlangen(): Response {
  return new Response('Nicht angemeldet', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Vincent Hellmann Kalender"',
      DAV: '1, 2, 3, calendar-access',
    },
  })
}

/** Die Adressen innerhalb des Servers. */
const wege = (schluessel: string) => ({
  benutzer: `${WURZEL}/${schluessel}/`,
  zuhause: `${WURZEL}/${schluessel}/kalender/`,
  kalender: `${WURZEL}/${schluessel}/kalender/`,
})

/**
 * Sagen, was dieser Server kann.
 *
 * Der `DAV`-Kopf ist beim Einrichten der erste Prüfstein: Fehlt darin
 * `calendar-access`, bricht iOS mit „Der Account konnte nicht überprüft
 * werden" ab, ohne je einen Termin abzufragen.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: { DAV: '1, 2, 3, calendar-access', Allow: ERLAUBT },
  })
}

/**
 * PROPFIND — die Erkundung.
 *
 * Drei Ebenen, je nachdem, wie tief die Adresse zeigt: die Wurzel (wer bin
 * ich?), das Zuhause (welche Kalender gibt es?) und der Kalender selbst
 * (welche Termine liegen darin?).
 */
async function propfind(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  const { payload, konto, schluessel, rest } = zugang
  const w = wege(schluessel)
  const tiefe = req.headers.get('depth') ?? '0'
  const name = xml(String(konto.name || konto.email || 'Büro'))

  // Ebene 3: im Kalender — die Termine auflisten
  if (rest[0] === 'kalender') {
    const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

    const kalenderStueck = `
  <response>
    <href>${w.kalender}</href>
    <propstat>
      <prop>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <displayname>Vincent Hellmann</displayname>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
        <getctag xmlns="http://calendarserver.org/ns/">${Date.now().toString(36)}</getctag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`

    // Bei Tiefe 0 fragt das Telefon nur nach dem Kalender selbst
    if (tiefe === '0') {
      return mehrfachAntwort(
        `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${kalenderStueck}\n</multistatus>`,
      )
    }

    const termine = await alleTermine(payload, basis)
    const stuecke = termine
      .map(
        (t) => `
  <response>
    <href>${w.kalender}${dateiname(t.uid)}</href>
    <propstat>
      <prop>
        <getetag>${etagVon(t)}</getetag>
        <getcontenttype>text/calendar; component=vevent</getcontenttype>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`,
      )
      .join('')

    return mehrfachAntwort(
      `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${kalenderStueck}${stuecke}\n</multistatus>`,
    )
  }

  /*
   * Ebene 1 und 2: Wurzel und Zuhause.
   *
   * Beide antworten mit demselben Block. Das ist keine Bequemlichkeit: iOS
   * fragt je nach Fassung mal das eine, mal das andere zuerst, und beide
   * Antworten müssen den Weg zum Kalender zeigen, sonst bleibt die
   * Einrichtung ohne Fehlermeldung stehen.
   */
  return mehrfachAntwort(
    `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>${pfad.length ? `${WURZEL}/${pfad.join('/')}/`.replace(/\/+$/, '/') : `${WURZEL}/`}</href>
    <propstat>
      <prop>
        <resourcetype><collection/></resourcetype>
        <displayname>${name}</displayname>
        <current-user-principal><href>${w.benutzer}</href></current-user-principal>
        <principal-URL><href>${w.benutzer}</href></principal-URL>
        <C:calendar-home-set><href>${w.zuhause}</href></C:calendar-home-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
  <response>
    <href>${w.kalender}</href>
    <propstat>
      <prop>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <displayname>Vincent Hellmann</displayname>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
        <getctag xmlns="http://calendarserver.org/ns/">${Date.now().toString(36)}</getctag>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`,
  )
}

/**
 * REPORT — die Termine holen.
 *
 * Zwei Abfragen kommen vor: `calendar-query` („gib mir alles im Zeitraum")
 * und `calendar-multiget` („gib mir genau diese hier"). Beide werden gleich
 * beantwortet, nur die Auswahl unterscheidet sich.
 */
async function report(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  const { payload, schluessel } = zugang
  const w = wege(schluessel)
  const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

  const rumpf = await req.text()
  const alle = await alleTermine(payload, basis)

  /*
   * Beim Multiget nur die angefragten. Die Adressen stehen als <href> im
   * Rumpf; daraus wieder die Kennungen zu gewinnen ist zuverlässiger, als den
   * ganzen XML-Baum zu zerlegen — die Geräte schreiben ihn unterschiedlich.
   */
  let auswahl: Termin[] = alle
  if (/calendar-multiget/i.test(rumpf)) {
    const gewuenscht = new Set(
      [...rumpf.matchAll(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/gi)].map((m) => kennungAus(m[1])),
    )
    auswahl = alle.filter((t) => gewuenscht.has(t.uid))
  }

  const stuecke = auswahl
    .map(
      (t) => `
  <response>
    <href>${w.kalender}${dateiname(t.uid)}</href>
    <propstat>
      <prop>
        <getetag>${etagVon(t)}</getetag>
        <C:calendar-data>${xml(einzelnesDokument(t))}</C:calendar-data>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`,
    )
    .join('')

  return mehrfachAntwort(
    `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${stuecke}\n</multistatus>`,
  )
}

/** Einen einzelnen Termin holen. */
export async function GET(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  const { payload, rest } = zugang
  const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
  const uid = kennungAus(rest.join('/'))
  const termin = (await alleTermine(payload, basis)).find((t) => t.uid === uid)

  if (!termin) return new Response('Nicht gefunden', { status: 404 })

  return new Response(einzelnesDokument(termin), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      ETag: etagVon(termin),
    },
  })
}

/**
 * PUT — ein Termin vom Telefon.
 *
 * Der Kern der ganzen Übung: Hier landet, was jemand unterwegs eingetragen
 * hat. Abgelehnt wird nur, was zu einem abgeleiteten Eintrag gehört — siehe
 * `terminSpeichern`.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  const { payload, konto, rest } = zugang
  const roh = await req.text()
  const termin = ausDokument(roh)
  if (!termin) return new Response('Unverständlich', { status: 400 })

  /*
   * Aufträge und Belege bleiben unangetastet.
   *
   * Ihre Kennungen tragen die Herkunft im Namen (`auftrag-17@…`). Ein `403`
   * wäre die Wahrheit, führt am iPhone aber zu einer Fehlermeldung bei jedem
   * Abgleich. `200` mit unverändertem Stand ist die freundlichere Lüge: Das
   * Telefon holt sich beim nächsten Abruf ohnehin den echten Stand und stellt
   * die Änderung damit von selbst zurück.
   */
  const auswaerts = /^(auftrag|bestellung|angebot|beleg)-/.test(termin.uid)
  if (auswaerts) {
    return new Response(null, { status: 200, headers: { ETag: etagVon(termin) } })
  }

  // Die Kennung aus der Adresse hat Vorrang — sie ist die, unter der das
  // Telefon den Termin ablegt
  const ausAdresse = kennungAus(rest.join('/'))
  if (ausAdresse) termin.uid = ausAdresse

  const was = await terminSpeichern(payload, termin, konto.id)

  return new Response(null, {
    status: was === 'angelegt' ? 201 : 204,
    headers: { ETag: etagVon({ uid: termin.uid, geaendert: new Date() }) },
  })
}

/** Einen Termin vom Telefon aus löschen. */
export async function DELETE(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  const { payload, rest } = zugang
  const uid = kennungAus(rest.join('/'))

  // Abgeleitetes lässt sich nicht löschen — aus demselben Grund wie bei PUT
  if (/^(auftrag|bestellung|angebot|beleg)-/.test(uid)) {
    return new Response(null, { status: 204 })
  }

  await terminLoeschen(payload, uid)
  return new Response(null, { status: 204 })
}

/**
 * PROPPATCH — Eigenschaften ändern.
 *
 * iOS versucht beim Einrichten, dem Kalender eine Farbe zu geben. Hier gibt
 * es nichts zu ändern, aber ein Fehler an dieser Stelle lässt manche Fassung
 * das ganze Konto verwerfen. Also: höflich zustimmen, nichts tun.
 */
async function proppatch(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const { pfad = [] } = await ctx.params
  const zugang = await anmelden(req, pfad)
  if (!zugang) return nachweisVerlangen()

  return mehrfachAntwort(
    `<multistatus xmlns="DAV:">
  <response>
    <href>${WURZEL}/${pfad.join('/')}</href>
    <propstat><prop/><status>HTTP/1.1 200 OK</status></propstat>
  </response>
</multistatus>`,
  )
}

/** Nur der Kopf — manche Geräte prüfen damit, ob es einen Termin noch gibt. */
export async function HEAD(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const antwort = await GET(req, ctx)
  return new Response(null, { status: antwort.status, headers: antwort.headers })
}

/**
 * Die Verteilerstelle für alles, was WebDAV über HTTP hinaus mitbringt.
 *
 * `PROPFIND`, `REPORT` und `PROPPATCH` kommen hier als `POST` an — Next lässt
 * sie anders gar nicht erst durch (siehe `middleware.ts`, dort steht das
 * Warum). Der echte Name steht im Kopf `x-dav-methode`.
 *
 * Ein `POST` ohne diesen Kopf ist keiner von uns: Auf CalDAV gehört es nicht
 * zum Umgang, und irgendetwas anderes hat sich verlaufen.
 */
export async function POST(req: Request, ctx: { params: Promise<{ pfad?: string[] }> }) {
  const verb = (req.headers.get('x-dav-methode') ?? '').toUpperCase()

  switch (verb) {
    case 'PROPFIND':
      return propfind(req, ctx)
    case 'REPORT':
      return report(req, ctx)
    case 'PROPPATCH':
      return proppatch(req, ctx)
    /*
     * Einen Kalender anlegen kann man hier nicht — es gibt genau einen, und
     * der steht schon. iOS fragt trotzdem; ein `403` ist die ehrliche
     * Antwort und bringt es nicht aus dem Tritt.
     */
    case 'MKCALENDAR':
    case 'MKCOL':
      return new Response('Es gibt genau einen Kalender', { status: 403 })
    default:
      return new Response('Nicht vorgesehen', { status: 405 })
  }
}
