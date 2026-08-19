import { NextResponse } from 'next/server'

import { rolle } from '../../../../../lib/rolle'

export const dynamic = 'force-dynamic'

/** Stand, mit dem das Image gebaut wurde — beim Bauen als GIT_SHA gesetzt */
const version = (process.env.APP_VERSION || 'unbekannt').slice(0, 7)

/**
 * Dasselbe wie `/api/healthz`, nur für den Büro-Container.
 *
 * Seit Website und Büro getrennt laufen, beantwortet `/api/healthz` immer der
 * Web-Container — Traefik schickt alles dorthin, was nicht `/office`,
 * `/api/office` oder `/ws/buero` ist. Es gab damit keine Möglichkeit, von
 * außen zu fragen, welcher Stand eigentlich das Büro bedient.
 *
 * Genau das ist einmal teuer geworden: Nach einem Ausrollen sah die
 * Büro-Oberfläche alt aus, und weil `/api/healthz` brav die neue Nummer
 * meldete, war minutenlang unklar, ob die Änderung fehlt oder nur der
 * Container nicht getauscht wurde. Diese Adresse liegt hinter `/api/office`
 * und wird deshalb vom Büro beantwortet — sie sagt, welcher Stand dort läuft
 * und in welcher Rolle.
 *
 * Bewusst ohne Anmeldung: Es steht nichts drin, was nicht auch in der
 * ausgelieferten Seite steckt, und ein Health-Check, der eine Anmeldung
 * braucht, ist im Ernstfall keiner.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', version, rolle: rolle() })
}
