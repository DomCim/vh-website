import React from 'react'

import type { Locale } from '../../lib/i18n'

/**
 * Der Abschnitt zur Besucherzählung in der Datenschutzerklärung.
 *
 * Warum als Baustein und nicht als Text im Admin? Weil er beschreibt, was die
 * Website **tatsächlich tut**, und das steht nicht in einem Textfeld, sondern
 * in der Einstellung nebenan. Schaltet Vincent die Zählung ab, verschwindet
 * der Abschnitt mit ihr. Andersherum — Zählung an, Absatz vergessen — wäre
 * genau der Fehler, den eine Datenschutzerklärung nicht machen darf.
 *
 * Ein Banner gibt es bewusst nicht. Ohne Cookie und ohne Zugriff auf das
 * Gerät des Besuchers gibt es nichts, wozu er einwilligen müsste; die CNIL
 * nimmt reine Reichweitenmessung ausdrücklich aus, solange sie nicht über
 * Websites hinweg verfolgt, die Daten nicht weitergibt und die IP nicht
 * aufbewahrt. Genau so läuft es hier.
 *
 * Genannt wird das **Land**, in dem der Server steht, und sonst nichts zum
 * Standort. Das Land ist die Angabe, auf die es ankommt: Es entscheidet, ob
 * die Daten den europäischen Rechtsraum verlassen. Eine genauere Ortsangabe
 * beantwortet keine Frage, die sich hier stellt, stünde dafür aber auf jeder
 * Unterseite der Website.
 *
 * Der Text ist eine Beschreibung, keine Rechtsberatung — wie die übrigen
 * Pflichttexte gehört er vor dem Verkaufsstart einmal geprüft.
 */

type Absatz = { titel: string; text: string[] }

const TEXTE: Record<Locale, Absatz> = {
  de: {
    titel: 'Besucherzählung',
    text: [
      'Wir zählen, wie oft unsere Seiten aufgerufen werden. Dafür setzen wir Plausible ein — eine Software, die auf einem Server in Deutschland läuft, den wir selbst betreiben. Die Daten bleiben dort; sie werden nicht an Dritte weitergegeben und nicht mit anderen Diensten geteilt.',
      'Die Zählung kommt ohne Cookies aus. Es wird nichts auf Ihrem Gerät gespeichert und nichts von dort ausgelesen. Sie werden nicht über mehrere Websites hinweg verfolgt und nicht wiedererkannt, wenn Sie später erneut vorbeischauen.',
      'Erfasst werden: die aufgerufene Seite, die Seite, von der Sie gekommen sind, Land, Gerätetyp, Browser und Betriebssystem sowie Datum und Uhrzeit. Ihre IP-Adresse wird nicht gespeichert. Sie geht zusammen mit der Browserkennung und einem täglich wechselnden Zufallswert in eine nicht umkehrbare Prüfsumme ein, an der zwei Aufrufe desselben Tages als ein Besuch erkannt werden. Am nächsten Tag ist dieser Zusammenhang aufgelöst.',
      'Rechtsgrundlage ist unser berechtigtes Interesse an einer verständlichen Auswertung unserer Website (Art. 6 Abs. 1 lit. f DSGVO). Da keine Informationen auf Ihrem Endgerät gespeichert oder abgerufen werden, ist dafür keine Einwilligung erforderlich — deshalb fragen wir Sie auch nicht mit einem Hinweisfenster danach.',
      'Die Zahlen werden ausschließlich zusammengefasst ausgewertet; ein Rückschluss auf einzelne Personen ist nicht möglich. Sie können der Verarbeitung jederzeit widersprechen — die Kontaktdaten dafür stehen im Impressum.',
    ],
  },
  fr: {
    titel: "Mesure d'audience",
    text: [
      "Nous comptons le nombre de consultations de nos pages. Pour cela, nous utilisons Plausible, un logiciel installé sur un serveur situé en Allemagne que nous exploitons nous-mêmes. Les données y restent : elles ne sont ni transmises à des tiers ni partagées avec d'autres services.",
      "La mesure fonctionne sans cookies. Rien n'est enregistré sur votre appareil et rien n'y est lu. Vous n'êtes pas suivi d'un site à l'autre et vous n'êtes pas reconnu lors d'une visite ultérieure.",
      "Sont enregistrés : la page consultée, la page d'où vous venez, le pays, le type d'appareil, le navigateur et le système d'exploitation ainsi que la date et l'heure. Votre adresse IP n'est pas conservée. Elle sert, avec l'identifiant du navigateur et une valeur aléatoire renouvelée chaque jour, à calculer une empreinte irréversible qui permet de reconnaître deux consultations du même jour comme une seule visite. Le lendemain, ce lien a disparu.",
      "La base légale est notre intérêt légitime à disposer d'une analyse compréhensible de notre site (art. 6, § 1, point f, du RGPD). Aucune information n'étant enregistrée sur votre terminal ni lue depuis celui-ci, aucun consentement n'est requis — c'est pourquoi aucune fenêtre ne vous le demande.",
      "Les chiffres ne sont exploités que de manière agrégée ; aucune conclusion sur une personne déterminée n'est possible. Vous pouvez vous opposer à tout moment à ce traitement : les coordonnées figurent dans les mentions légales.",
    ],
  },
  en: {
    titel: 'Visitor statistics',
    text: [
      'We count how often our pages are viewed. For this we use Plausible, software that runs on a server in Germany that we operate ourselves. The data stays there: it is not passed on to third parties and not shared with other services.',
      'The count works without cookies. Nothing is stored on your device and nothing is read from it. You are not tracked across websites and you are not recognised if you come back later.',
      'What is recorded: the page viewed, the page you came from, country, device type, browser and operating system, plus date and time. Your IP address is not stored. Together with the browser identifier and a random value that changes daily, it goes into an irreversible checksum by which two views on the same day are recognised as one visit. The next day, that connection is gone.',
      'The legal basis is our legitimate interest in a comprehensible analysis of our website (Art. 6(1)(f) GDPR). Since no information is stored on or read from your device, no consent is required — which is why we do not ask you for one in a pop-up.',
      'The figures are only ever evaluated in aggregate; no conclusions about individual people are possible. You may object to this processing at any time — the contact details are in the legal notice.',
    ],
  },
}

export function Besucherzaehlung({ locale }: { locale: Locale }) {
  const abschnitt = TEXTE[locale]
  return (
    <section className="border-line mt-10 border-t pt-8">
      <h2 className="text-ink mb-4 text-lg font-semibold">{abschnitt.titel}</h2>
      <div className="prose-vh">
        {abschnitt.text.map((absatz, i) => (
          <p key={i}>{absatz}</p>
        ))}
      </div>
    </section>
  )
}
