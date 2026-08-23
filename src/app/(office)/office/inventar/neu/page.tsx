'use client'

import React from 'react'

import { InventarFormular } from '../../../../../components/office/InventarFormular'

/**
 * Neuer Posten.
 *
 * Die Lieferantenliste holt sich das Feld inzwischen selbst aus dem Bestand im
 * Gerät — hier stand sie nur herum und musste in beiden Seiten gleich gepflegt
 * werden.
 */
export default function NeuerPostenSeite() {
  return (
    <>
      <h1>Neuer Posten</h1>
      <p className="buero-unterzeile">Material, Werkzeug oder Maschine — alles, was im Haus ist.</p>
      <InventarFormular werte={{}} />
    </>
  )
}
