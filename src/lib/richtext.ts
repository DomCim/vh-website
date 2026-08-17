/** Wandelt einfachen Text (Absätze durch Leerzeilen getrennt) in Lexical-RichText um */
export function richText(text: string) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== '')
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: (paragraphs.length > 0 ? paragraphs : ['']).map((p) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        textFormat: 0,
        children: [
          {
            type: 'text',
            text: p.trim(),
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      })),
    },
  }
}
