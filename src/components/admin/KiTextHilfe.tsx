'use client'

import { Button, useAllFormFields, useField, useLocale } from '@payloadcms/ui'
import { useState } from 'react'

type Art = 'news' | 'produktbeschreibung' | 'kurzbeschreibung' | 'referenz' | 'frei'

/**
 * KI-Hilfe an einem Textfeld: Vorschlag erzeugen oder aus dem Deutschen
 * übersetzen. Der Vorschlag landet im Feld und kann dort weiterbearbeitet
 * werden — gespeichert wird erst, wenn der Mensch speichert.
 */
export function KiTextHilfe({
  pfad,
  art,
  titelFeld = 'title',
}: {
  pfad: string
  art: Art
  titelFeld?: string
}) {
  const { value, setValue } = useField<string>({ path: pfad })
  const [felder] = useAllFormFields()
  const locale = useLocale()
  const [laeuft, setLaeuft] = useState<null | 'text' | 'uebersetzen'>(null)
  const [meldung, setMeldung] = useState<string | null>(null)

  const titel = String(felder?.[titelFeld]?.value ?? '')
  const sprache = typeof locale === 'string' ? locale : locale?.code
  const istDeutsch = !sprache || sprache === 'de'

  const ruf = async (rumpf: Record<string, unknown>, was: 'text' | 'uebersetzen') => {
    setLaeuft(was)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/ki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rumpf),
      })
      const daten = await antwort.json()
      if (!antwort.ok) {
        setMeldung(
          daten.error === 'kein-schluessel'
            ? 'Kein Anthropic-Schlüssel hinterlegt (Verwaltung → Integrationen).'
            : 'Das hat nicht geklappt.',
        )
        return
      }
      if (daten.text) {
        setValue(daten.text)
        setMeldung('Vorschlag eingesetzt — bitte prüfen und dann speichern.')
      }
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginTop: '-.5rem', marginBottom: '1rem' }}>
      {istDeutsch ? (
        <Button
          size="small"
          buttonStyle="secondary"
          disabled={laeuft !== null || !titel}
          onClick={() => ruf({ aktion: 'text', art, vorgabe: titel, vorhandenerText: value }, 'text')}
        >
          {laeuft === 'text' ? 'schreibt …' : 'Mit KI vorschlagen'}
        </Button>
      ) : (
        <Button
          size="small"
          buttonStyle="secondary"
          disabled={laeuft !== null}
          onClick={async () => {
            // Deutsche Fassung des Feldes holen und übersetzen
            const url = new URL(window.location.href)
            url.searchParams.set('locale', 'de')
            setLaeuft('uebersetzen')
            setMeldung(null)
            try {
              const id = window.location.pathname.split('/').pop()
              const sammlung = window.location.pathname.split('/collections/')[1]?.split('/')[0]
              const res = await fetch(`/api/${sammlung}/${id}?locale=de&depth=0`, {
                credentials: 'include',
              })
              const doc = await res.json()
              const deutsch = pfad.split('.').reduce<any>((o, k) => o?.[k], doc)
              if (!deutsch) {
                setMeldung('Es gibt noch keine deutsche Fassung dieses Feldes.')
                setLaeuft(null)
                return
              }
              await ruf(
                { aktion: 'uebersetzen', text: String(deutsch), ziel: sprache },
                'uebersetzen',
              )
            } catch {
              setMeldung('Die deutsche Fassung war nicht abrufbar.')
              setLaeuft(null)
            }
          }}
        >
          {laeuft === 'uebersetzen' ? 'übersetzt …' : 'Aus dem Deutschen übersetzen'}
        </Button>
      )}
      {!titel && istDeutsch && (
        <span style={{ opacity: 0.7, fontSize: '.8rem' }}>Erst einen Titel eingeben.</span>
      )}
      {meldung && <span style={{ opacity: 0.85, fontSize: '.8rem' }}>{meldung}</span>}
    </div>
  )
}

/** Vorkonfigurierte Varianten für die einzelnen Sammlungen */
export const KiNewsTeaser = () => <KiTextHilfe pfad="excerpt" art="kurzbeschreibung" />
export const KiProduktKurz = () => <KiTextHilfe pfad="shortDescription" art="kurzbeschreibung" />
export const KiReferenzKurz = () => <KiTextHilfe pfad="summary" art="kurzbeschreibung" />
