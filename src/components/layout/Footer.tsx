import Link from 'next/link'
import React from 'react'

import type { Locale } from '../../lib/i18n'
import { NewsletterAnmeldung, type NewsletterDict } from '../NewsletterAnmeldung'

type Settings = {
  siteName?: string | null
  contact?: {
    phone?: string | null
    email?: string | null
    company?: string | null
    address?: string | null
  } | null
  social?: {
    facebook?: string | null
    instagram?: string | null
    youtube?: string | null
  } | null
} | null

type Dict = {
  newsletter: NewsletterDict
  nav: { account: string }
  footer: {
    impressum: string
    datenschutz: string
    agb: string
    widerruf: string
    versandZahlung: string
    followUs: string
    contact: string
  }
}

function SocialIcon({ href, label, path }: { href: string; label: string; path: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="border-dark-soft hover:border-paper flex h-10 w-10 items-center justify-center rounded-full border text-white/80 transition-colors hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d={path} />
      </svg>
    </a>
  )
}

export function Footer({
  locale,
  settings,
  dict,
}: {
  locale: Locale
  settings: Settings
  dict: Dict
}) {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-dark text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          {/* Logo invertiert für den dunklen Hintergrund */}
          <img src="/logo.svg" alt="Vincent Hellmann" className="mb-4 h-4 w-auto invert" />

          {settings?.contact?.company && <p className="text-sm">{settings.contact.company}</p>}
          {settings?.contact?.address && (
            <p className="text-sm whitespace-pre-line">{settings.contact.address}</p>
          )}
        </div>

        <div>
          <p className="tracking-nav mb-4 text-xs font-semibold uppercase text-white">
            {dict.footer.contact}
          </p>
          {settings?.contact?.phone && (
            <p className="text-sm">
              <a href={`tel:${settings.contact.phone.replace(/\s/g, '')}`} className="hover:text-white">
                {settings.contact.phone}
              </a>
            </p>
          )}
          {settings?.contact?.email && (
            <p className="text-sm">
              <a href={`mailto:${settings.contact.email}`} className="hover:text-white">
                {settings.contact.email}
              </a>
            </p>
          )}
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <Link href={`/${locale}/kontakt/impressum`} className="hover:text-white">
              {dict.footer.impressum}
            </Link>
            <Link href={`/${locale}/kontakt/datenschutzerklaerung`} className="hover:text-white">
              {dict.footer.datenschutz}
            </Link>
            <Link href={`/${locale}/kontakt/agb`} className="hover:text-white">
              {dict.footer.agb}
            </Link>
            <Link href={`/${locale}/kontakt/widerruf`} className="hover:text-white">
              {dict.footer.widerruf}
            </Link>
            <Link href={`/${locale}/kontakt/versand-zahlung`} className="hover:text-white">
              {dict.footer.versandZahlung}
            </Link>
            {/* Zweiter Weg ins Kundenportal: Im Kopf steht es als Zeichen, hier
                als Wort — wer nach „meine Bestellung" sucht, schaut unten. */}
            <Link href={`/${locale}/konto`} className="hover:text-white">
              {dict.nav.account}
            </Link>
          </div>
        </div>

        <div>
          <p className="tracking-nav mb-4 text-xs font-semibold uppercase text-white">
            {dict.footer.followUs}
          </p>
          <div className="flex gap-3">
            {settings?.social?.facebook && (
              <SocialIcon
                href={settings.social.facebook}
                label="Facebook"
                path="M13.5 9H16l.5-3h-3V4.5c0-.9.3-1.5 1.6-1.5H17V.2C16.7.2 15.6 0 14.4 0 11.9 0 10 1.7 10 4.7V6H7v3h3v9h3.5V9z"
              />
            )}
            {settings?.social?.instagram && (
              <SocialIcon
                href={settings.social.instagram}
                label="Instagram"
                path="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.1a6.7 6.7 0 100 13.4 6.7 6.7 0 000-13.4zm0 11a4.3 4.3 0 110-8.6 4.3 4.3 0 010 8.6zm8.5-11.3a1.6 1.6 0 11-3.2 0 1.6 1.6 0 013.2 0z"
              />
            )}
            {settings?.social?.youtube && (
              <SocialIcon
                href={settings.social.youtube}
                label="YouTube"
                path="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.2 31.2 0 000 12c0 1.9.2 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.3-1.9.5-3.9.5-5.8 0-1.9-.2-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z"
              />
            )}
          </div>

          {/* Die Liste der Interessierten ist bei Einzelstücken das
              wertvollste Gut — deshalb steht sie hier und nicht versteckt. */}
          <p className="tracking-nav mt-8 mb-1 text-xs font-semibold uppercase text-white">
            {dict.newsletter.title}
          </p>
          <p className="text-sm text-white/60">{dict.newsletter.intro}</p>
          <NewsletterAnmeldung locale={locale} dict={dict.newsletter} kompakt />
        </div>
      </div>

      <div className="border-dark-soft border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6">
          <p>
            © {year} {settings?.siteName || 'Vincent Hellmann'}
          </p>
          <a href="#top" className="hover:text-white">
            ↑
          </a>
        </div>
      </div>
    </footer>
  )
}
