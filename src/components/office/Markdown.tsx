import React from 'react'

import { markdownLesen, zeileZerlegen, type Stueck } from '../../lib/markdownEinfach'

/**
 * Ein Papier aus dem Quelltext, im Büro lesbar gemacht.
 *
 * Ohne `dangerouslySetInnerHTML`: Der Leser gibt Stücke heraus, hier werden
 * daraus React-Elemente. Damit gibt es keine Stelle, an der Text zu Markup
 * werden könnte — auch dann nicht, wenn irgendwann ein Papier hinzukommt, das
 * nicht aus diesem Repository stammt.
 */

function Zeile({ text }: { text: string }) {
  return (
    <>
      {zeileZerlegen(text).map((teil, i) => {
        if (teil.fett) return <strong key={i}>{teil.text}</strong>
        if (teil.code) return <code key={i}>{teil.text}</code>
        return <React.Fragment key={i}>{teil.text}</React.Fragment>
      })}
    </>
  )
}

function Block({ stueck }: { stueck: Stueck }) {
  switch (stueck.art) {
    case 'ueberschrift': {
      // Die H1 des Papiers ist die Überschrift der Seite — darunter geht es
      // eine Ebene tiefer weiter, damit die Seite eine saubere Gliederung hat.
      const Tag = (stueck.ebene === 1 ? 'h1' : stueck.ebene === 2 ? 'h2' : 'h3') as 'h1'
      return (
        <Tag>
          <Zeile text={stueck.text} />
        </Tag>
      )
    }
    case 'absatz':
      return (
        <p>
          <Zeile text={stueck.text} />
        </p>
      )
    case 'liste': {
      const Tag = stueck.nummeriert ? 'ol' : 'ul'
      return (
        <Tag className="buero-papier-liste">
          {stueck.punkte.map((p, i) => (
            <li key={i}>
              <Zeile text={p} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'tabelle':
      return (
        // Eine Tabelle darf am Handy scrollen — sie ist das Einzige, was hier
        // breiter werden darf als die Seite.
        <div style={{ overflowX: 'auto' }}>
          <table className="buero-tabelle">
            <thead>
              <tr>
                {stueck.kopf.map((z, i) => (
                  <th key={i} scope="col">
                    <Zeile text={z} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stueck.zeilen.map((zeile, i) => (
                <tr key={i}>
                  {zeile.map((z, j) => (
                    <td key={j}>
                      <Zeile text={z} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'zitat':
      return (
        <blockquote className="buero-hinweis">
          {stueck.zeilen.map((z, i) => (
            <p key={i} style={{ margin: 0 }}>
              <Zeile text={z} />
            </p>
          ))}
        </blockquote>
      )
    case 'linie':
      return <hr className="buero-papier-linie" />
  }
}

export function Markdown({ text }: { text: string }) {
  const stuecke = markdownLesen(text)
  return (
    <div className="buero-papier">
      {stuecke.map((s, i) => (
        <Block key={i} stueck={s} />
      ))}
    </div>
  )
}
