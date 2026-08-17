import Link from 'next/link'
import React from 'react'

import { mediaAlt, mediaUrl } from '../lib/data'

export function CategoryTile({
  href,
  name,
  description,
  image,
}: {
  href: string
  name: string
  description?: string | null
  image?: unknown
}) {
  return (
    <Link href={href} className="group relative block aspect-[4/3] overflow-hidden bg-dark">
      {image ? (
        <img
          src={mediaUrl(image, 'card')}
          alt={mediaAlt(image, name)}
          className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="tracking-nav text-lg font-semibold uppercase text-white">{name}</h3>
        {description && <p className="mt-1 line-clamp-2 text-sm text-white/80">{description}</p>}
      </div>
    </Link>
  )
}
