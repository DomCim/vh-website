import type { CollectionAfterChangeHook } from 'payload'

import { getIntegrations } from './settings'

/**
 * Postet einen veröffentlichten News-Beitrag automatisch auf die Facebook-Seite.
 *
 * Konfiguration: Admin → Integrationen → Facebook (Seiten-ID + Page Access
 * Token einer Meta-App mit `pages_manage_posts`); Fallback sind die
 * Umgebungsvariablen FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN.
 *
 * Gepostet wird nur, wenn:
 *  - der Beitrag den Status "veröffentlicht" hat,
 *  - die Checkbox "Beim Veröffentlichen auf Facebook posten" gesetzt ist,
 *  - und noch keine facebookPostId existiert (kein Doppelpost).
 */
const GRAPH = 'https://graph.facebook.com/v21.0'

/** Postet Bild + Caption auf das verknüpfte Instagram-Business-Konto (2-Schritt: Container → Publish) */
async function postToInstagram(
  igAccountId: string,
  token: string,
  imageUrl: string,
  caption: string,
): Promise<{ postId?: string; error?: string }> {
  try {
    const containerBody = new URLSearchParams()
    containerBody.set('access_token', token)
    containerBody.set('image_url', imageUrl)
    containerBody.set('caption', caption)
    const containerRes = await fetch(`${GRAPH}/${igAccountId}/media`, {
      method: 'POST',
      body: containerBody,
    })
    const container = (await containerRes.json()) as { id?: string; error?: { message?: string } }
    if (!containerRes.ok || !container.id) {
      return { error: container.error?.message || `HTTP ${containerRes.status}` }
    }

    const publishBody = new URLSearchParams()
    publishBody.set('access_token', token)
    publishBody.set('creation_id', container.id)
    const publishRes = await fetch(`${GRAPH}/${igAccountId}/media_publish`, {
      method: 'POST',
      body: publishBody,
    })
    const published = (await publishRes.json()) as { id?: string; error?: { message?: string } }
    if (!publishRes.ok || !published.id) {
      return { error: published.error?.message || `HTTP ${publishRes.status}` }
    }
    return { postId: published.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

export const postNewsToFacebook: CollectionAfterChangeHook = async ({
  doc,
  req,
  context,
}) => {
  // Endlosschleife verhindern: der Hook aktualisiert das Dokument selbst
  if (context?.skipFacebookPost) return doc

  const { facebook } = await getIntegrations(req.payload)
  const pageId = facebook.pageId
  const token = facebook.accessToken

  if (!token) return doc
  if (doc._status !== 'published') return doc

  const wantsFacebook = Boolean(doc.postToFacebook && pageId && !doc.facebookPostId)
  const wantsInstagram = Boolean(
    doc.postToInstagram && facebook.instagramAccountId && !doc.instagramPostId,
  )
  if (!wantsFacebook && !wantsInstagram) return doc

  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || ''
  const link = `${serverURL}/de/news/${doc.slug}`
  const message = [doc.title, '', doc.excerpt || '', '', link]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Bild-URL des Titelbilds auflösen (falls vorhanden)
  let imageUrl: string | undefined
  try {
    const coverId = typeof doc.coverImage === 'object' ? doc.coverImage?.id : doc.coverImage
    if (coverId) {
      const media = await req.payload.findByID({ collection: 'media', id: coverId })
      if (media?.url) {
        imageUrl = media.url.startsWith('http') ? media.url : `${serverURL}${media.url}`
      }
    }
  } catch {
    // Bild ist optional für den FB-Post, Pflicht für Instagram
  }

  const update: Record<string, string | undefined> = {}

  // ── Facebook ──────────────────────────────────────────────────────────────
  if (wantsFacebook) {
    let postId: string | undefined
    let postError: string | undefined
    try {
      // Mit Bild → /photos (Bild + Text), ohne Bild → /feed (Text + Link)
      const endpoint = imageUrl ? `${GRAPH}/${pageId}/photos` : `${GRAPH}/${pageId}/feed`
      const body = new URLSearchParams()
      body.set('access_token', token)
      if (imageUrl) {
        body.set('url', imageUrl)
        body.set('caption', message)
      } else {
        body.set('message', message)
        body.set('link', link)
      }
      const res = await fetch(endpoint, { method: 'POST', body })
      const data = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } }
      if (!res.ok || data.error) {
        postError = data.error?.message || `HTTP ${res.status}`
      } else {
        postId = data.post_id || data.id
      }
    } catch (err) {
      postError = err instanceof Error ? err.message : 'Unbekannter Fehler'
    }
    update.facebookPostId = postId
    update.facebookPostError = postError
    if (postError) req.payload.logger.error(`Facebook-Post fehlgeschlagen: ${postError}`)
    else if (postId) req.payload.logger.info(`News auf Facebook gepostet: ${postId}`)
  }

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (wantsInstagram) {
    if (!imageUrl) {
      update.instagramPostError = 'Instagram benötigt ein Titelbild'
    } else {
      // Instagram-Captions können keine klickbaren Links — Link ans Ende, Verweis im Profil
      const igCaption = [doc.title, '', doc.excerpt || '', '', `Mehr auf ${serverURL}`]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const result = await postToInstagram(
        facebook.instagramAccountId!,
        token,
        imageUrl,
        igCaption,
      )
      update.instagramPostId = result.postId
      update.instagramPostError = result.error
      if (result.error) req.payload.logger.error(`Instagram-Post fehlgeschlagen: ${result.error}`)
      else if (result.postId) req.payload.logger.info(`News auf Instagram gepostet: ${result.postId}`)
    }
  }

  // Ergebnis am Beitrag speichern, damit es im Admin sichtbar ist
  try {
    await req.payload.update({
      collection: 'news',
      id: doc.id,
      data: update,
      context: { skipFacebookPost: true },
    })
  } catch (err) {
    req.payload.logger.error({ err }, 'Social-Media-Status konnte nicht gespeichert werden')
  }

  return doc
}
