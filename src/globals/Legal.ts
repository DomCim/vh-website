import type { GlobalConfig } from 'payload'

import { admins, anyone } from '../access'

export const Legal: GlobalConfig = {
  slug: 'legal',
  label: 'Rechtliches',
  admin: {
    group: 'Inhalte',
  },
  access: {
    read: anyone,
    update: admins,
  },
  fields: [
    {
      name: 'impressum',
      label: 'Impressum',
      type: 'richText',
      localized: true,
    },
    {
      name: 'datenschutz',
      label: 'Datenschutzerklärung',
      type: 'richText',
      localized: true,
    },
    {
      name: 'agb',
      label: 'AGB / CGV',
      type: 'richText',
      localized: true,
    },
    {
      name: 'widerruf',
      label: 'Widerrufsbelehrung',
      type: 'richText',
      localized: true,
      admin: {
        description:
          'Pflicht im Verkauf an Verbraucher: 14 Tage Widerrufsfrist, Fristbeginn, Folgen. Wichtig für die Werkstatt ist der zweite Teil — bei einem nach Kundenvorgabe gefertigten Einzelstück besteht kein Widerrufsrecht. Das muss hier ausdrücklich stehen, sonst gilt es doch.',
      },
    },
    {
      name: 'widerrufsformular',
      label: 'Muster-Widerrufsformular',
      type: 'richText',
      localized: true,
      admin: {
        description:
          'Das Formular muss zur Verfügung stehen, auch wenn es kaum jemand benutzt. Es steht auf der Widerrufsseite unter der Belehrung.',
      },
    },
    {
      name: 'versandZahlung',
      label: 'Versand & Zahlung',
      type: 'richText',
      localized: true,
      admin: {
        description:
          'Lieferzeiten, Versandkosten, Liefergebiete, Zahlungsarten. Muss vor dem Bestellen erreichbar sein.',
      },
    },
  ],
}
