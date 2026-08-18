import type { AuthStrategy } from 'payload'

import {
  cookieOptionen,
  PASSKEY_COOKIE,
  PASSKEY_GUELTIG_SEKUNDEN,
  passkeySitzungErzeugen,
  passkeySitzungLesen,
  sitzungsAnker,
} from './passkeySitzung'

/**
 * Anmeldestrategie für Passkey-Sitzungen.
 *
 * Payload prüft nacheinander alle Strategien: Erst sein eigenes Token aus der
 * Anmeldung mit Passwort, dann diese hier. Findet sie ein gültiges
 * Passkey-Cookie, ist der Benutzer angemeldet — im Admin, im Büro und an den
 * Schnittstellen gleichermaßen.
 *
 * Zwei Sicherungen: Die Signatur bindet das Cookie an den Serverschlüssel,
 * und der mitgeführte Anker an das Passwort des Kontos. Ein geändertes
 * Passwort macht damit auch alle Passkey-Sitzungen ungültig — das ist der
 * Weg, wenn ein Gerät verloren geht.
 */
export const passkeyStrategie: AuthStrategy = {
  name: 'passkey',
  authenticate: async ({ canSetHeaders, headers, payload }) => {
    const kekse = headers.get('cookie') ?? ''
    const treffer = new RegExp(`(?:^|;\\s*)${PASSKEY_COOKIE}=([^;]+)`).exec(kekse)
    if (!treffer) return { user: null }

    const sitzung = passkeySitzungLesen(decodeURIComponent(treffer[1]!))
    if (!sitzung) return { user: null }

    try {
      const benutzer = (await payload.findByID({
        collection: 'users',
        id: sitzung.benutzerId,
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
      })) as Record<string, any>

      if (!benutzer) return { user: null }
      if (sitzungsAnker(benutzer) !== sitzung.anker) return { user: null }

      /**
       * Verlängern, solange die Sitzung benutzt wird — dieselbe Regel wie bei
       * der Anmeldung mit Passwort. Erneuert wird erst, wenn das Cookie einen
       * Tag alt ist: Sonst schriebe jede einzelne Anfrage ein neues.
       */
      const responseHeaders = new Headers()
      const alter = PASSKEY_GUELTIG_SEKUNDEN * 1000 - (sitzung.ablauf - Date.now())
      if (canSetHeaders && alter > 24 * 60 * 60 * 1000) {
        const frisch = passkeySitzungErzeugen(benutzer.id, sitzung.anker)
        const o = cookieOptionen()
        responseHeaders.append(
          'Set-Cookie',
          `${frisch.name}=${frisch.wert}; Path=${o.path}; Max-Age=${frisch.maxAge}; HttpOnly; SameSite=Lax${o.secure ? '; Secure' : ''}`,
        )
      }

      return {
        responseHeaders,
        user: {
          ...benutzer,
          collection: 'users',
          _strategy: 'passkey',
        } as never,
      }
    } catch {
      return { user: null }
    }
  },
}
