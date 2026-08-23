import React from 'react'

/**
 * Die gekauften Dateien an der Bestellung.
 *
 * Steht bewusst **oben** und nicht unter den Positionen: Wer eine Datei
 * gekauft hat, kommt aus genau einem Grund auf diese Seite. Alles andere —
 * Summe, Anschrift, Zahlungsart — kann er darunter nachlesen.
 *
 * Solange nicht bezahlt ist, steht hier trotzdem etwas, und zwar der Grund.
 * Ein leerer Fleck an der Stelle, an der die Ware sein sollte, ist die
 * schlimmste Antwort: Der Käufer weiß dann nicht, ob er etwas falsch gemacht
 * hat oder ob es gleich kommt.
 */

export type DownloadEintrag = {
  name: string
  url: string
  groesse: number | null
}

export type DownloadLabels = {
  title: string
  intro: string
  wartet: string
  laden: string
}

/** Dateigrößen so, wie ein Mensch sie liest */
function groesse(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString('de-DE')} kB`
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

export function Downloads({
  dateien,
  bezahlt,
  labels,
}: {
  dateien: DownloadEintrag[]
  bezahlt: boolean
  labels: DownloadLabels
}) {
  if (dateien.length === 0) return null

  return (
    <section className="border-line mb-10 border-y py-8">
      <h2 className="tracking-nav text-ink rule-bronze-sm text-sm font-semibold uppercase">
        {labels.title}
      </h2>

      {!bezahlt ? (
        <p className="text-ink-soft mt-4 text-sm leading-relaxed">{labels.wartet}</p>
      ) : (
        <>
          <p className="text-ink-soft mt-4 text-sm leading-relaxed">{labels.intro}</p>
          <ul className="mt-5 space-y-3">
            {dateien.map((d) => (
              <li key={d.url} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-ink text-sm">
                  {d.name}
                  {groesse(d.groesse) && (
                    <span className="text-ink-soft ml-2 text-xs">{groesse(d.groesse)}</span>
                  )}
                </span>
                <a
                  href={d.url}
                  className="border-bronze text-ink tracking-nav hover:bg-bronze hover:text-on-ink border px-5 py-2 text-xs font-semibold uppercase transition-colors"
                >
                  {labels.laden}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
