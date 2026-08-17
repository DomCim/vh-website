/* Payload-Admin — Standard-Scaffold; ergänzt nur um PWA-Metadata */
import type { Metadata, Viewport } from 'next'

import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.scss'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

// Macht den Admin als App installierbar ("Zum Home-Bildschirm")
export const metadata: Metadata = {
  applicationName: 'VH Verwaltung',
  manifest: '/admin-manifest.webmanifest',
  icons: {
    apple: '/admin-icon-180.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: 'VH Verwaltung',
  },
}

export const viewport: Viewport = {
  themeColor: '#191919',
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
