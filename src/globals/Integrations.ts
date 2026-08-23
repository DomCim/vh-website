import type { GlobalConfig } from 'payload'

import { admins } from '../access'

/**
 * Zugangsdaten für E-Mail, PayPal und Facebook — pflegbar im Admin.
 * Leere Felder fallen auf die gleichnamigen Umgebungsvariablen zurück.
 * Nur für eingeloggte Benutzer lesbar (enthält Geheimnisse!).
 */
export const Integrations: GlobalConfig = {
  slug: 'integrations',
  label: 'Integrationen',
  admin: {
    group: 'Verwaltung',
    description:
      'Zugangsdaten für E-Mail-Versand, PayPal und Facebook. Leere Felder nutzen die im Server hinterlegten Umgebungsvariablen.',
  },
  access: {
    read: admins,
    update: admins,
  },
  fields: [
    {
      name: 'email',
      label: 'E-Mail-Versand (SMTP)',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'smtpHost',
              label: 'SMTP-Server',
              type: 'text',
              admin: { description: 'z.B. smtp.strato.de' },
            },
            {
              name: 'smtpPort',
              label: 'Port',
              type: 'number',
              admin: { description: '587 (STARTTLS) oder 465 (SSL)' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'smtpUser',
              label: 'Benutzername',
              type: 'text',
            },
            {
              name: 'smtpPass',
              label: 'Passwort',
              type: 'text',
              admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'fromAddress',
              label: 'Absender-Adresse',
              type: 'email',
              admin: { description: 'z.B. info@vincent-hellmann.com' },
            },
            {
              name: 'fromName',
              label: 'Absender-Name',
              type: 'text',
              admin: { description: 'z.B. Vincent Hellmann' },
            },
          ],
        },
        {
          /*
           * DKIM — die Unterschrift unter der Mail.
           *
           * Ohne sie landet Post von einer eigenen Domain regelmäßig im Spam:
           * Der empfangende Server sieht eine Mail, die vorgibt, von
           * vincent-hellmann.com zu kommen, und hat nichts, womit er das
           * prüfen könnte. Mit DKIM signiert der Absender, und im DNS steht
           * der öffentliche Schlüssel dazu.
           *
           * Drei Angaben gehören zusammen und wirken nur gemeinsam. Fehlt
           * eine, wird gar nicht signiert — eine halbe Unterschrift ist
           * schlimmer als keine, denn sie schlägt beim Prüfen fehl.
           */
          name: 'dkim',
          label: 'DKIM-Signatur (optional)',
          type: 'group',
          admin: {
            description:
              'Signiert ausgehende Mails, damit sie nicht im Spam landen — die der Website und die Antworten aus den Postfächern weiter unten, sofern deren Adresse auf dieser Domain liegt. Wirkt nur, wenn alle drei Felder gefüllt sind und der öffentliche Schlüssel im DNS steht.',
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'domain',
                  label: 'Domain der Absender-Adresse',
                  type: 'text',
                  admin: { description: 'z.B. vincent-hellmann.com — leer = keine Signatur' },
                },
                {
                  name: 'selector',
                  label: 'Selector',
                  type: 'text',
                  admin: {
                    description:
                      'Name des DNS-Eintrags, z.B. „vh" → vh._domainkey.vincent-hellmann.com',
                  },
                },
              ],
            },
            {
              name: 'privateKey',
              label: 'Privater Schlüssel (PEM)',
              type: 'textarea',
              admin: {
                description:
                  'Beginnt mit -----BEGIN. Der zugehörige öffentliche Schlüssel muss als DNS-TXT-Eintrag veröffentlicht sein.',
                components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
              },
            },
          ],
        },
        {
          name: 'notificationEmail',
          label: 'Benachrichtigungen an',
          type: 'email',
          admin: {
            description: 'Empfängt Kontaktanfragen und Bestell-Benachrichtigungen',
          },
        },
        {
          name: 'steuerberaterEmail',
          label: 'Steuerberater (Kanzlei-Adresse)',
          type: 'email',
          admin: {
            description:
              'Empfängt auf Knopfdruck das Monatspaket aus dem Steuer-Export: Buchungsliste, Beleg-Scans und Rechnungs-PDFs des Monats.',
          },
        },
      ],
    },
    {
      name: 'push',
      label: 'Benachrichtigungen (Büro-App)',
      type: 'group',
      admin: {
        description:
          'Schlüssel für die Push-Benachrichtigungen der Büro-App. Wird beim ersten Mal automatisch erzeugt — hier ist nichts einzutragen. Wer den Schlüssel austauscht, muss alle Geräte neu anmelden.',
      },
      fields: [
        {
          name: 'publicKey',
          label: 'Öffentlicher Schlüssel',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'privateKey',
          label: 'Privater Schlüssel',
          type: 'text',
          admin: { readOnly: true, hidden: true },
        },
        {
          name: 'subject',
          label: 'Kontaktadresse für den Push-Dienst',
          type: 'text',
          defaultValue: 'mailto:info@vincent-hellmann.com',
          admin: {
            description: 'Verlangen die Push-Dienste, falls es Rückfragen zum Versand gibt.',
          },
        },
      ],
    },
    {
      name: 'mailboxes',
      label: 'Postfächer (IMAP)',
      labels: { singular: 'Postfach', plural: 'Postfächer' },
      type: 'array',
      admin: {
        description:
          'Postfächer, die im Büro unter /office/post gelesen und beantwortet werden — z.B. info@ und bestellungen@. Die Website selbst verschickt weiterhin über die Absenderadresse oben (noreply@), die hier nicht eingetragen werden muss.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              label: 'Bezeichnung',
              type: 'text',
              required: true,
              admin: { description: 'z.B. „Info" — steht so in der Auswahl im Büro.' },
            },
            {
              name: 'address',
              label: 'E-Mail-Adresse',
              type: 'email',
              required: true,
              admin: { description: 'Wird beim Antworten als Absender verwendet.' },
            },
            {
              name: 'isDefault',
              label: 'Beim Öffnen zeigen',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'imapHost',
              label: 'IMAP-Server',
              type: 'text',
              required: true,
              admin: { description: 'z.B. imap.strato.de' },
            },
            {
              name: 'imapPort',
              label: 'Port',
              type: 'number',
              defaultValue: 993,
              admin: { description: '993 (SSL) oder 143 (STARTTLS)' },
            },
            {
              name: 'imapSecure',
              label: 'Verschlüsselt (SSL)',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'user', label: 'Benutzername', type: 'text', required: true },
            {
              name: 'pass',
              label: 'Passwort',
              type: 'text',
              required: true,
              admin: {
                description: 'Wird nur serverseitig verwendet und nie an den Browser ausgeliefert.',
                components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'sentMailbox',
              label: 'Ordner „Gesendet"',
              type: 'text',
              defaultValue: 'Sent',
              admin: { description: 'Bei manchen Anbietern „Gesendete Objekte" oder „INBOX.Sent".' },
            },
            {
              name: 'trashMailbox',
              label: 'Ordner „Papierkorb"',
              type: 'text',
              defaultValue: 'Trash',
            },
          ],
        },
        {
          name: 'signature',
          label: 'Signatur',
          type: 'textarea',
          // Im Büro erscheint das Feld als Schreibfeld mit Gestaltung — die
          // Signatur darf fett, farbig und mit Link sein, wie die Mails auch.
          // Gespeichert wird dann HTML; alter Klartext bleibt gültig.
          custom: { gestaltet: true },
          admin: {
            description:
              'Wird unter jede Mail gesetzt, die aus dem Büro rausgeht — und lässt sich dort gestalten (fett, Farbe, Link). Ohne Eintrag entsteht sie aus Absendername und den Kontaktdaten der Website-Einstellungen. Firmierung, SIRET und TVA werden ohnehin automatisch angehängt — das ist Pflicht.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'smtpHost',
              label: 'Eigener SMTP-Server (optional)',
              type: 'text',
              admin: {
                description:
                  'Nur nötig, wenn dieses Postfach über einen anderen Server verschickt als oben eingestellt.',
              },
            },
            { name: 'smtpPort', label: 'Port', type: 'number' },
            { name: 'smtpUser', label: 'Benutzername', type: 'text' },
            {
              name: 'smtpPass',
              label: 'Passwort',
              type: 'text',
              admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
            },
          ],
        },
        {
          /*
           * Eigene Unterschrift für dieses Postfach.
           *
           * Der Normalfall braucht das nicht: Steht die Adresse auf derselben
           * Domain wie die allgemeine DKIM-Angabe oben, wird die genommen.
           * Nötig wird es, wenn ein Postfach auf einer anderen Domain liegt —
           * eine Mail von einer .fr-Adresse mit dem .com-Schlüssel zu
           * unterschreiben nützt nichts, weil DMARC verlangt, dass Absender
           * und signierende Domain zusammenpassen.
           */
          name: 'dkim',
          label: 'Eigene DKIM-Signatur (optional)',
          type: 'group',
          admin: {
            description:
              'Nur nötig, wenn dieses Postfach auf einer anderen Domain liegt als die allgemeine DKIM-Angabe oben. Leer = die allgemeine wird verwendet, sofern die Domain zur Adresse passt.',
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'domain',
                  label: 'Domain',
                  type: 'text',
                  admin: { description: 'Die Domain der Adresse dieses Postfachs' },
                },
                {
                  name: 'selector',
                  label: 'Selector',
                  type: 'text',
                  admin: { description: 'Name des DNS-Eintrags, z.B. „vh"' },
                },
              ],
            },
            {
              name: 'privateKey',
              label: 'Privater Schlüssel (PEM)',
              type: 'textarea',
              admin: {
                description:
                  'Beginnt mit -----BEGIN. Der öffentliche Schlüssel muss im DNS dieser Domain stehen.',
                components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
              },
            },
          ],
        },
      ],
    },
    {
      /*
       * Wiederkehrende Absätze fürs Schreibfeld.
       *
       * Grußformeln, Zahlungshinweise, Gewährleistungstexte — was in jeder
       * zweiten Mail steht, soll niemand jedes Mal neu tippen. Im Schreibfeld
       * öffnet „::" die Auswahl; der Titel ist das, wonach man dort sucht.
       */
      name: 'textbausteine',
      label: 'Textbausteine',
      labels: { singular: 'Textbaustein', plural: 'Textbausteine' },
      type: 'array',
      admin: {
        description:
          'Fertige Absätze für Mails, Versandfenster und Newsletter. Im Schreibfeld „::" tippen, Baustein wählen — eingefügt. Der Titel dient zum Finden, z.B. „Gruß französisch" oder „Zahlungshinweis".',
      },
      fields: [
        {
          name: 'titel',
          label: 'Titel',
          type: 'text',
          required: true,
          admin: { description: 'Steht in der Auswahl — kurz und eindeutig.' },
        },
        {
          name: 'inhalt',
          label: 'Inhalt',
          type: 'textarea',
          required: true,
          custom: { gestaltet: true },
          admin: {
            description: 'Der Text, der eingefügt wird — mit Gestaltung, wenn gewünscht.',
          },
        },
      ],
    },
    {
      /*
       * Die eigene Besucherzählung.
       *
       * Plausible läuft im internen Netz und ist von außen nicht erreichbar —
       * gezählt wird über die eigenen Routen der Website, ausgewertet wird im
       * Büro. Deshalb steht hier eine Adresse wie `http://plausible:8000` und
       * keine, die man im Browser aufrufen könnte.
       *
       * Ob überhaupt gezählt wird, entscheidet der Haken in den
       * Website-Einstellungen unter „Besucherstatistik". Hier stehen nur die
       * Zugangsdaten — die gehören zu den Geheimnissen und nicht in eine
       * Einstellung, die jeder Seitenaufruf mitliest.
       */
      name: 'plausible',
      label: 'Besucherzählung (Plausible)',
      type: 'group',
      admin: {
        description:
          'Zugang zur eigenen Statistik. Eingeschaltet wird die Zählung in den Website-Einstellungen unter „Besucherstatistik"; hier steht nur, wo sie läuft und womit das Büro sie abfragen darf.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'url',
              label: 'Adresse im internen Netz',
              type: 'text',
              admin: {
                description:
                  'z.B. http://plausible:8000 — der Containername, nicht eine Adresse von außen.',
              },
            },
            {
              name: 'seite',
              label: 'Name der Website in Plausible',
              type: 'text',
              admin: { description: 'Genau so, wie die Seite dort angelegt ist, z.B. vincent-hellmann.com' },
            },
          ],
        },
        {
          name: 'apiKey',
          label: 'Schlüssel für die Auswertung',
          type: 'text',
          admin: {
            description:
              'In Plausible unter Settings → API Keys anlegen. Nur zum Lesen der Zahlen; ohne ihn bleibt die Auswertung im Büro leer, gezählt wird trotzdem.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        /*
         * Der Zugang zur Ereignis-Datenbank — für die einzelnen Besuchswege.
         *
         * Die Auswertung oben kennt nur Summen; wer sehen will, woher **ein**
         * Besucher kam und was er sich der Reihe nach angesehen hat, muss
         * dorthin, wo die Ereignisse liegen (siehe `lib/besuche.ts`).
         *
         * Ohne Adresse bleibt die Seite „Einzelne Besuche" schlicht aus. Das
         * ist der vorgesehene Zustand, solange der Büro-Container nicht ins
         * Netz der Statistik darf.
         */
        {
          name: 'chUrl',
          label: 'Ereignis-Datenbank (ClickHouse)',
          type: 'text',
          admin: {
            description:
              'z.B. http://plausible_events_db:8123 — nur nötig für die einzelnen Besuchswege. Der Container muss dafür im selben Netz stehen (siehe README, „Einzelne Besuche").',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'chDatenbank',
              label: 'Datenbank',
              type: 'text',
              admin: { description: 'Vorgabe: plausible_events_db' },
            },
            {
              name: 'chBenutzer',
              label: 'Benutzer',
              type: 'text',
              admin: { description: 'Vorgabe: default — so kommt ClickHouse aus dem Stack' },
            },
          ],
        },
        {
          name: 'chPasswort',
          label: 'Passwort der Ereignis-Datenbank',
          type: 'text',
          admin: {
            description:
              'Bleibt leer, solange ClickHouse wie im Stack ohne Benutzerverwaltung läuft.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
      ],
    },
    {
      name: 'paypal',
      label: 'PayPal (Zahlungen)',
      type: 'group',
      fields: [
        {
          name: 'clientId',
          label: 'Client-ID',
          type: 'text',
          admin: {
            description: 'Aus dem PayPal-Developer-Dashboard (REST-App)',
          },
        },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          type: 'text',
          admin: { components: { Field: '/components/admin/GeheimFeld#GeheimFeld' } },
        },
        {
          name: 'sandbox',
          label: 'Sandbox-Modus (Testumgebung)',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Aktivieren, solange mit Sandbox-Zugangsdaten getestet wird',
          },
        },
      ],
    },
    {
      name: 'anthropic',
      label: 'KI-Funktionen (Claude)',
      type: 'group',
      admin: {
        description:
          'Schlüssel von console.anthropic.com. Damit liest die Verwaltung hochgeladene Belege aus und schlägt Texte und Übersetzungen vor. Ohne Schlüssel bleiben diese Knöpfe einfach aus.',
      },
      fields: [
        {
          name: 'apiKey',
          label: 'Anthropic API-Schlüssel',
          type: 'text',
          admin: {
            description: 'Beginnt mit sk-ant-…',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'model',
          label: 'Modell',
          type: 'text',
          defaultValue: 'claude-opus-5',
          admin: {
            description: 'Nur ändern, wenn es einen Grund gibt. Standard: claude-opus-5.',
          },
        },
      ],
    },
    {
      name: 'mcp',
      label: 'KI-Assistent (MCP-Server)',
      type: 'group',
      admin: {
        description:
          'Zugang für die Verwaltung per Claude. Ohne Schlüssel ist der Endpunkt abgeschaltet.',
      },
      fields: [
        {
          name: 'apiKey',
          label: 'Schlüssel (voller Zugriff)',
          type: 'text',
          admin: {
            description:
              'Wirkt wie ein Admin-Passwort — nur an vertrauenswürdige Geräte weitergeben.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'readonlyKey',
          label: 'Schlüssel (nur lesen)',
          type: 'text',
          admin: {
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
            description:
              'Optional. Mit diesem Schlüssel lassen sich Inhalte und Auswertungen nur ansehen.',
          },
        },
        {
          name: 'zugang',
          type: 'ui',
          admin: {
            components: {
              Field: '/components/admin/McpZugang#McpZugang',
            },
          },
        },
      ],
    },
    {
      /*
       * Zahlungsziele je Stufe.
       *
       * Sie stehen hier und nicht am Artikel, weil sie nichts mit dem Stück zu
       * tun haben, sondern mit der Art, wie der Betrieb Geld einzieht. Bei der
       * einzelnen Rechnung lässt sich das Datum weiterhin ändern — für den
       * Kunden, mit dem man etwas anderes vereinbart hat.
       */
      name: 'zahlungsziele',
      label: 'Zahlungsziele',
      type: 'group',
      admin: {
        description:
          'Wie viele Tage nach Rechnungsstellung fällig wird. Gilt als Vorgabe; an der einzelnen Rechnung änderbar.',
      },
      fields: [
        {
          name: 'anzahlungTage',
          label: 'Anzahlung (Tage)',
          type: 'number',
          min: 1,
          defaultValue: 7,
          admin: {
            description:
              'Kurz gehalten: Die Anzahlung hält den Werkstattplatz, und lange offen bringt niemandem etwas.',
          },
        },
        {
          name: 'zwischenTage',
          label: 'Zwischenrechnung (Tage)',
          type: 'number',
          min: 1,
          defaultValue: 14,
        },
        {
          name: 'schlussTage',
          label: 'Schlussrechnung (Tage)',
          type: 'number',
          min: 1,
          defaultValue: 14,
          admin: {
            description: 'Geliefert wird ohnehin erst nach Zahlungseingang.',
          },
        },
        {
          /*
           * Ab wann das Büro fragt, ob der Werkstattplatz wieder frei wird.
           *
           * Bei einer offenen Anzahlung wird nicht gemahnt — es ist noch nichts
           * geleistet, und wer nur noch überlegt, bekommt keine Mahngebühr.
           * Irgendwann muss aber die Entscheidung fallen, sonst blockiert ein
           * Auftrag, den es vielleicht gar nicht gibt, einen Platz in der Reihe.
           */
          name: 'platzFreigebenNachTagen',
          label: 'Nach wie vielen Tagen nach dem Werkstattplatz fragen?',
          type: 'number',
          min: 1,
          defaultValue: 21,
          admin: {
            description:
              'Bleibt die Anzahlung so lange offen, meldet das Büro: Werkstattplatz freigeben? Gemahnt wird dabei nicht.',
          },
        },
      ],
    },
    {
      /*
       * Die Plateforme Agréée — der Teil der französischen E-Rechnungspflicht,
       * den kein Code erledigt.
       *
       * Technisch ist das Haus fertig: Rechnungen entstehen als Factur-X
       * (lib/facturx.ts), und eingehende werden aus dem PDF gelesen
       * (lib/facturxLesen.ts). Damit ist die Empfangspflicht ab dem
       * 1. September 2026 technisch erfüllt.
       *
       * Offen ist die Vertragsseite: Zugestellt wird ab dann über eine
       * zugelassene Plattform (PDP), und dort muss der Betrieb angemeldet
       * sein. Das ist eine Unterschrift, kein Programm — und genau deshalb
       * steht es hier: Was nirgends steht, geht unter, und der Termin fällt
       * erst auf, wenn die erste Rechnung nicht ankommt.
       */
      name: 'erechnung',
      label: 'Elektronische Rechnung (Plateforme Agréée)',
      type: 'group',
      admin: {
        description:
          'Ab 1. September 2026 müssen elektronische Rechnungen über eine zugelassene Plattform empfangen werden können. Technisch ist alles da — hier steht, ob die Anmeldung erledigt ist.',
      },
      fields: [
        {
          name: 'stand',
          label: 'Stand der Anmeldung',
          type: 'select',
          defaultValue: 'offen',
          options: [
            { label: 'Noch nichts veranlasst', value: 'offen' },
            { label: 'Anbieter ausgewählt, Vertrag läuft', value: 'beauftragt' },
            { label: 'Angemeldet und einsatzbereit', value: 'registriert' },
          ],
          admin: {
            description:
              'Solange das nicht auf „angemeldet" steht, erinnert die Übersicht im Büro daran.',
          },
        },
        {
          name: 'plattform',
          label: 'Plattform / Anbieter',
          type: 'text',
          admin: { description: 'Name der Plateforme Agréée, über die zugestellt wird.' },
        },
        {
          name: 'kennung',
          label: 'Eigene Kennung auf der Plattform',
          type: 'text',
          admin: {
            description:
              'Die Adresse, unter der der Betrieb dort erreichbar ist — gehört auf die Rechnung an Geschäftskunden.',
          },
        },
        {
          name: 'registriertAm',
          label: 'Angemeldet am',
          type: 'date',
        },
        { name: 'notiz', label: 'Notiz', type: 'textarea' },
      ],
    },
    {
      name: 'wartung',
      label: 'Takt (Automatik)',
      type: 'group',
      admin: {
        description:
          'Der Server sieht selbst regelmäßig nach, ob etwas ansteht — Sicherung, Erinnerung an fällige Belege, Angebote nachfassen, Aufräumen, neue Post. Änderungen hier greifen binnen einer Minute; niemand muss dafür an den Server.',
      },
      // Ohne `row`: In dieser Payload-Fassung bleibt eine Zeile innerhalb einer
      // Gruppe im Admin leer — die Felder darin sind schlicht nicht da. Lieber
      // untereinander und sichtbar als nebeneinander und unauffindbar.
      fields: [
        {
          name: 'aktiv',
          label: 'Automatik läuft',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Abschalten heißt: keine nächtliche Sicherung, keine Erinnerungen, keine Meldung über neue Post.',
          },
        },
        {
          name: 'intervalMinuten',
          label: 'Wartung alle … Minuten',
          type: 'number',
          defaultValue: 15,
          min: 1,
          max: 1440,
          admin: {
            description:
              'Bestimmt nur, wie genau die eingestellte Sicherungszeit getroffen wird — 60 reicht ebenso. Die Arbeiten selbst laufen höchstens einmal am Tag.',
          },
        },
        {
          name: 'postfachMinuten',
          label: 'Postfach alle … Minuten',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 120,
          admin: {
            description:
              'Wie schnell neue Post gemeldet wird. IMAP meldet sich nicht von allein, hier zahlt sich häufiger aus.',
          },
        },
        {
          name: 'mailprotokollMonate',
          label: 'Ausgangsprotokoll aufbewahren (Monate)',
          type: 'number',
          defaultValue: 12,
          min: 1,
          max: 120,
          admin: {
            description:
              'Ältere Einträge räumt die Wartung weg. Nur Kopfdaten, kein Inhalt — aber auch die müssen nicht ewig liegen.',
          },
        },
      ],
    },
    {
      name: 'sicherung',
      label: 'Sicherung (Netzwerkspeicher)',
      type: 'group',
      admin: {
        description:
          'Jede Sicherung enthält die vollständige Datenbank und alle Bilder. Ohne zweiten Ort ist sie nur eine Schönwetter-Kopie — deshalb hier die NAS eintragen. Bedient wird das Ganze im Büro unter Sicherung.',
      },
      fields: [
        {
          name: 'protokoll',
          label: 'Übertragungsweg',
          type: 'select',
          defaultValue: 'smb',
          options: [
            { label: 'Samba/Windows (CIFS) — für die NAS', value: 'smb' },
            { label: 'WebDAV (Nextcloud/ownCloud)', value: 'webdav' },
          ],
        },
        {
          name: 'smbServer',
          label: 'Server (IP oder Name)',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
        },
        {
          name: 'smbFreigabe',
          label: 'Freigabe',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
        },
        {
          name: 'smbPfad',
          label: 'Unterordner in der Freigabe',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll !== 'webdav',
            description: 'Optional, z.B. sicherungen/vh — der Ordner muss auf der NAS schon bestehen.',
          },
        },
        {
          name: 'smbBenutzer',
          label: 'Benutzer',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll !== 'webdav' },
        },
        {
          name: 'smbPasswort',
          label: 'Passwort',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll !== 'webdav',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'webdavUrl',
          label: 'WebDAV-Ordner-Adresse',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
        },
        {
          name: 'webdavBenutzer',
          label: 'Benutzer',
          type: 'text',
          admin: { condition: (_, gesch) => gesch?.protokoll === 'webdav' },
        },
        {
          name: 'webdavPasswort',
          label: 'Passwort',
          type: 'text',
          admin: {
            condition: (_, gesch) => gesch?.protokoll === 'webdav',
            description: 'Bei Nextcloud/ownCloud ein App-Passwort verwenden.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'automatik',
          label: 'Jede Nacht automatisch sichern',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'uhrzeit',
          label: 'Uhrzeit',
          type: 'text',
          defaultValue: '03:30',
          admin: { description: 'Format HH:MM, Zeitzone des Servers.' },
        },
        {
          name: 'behaltenLokal',
          label: 'Kopien auf dem Server behalten',
          type: 'number',
          defaultValue: 7,
          min: 1,
          max: 50,
        },
        {
          name: 'behaltenNas',
          label: 'Kopien auf der NAS behalten',
          type: 'number',
          defaultValue: 30,
          min: 1,
          max: 365,
        },
      ],
    },
    {
      /*
       * Wohin eine Fehlermeldung aus dem Büro geht.
       *
       * **Warum überhaupt.** Was im Betrieb auffällt, fällt beim Arbeiten auf
       * — mitten in der Werkstatt, das Handy in der Hand. Bis daraus eine
       * Nachricht wird, die jemand nachvollziehen kann, ist der Gedanke meist
       * weg. Ein Eintrag im Repository hält ihn dort fest, wo er hingehört:
       * mit Bild, mit Seite, mit Fassung.
       *
       * **Warum das Zugangswort hier steht und nicht im Stack.** Aus
       * demselben Grund wie beim KI-Assistenten: Wer es wechseln muss, soll
       * dafür nicht ausrollen müssen. Es ist ein Wort mit Schreibrecht auf
       * ein Repository und gehört entsprechend eng vergeben.
       *
       * Steht hier nichts, ist das Melden im Büro gar nicht erst zu sehen.
       * Das ist zugleich der Ausschalter.
       */
      name: 'github',
      label: 'Fehlermeldungen (GitHub)',
      type: 'group',
      admin: {
        description:
          'Damit aus „das stimmt hier nicht" ein Eintrag im Repository wird — mit Foto. ' +
          'Leer heißt: Im Büro erscheint kein Melde-Knopf.',
      },
      fields: [
        {
          name: 'repository',
          label: 'Repository',
          type: 'text',
          admin: { description: 'In der Form Besitzer/Name, z.B. DomCim/vh-website' },
        },
        {
          name: 'token',
          label: 'Zugangswort (Fine-grained Token)',
          type: 'text',
          admin: {
            description:
              'Auf github.com unter Settings → Developer settings → Personal access tokens → ' +
              'Fine-grained. Nur dieses eine Repository auswählen und als einzige Berechtigung ' +
              '„Issues: Read and write" geben — mehr braucht es nicht.',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
      ],
    },
    {
      /*
       * Google Kundenrezensionen — die Frage nach der Bewertung.
       *
       * Nach dem Bestellen wird der Kunde gefragt, ob Google ihm später eine
       * kurze Umfrage schicken darf. Sagt er ja, kommt sie ein paar Wochen
       * nach der voraussichtlichen Lieferung; die Antworten zählen als
       * Verkäuferbewertung im Merchant Center.
       *
       * **Warum das hier steht und nicht fest im Code.** Ohne Händler-Kennung
       * passiert gar nichts — kein Skript, kein Aufruf zu Google, kein
       * Hinweis. Wer die Sache abstellen will, leert dieses Feld; es braucht
       * kein Ausrollen dafür.
       *
       * **Warum es die Seite nicht cookiefrei-los macht.** Googles Skript
       * wird erst geladen, wenn der Kunde auf der Bestätigungsseite
       * ausdrücklich zustimmt. Wer nicht klickt, bekommt nichts von Google
       * zu sehen — und der Rest der Website bleibt unberührt.
       */
      name: 'googleReviews',
      label: 'Google Kundenrezensionen',
      type: 'group',
      admin: {
        description:
          'Fragt nach dem Bestellen, ob Google später eine kurze Bewertungsumfrage schicken darf. Ohne Händler-ID passiert nichts — dann wird auch kein Google-Skript geladen.',
      },
      fields: [
        {
          name: 'merchantId',
          label: 'Händler-ID (Merchant Center)',
          type: 'text',
          admin: {
            description:
              'Die Kundennummer aus dem Google Merchant Center, nur Ziffern. Leer = abgeschaltet.',
          },
        },
        {
          name: 'lieferzeitTage',
          label: 'Voraussichtliche Lieferzeit (Tage)',
          type: 'number',
          min: 1,
          max: 365,
          defaultValue: 28,
          admin: {
            description:
              'Google braucht ein Datum, um zu wissen, wann es fragen darf. Hier gehört die übliche Zeit von der Bestellung bis zur Lieferung hin — lieber großzügig: Wer nach der Lieferung gefragt wird, antwortet freundlicher als jemand, der noch wartet.',
          },
        },
      ],
    },
    {
      name: 'facebook',
      label: 'Facebook & Instagram (News-Autopost)',
      type: 'group',
      fields: [
        {
          name: 'pageId',
          label: 'Facebook-Seiten-ID',
          type: 'text',
        },
        {
          name: 'accessToken',
          label: 'Page Access Token',
          type: 'text',
          admin: {
            description:
              'Langlebiger Token einer Meta-App mit pages_manage_posts (für Instagram zusätzlich instagram_content_publish)',
            components: { Field: '/components/admin/GeheimFeld#GeheimFeld' },
          },
        },
        {
          name: 'instagramAccountId',
          label: 'Instagram-Business-Account-ID',
          type: 'text',
          admin: {
            description:
              'ID des mit der Facebook-Seite verknüpften Instagram-Business-Kontos — nur nötig für den Instagram-Autopost',
          },
        },
      ],
    },
  ],
}
