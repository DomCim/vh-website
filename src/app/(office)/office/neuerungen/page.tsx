import fs from 'fs'
import path from 'path'
import React from 'react'

import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

/**
 * Sehr kleiner Markdown-Umsetzer — reicht für Überschriften, Listen und
 * Fettung. Eine ganze Bibliothek dafür einzubinden, wäre für eine Datei zu
 * viel des Guten.
 */
function alsAbsaetze(md: string): React.ReactNode[] {
  const fett = (text: string, key: number) => {
    const teile = text.split(/\*\*(.+?)\*\*/g)
    return (
      <React.Fragment key={key}>
        {teile.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}
      </React.Fragment>
    )
  }

  const knoten: React.ReactNode[] = []
  let liste: React.ReactNode[] = []
  let key = 0

  const listeSchliessen = () => {
    if (liste.length > 0) {
      knoten.push(
        <ul key={key++} style={{ margin: '0 0 1.5rem', paddingLeft: '1.25rem', lineHeight: 1.65 }}>
          {liste}
        </ul>,
      )
      liste = []
    }
  }

  for (const zeile of md.split('\n')) {
    const t = zeile.trim()
    if (t.startsWith('- ')) {
      liste.push(
        <li key={key++} style={{ marginBottom: '.5rem' }}>
          {fett(t.slice(2), key++)}
        </li>,
      )
    } else if (t.startsWith('## ')) {
      listeSchliessen()
      knoten.push(
        <h2
          key={key++}
          style={{
            margin: '2.25rem 0 .75rem',
            fontSize: '1rem',
            letterSpacing: 0,
            textTransform: 'none',
            color: 'var(--buero-tinte)',
          }}
        >
          {fett(t.slice(3), key++)}
        </h2>,
      )
    } else if (t.startsWith('# ')) {
      // Die Überschrift der Datei steht schon als Seitentitel darüber
      listeSchliessen()
    } else if (t.length > 0) {
      listeSchliessen()
      knoten.push(
        <p key={key++} style={{ margin: '0 0 1rem', lineHeight: 1.65 }}>
          {fett(t, key++)}
        </p>,
      )
    }
  }
  listeSchliessen()
  return knoten
}

/**
 * Was sich an Website und Büro getan hat.
 *
 * Steht bewusst hier und nicht mehr in der Website-Verwaltung: Es geht den
 * Betrieb an, nicht die Redaktion.
 */
export default async function NeuerungenSeite() {
  await bueroBenutzer()

  let markdown = 'Noch kein Protokoll vorhanden.'
  try {
    markdown = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8')
  } catch {
    // Datei fehlt — der Hinweis oben bleibt stehen
  }

  return (
    <>
      <h1>Neuerungen</h1>
      <p className="buero-unterzeile">Was sich zuletzt getan hat, neueste Einträge zuerst.</p>
      <div className="buero-karte" style={{ maxWidth: '48rem' }}>
        {alsAbsaetze(markdown)}
      </div>
    </>
  )
}
