import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export function RichText({ data, className }: { data: unknown; className?: string }) {
  if (!data || typeof data !== 'object') return null
  return (
    <LexicalRichText
      data={data as SerializedEditorState}
      className={className ?? 'prose-vh'}
      disableContainer={false}
    />
  )
}
