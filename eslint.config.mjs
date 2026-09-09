import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

/**
 * Schlanke Konfiguration: die Next.js-Regeln plus Ausnahmen für generierte
 * Dateien. `next lint` ist in Next 15 abgekündigt, deshalb läuft das Projekt
 * direkt über die ESLint-CLI (`pnpm lint`).
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      /*
       * Arbeitskopien unter `.claude/worktrees` sind derselbe Quelltext ein
       * zweites Mal. Ohne diese Zeile prüft `pnpm lint` jede vorhandene
       * Arbeitskopie mit und scheitert an Meldungen aus einem Zweig, an dem
       * gerade niemand arbeitet.
       */
      '.claude/**',
      'media/**',
      'next-env.d.ts',
      'src/payload-types.ts',
      'src/app/(payload)/admin/importMap.js',
      'src/migrations/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Payload liefert an vielen Stellen weit verschachtelte Typen; ein
      // gezieltes any ist dort ehrlicher als eine Scheingenauigkeit.
      '@typescript-eslint/no-explicit-any': 'off',
      // Die Bilder kommen fertig zugeschnitten aus der Mediathek
      // (thumbnail/card/large über mediaUrl) — next/image würde sie ein
      // zweites Mal optimieren, ohne etwas zu gewinnen.
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
