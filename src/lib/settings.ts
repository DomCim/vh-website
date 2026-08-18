import type { Payload } from 'payload'

/**
 * Ein Postfach, das im Büro gelesen wird.
 *
 * Vincent hat mehrere Adressen — info@ für Kundschaft, dazu die Adresse, unter
 * der die Website verschickt. Deshalb eine Liste und nicht ein festes Konto.
 */
export type MailboxKonfiguration = {
  id: string
  label: string
  address: string
  isDefault: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  user: string
  pass: string
  sentMailbox: string
  trashMailbox: string
  signature?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
}

export type ResolvedIntegrations = {
  email: {
    smtpHost?: string
    smtpPort: number
    smtpUser?: string
    smtpPass?: string
    fromAddress: string
    fromName: string
    notificationEmail?: string
  }
  mailboxes: MailboxKonfiguration[]
  stripe: {
    secretKey?: string
    webhookSecret?: string
  }
  paypal: {
    clientId?: string
    clientSecret?: string
    sandbox: boolean
  }
  facebook: {
    pageId?: string
    accessToken?: string
    instagramAccountId?: string
  }
  mcp: {
    apiKey?: string
    readonlyKey?: string
  }
  anthropic: {
    apiKey?: string
    model: string
  }
}

const val = (dbValue: unknown, envValue: string | undefined): string | undefined => {
  if (typeof dbValue === 'string' && dbValue.trim() !== '') return dbValue.trim()
  if (typeof dbValue === 'number') return String(dbValue)
  return envValue || undefined
}

/**
 * Liest die Integrations-Einstellungen aus dem Admin-Backend;
 * leere Felder fallen auf Umgebungsvariablen zurück.
 */
export async function getIntegrations(payload: Payload): Promise<ResolvedIntegrations> {
  let doc: Record<string, any> = {}
  try {
    doc = (await payload.findGlobal({ slug: 'integrations', depth: 0 })) as Record<string, any>
  } catch {
    // Global existiert noch nicht (z.B. vor der ersten Migration) → nur env
  }

  const smtpPort = val(doc?.email?.smtpPort, process.env.SMTP_PORT)

  return {
    email: {
      smtpHost: val(doc?.email?.smtpHost, process.env.SMTP_HOST),
      smtpPort: smtpPort ? Number(smtpPort) : 587,
      smtpUser: val(doc?.email?.smtpUser, process.env.SMTP_USER),
      smtpPass: val(doc?.email?.smtpPass, process.env.SMTP_PASS),
      fromAddress: val(doc?.email?.fromAddress, process.env.EMAIL_FROM) || 'noreply@localhost',
      fromName: val(doc?.email?.fromName, process.env.EMAIL_FROM_NAME) || 'Vincent Hellmann',
      notificationEmail: val(doc?.email?.notificationEmail, process.env.NOTIFICATION_EMAIL),
    },
    mailboxes: ((doc?.mailboxes ?? []) as Record<string, any>[])
      .filter((m) => m?.imapHost && m?.user && m?.pass && m?.address)
      .map((m, i) => ({
        id: String(m.id ?? i),
        label: m.label || m.address,
        address: m.address,
        isDefault: Boolean(m.isDefault),
        imapHost: m.imapHost,
        imapPort: Number(m.imapPort) || 993,
        imapSecure: m.imapSecure !== false,
        user: m.user,
        pass: m.pass,
        sentMailbox: m.sentMailbox || 'Sent',
        trashMailbox: m.trashMailbox || 'Trash',
        signature: m.signature || undefined,
        smtpHost: m.smtpHost || undefined,
        smtpPort: m.smtpPort ? Number(m.smtpPort) : undefined,
        smtpUser: m.smtpUser || undefined,
        smtpPass: m.smtpPass || undefined,
      })),
    stripe: {
      secretKey: val(doc?.stripe?.secretKey, process.env.STRIPE_SECRET_KEY),
      webhookSecret: val(doc?.stripe?.webhookSecret, process.env.STRIPE_WEBHOOK_SECRET),
    },
    paypal: {
      clientId: val(doc?.paypal?.clientId, process.env.PAYPAL_CLIENT_ID),
      clientSecret: val(doc?.paypal?.clientSecret, process.env.PAYPAL_CLIENT_SECRET),
      sandbox: Boolean(doc?.paypal?.sandbox ?? process.env.PAYPAL_SANDBOX === 'true'),
    },
    facebook: {
      pageId: val(doc?.facebook?.pageId, process.env.FB_PAGE_ID),
      accessToken: val(doc?.facebook?.accessToken, process.env.FB_PAGE_ACCESS_TOKEN),
      instagramAccountId: val(doc?.facebook?.instagramAccountId, process.env.IG_ACCOUNT_ID),
    },
    mcp: {
      apiKey: val(doc?.mcp?.apiKey, process.env.MCP_API_KEY),
      readonlyKey: val(doc?.mcp?.readonlyKey, process.env.MCP_READONLY_API_KEY),
    },
    anthropic: {
      apiKey: val(doc?.anthropic?.apiKey, process.env.ANTHROPIC_API_KEY),
      model: val(doc?.anthropic?.model, process.env.ANTHROPIC_MODEL) || 'claude-opus-5',
    },
  }
}

/**
 * Firmenangaben für Rechnungen und Bestellmails — an einer Stelle
 * zusammengefasst, damit die Pflichtangaben überall dieselben sind.
 */
export function firmenAngaben(settings: Record<string, any> | null | undefined) {
  const c = settings?.company ?? {}
  return {
    name: settings?.siteName,
    legalName: c.legalName,
    legalForm: c.legalForm,
    shareCapital: c.shareCapital,
    rcsNumber: c.rcsNumber,
    rcsCity: c.rcsCity,
    address: c.address,
    siret: c.siret,
    vatId: c.vatId,
    vatRate: c.vatRate,
    paymentTerms: c.paymentTerms,
    latePaymentNote: c.latePaymentNote,
    iban: c.iban,
    bic: c.bic,
    vatOnDebits: c.vatOnDebits,
  }
}
