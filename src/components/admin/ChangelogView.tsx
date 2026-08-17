import fs from 'fs'
import path from 'path'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

// Sehr kleiner Markdown-Renderer — reicht für Überschriften, Listen und Fettung
function renderMarkdown(md: string): React.ReactNode[] {
  const bold = (text: string, key: number) => {
    const parts = text.split(/\*\*(.+?)\*\*/g)
    return (
      <React.Fragment key={key}>
        {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}
      </React.Fragment>
    )
  }

  const nodes: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  let key = 0

  const flushList = () => {
    if (list.length > 0) {
      nodes.push(
        <ul key={key++} style={{ margin: '0 0 1.5rem', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
          {list}
        </ul>,
      )
      list = []
    }
  }

  for (const line of md.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      list.push(
        <li key={key++} style={{ marginBottom: '0.35rem' }}>
          {bold(trimmed.slice(2), key++)}
        </li>,
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      nodes.push(
        <h2 key={key++} style={{ margin: '2rem 0 0.75rem', fontSize: '1.25rem' }}>
          {bold(trimmed.slice(3), key++)}
        </h2>,
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      nodes.push(
        <h1 key={key++} style={{ margin: '0 0 1rem', fontSize: '1.75rem' }}>
          {bold(trimmed.slice(2), key++)}
        </h1>,
      )
    } else if (trimmed.length > 0) {
      flushList()
      nodes.push(
        <p key={key++} style={{ margin: '0 0 1rem', lineHeight: 1.6 }}>
          {bold(trimmed, key++)}
        </p>,
      )
    }
  }
  flushList()
  return nodes
}

export default function ChangelogView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  // Nur für angemeldete Admin-Benutzer
  if (!initPageResult.req.user) {
    redirect(`${initPageResult.req.payload.config.routes.admin}/login`)
  }

  let markdown = 'Kein Changelog gefunden.'
  try {
    markdown = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8')
  } catch {
    // Datei fehlt — Hinweis oben bleibt stehen
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div style={{ maxWidth: '48rem', paddingBottom: '3rem' }}>{renderMarkdown(markdown)}</div>
      </Gutter>
    </DefaultTemplate>
  )
}
