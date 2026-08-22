import { redirect } from 'next/navigation'

import { defaultLocale } from '../../lib/i18n'

/**
 * Der Rückfall für die Startseite ohne Sprache.
 *
 * Im Regelfall kommt hier niemand mehr an: Die Middleware schickt einen
 * Besucher ohne Sprachkürzel vorher dorthin, wo er hingehört (siehe
 * `lib/sprachwahl.ts`). Bleibt sie einmal aus — abgeschaltet, falsch
 * gefiltert —, landet man hier und bekommt Deutsch statt einer leeren Seite.
 * Das ist der Unterschied zwischen „die Sprache stimmt nicht" und „die Website
 * ist weg".
 */

export default function RootRedirect() {
  redirect(`/${defaultLocale}`)
}
