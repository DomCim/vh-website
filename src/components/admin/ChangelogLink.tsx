'use client'

import Link from 'next/link'
import React from 'react'

// Link in der Admin-Seitenleiste auf die Changelog-Seite
export default function ChangelogLink() {
  return (
    <Link className="nav__link" href="/admin/changelog" style={{ textDecoration: 'none' }}>
      Changelog
    </Link>
  )
}
