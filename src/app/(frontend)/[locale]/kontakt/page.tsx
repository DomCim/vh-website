import { notFound } from 'next/navigation'
import React from 'react'

import { ContactForm } from '../../../../components/ContactForm'
import { Reveal } from '../../../../components/motion/Reveal'
import { getSiteSettings } from '../../../../lib/data'
import { isLocale, t } from '../../../../lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = t(locale)

  const settings = await getSiteSettings(locale)

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="tracking-nav text-ink mb-4 text-2xl font-semibold uppercase">
          {dict.contact.title}
        </h1>
        <p className="text-ink-soft max-w-2xl">{dict.contact.intro}</p>
      </Reveal>

      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <Reveal>
          <ContactForm
            locale={locale}
            labels={{
              name: dict.contact.name,
              email: dict.contact.email,
              phone: dict.contact.phone,
              message: dict.contact.message,
              send: dict.contact.send,
              success: dict.contact.success,
              error: dict.contact.error,
            }}
          />
        </Reveal>

        <Reveal delay={0.15}>
          <div className="bg-paper-soft p-8">
            {settings?.contact?.company && (
              <p className="tracking-nav text-ink mb-2 text-sm font-semibold uppercase">
                {settings.contact.company}
              </p>
            )}
            {settings?.contact?.address && (
              <p className="text-ink-soft text-sm whitespace-pre-line">{settings.contact.address}</p>
            )}
            <div className="mt-6 space-y-1 text-sm">
              {settings?.contact?.phone && (
                <p>
                  <span className="text-ink-soft">{dict.contact.phoneLabel}: </span>
                  <a
                    href={`tel:${settings.contact.phone.replace(/\s/g, '')}`}
                    className="text-ink hover:text-bronze"
                  >
                    {settings.contact.phone}
                  </a>
                </p>
              )}
              {settings?.contact?.email && (
                <p>
                  <span className="text-ink-soft">{dict.contact.emailLabel}: </span>
                  <a href={`mailto:${settings.contact.email}`} className="text-ink hover:text-bronze">
                    {settings.contact.email}
                  </a>
                </p>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
