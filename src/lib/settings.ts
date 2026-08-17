import type { Payload } from 'payload'

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
  stripe: {
    secretKey?: string
    webhookSecret?: string
  }
  facebook: {
    pageId?: string
    accessToken?: string
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
    stripe: {
      secretKey: val(doc?.stripe?.secretKey, process.env.STRIPE_SECRET_KEY),
      webhookSecret: val(doc?.stripe?.webhookSecret, process.env.STRIPE_WEBHOOK_SECRET),
    },
    facebook: {
      pageId: val(doc?.facebook?.pageId, process.env.FB_PAGE_ID),
      accessToken: val(doc?.facebook?.accessToken, process.env.FB_PAGE_ACCESS_TOKEN),
    },
  }
}
