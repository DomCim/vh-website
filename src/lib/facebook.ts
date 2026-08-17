import type { CollectionAfterChangeHook } from 'payload'

/**
 * Postet einen veröffentlichten News-Beitrag automatisch auf die Facebook-Seite.
 *
 * Voraussetzungen (env):
 *  - FB_PAGE_ID: ID der Facebook-Seite
 *  - FB_PAGE_ACCESS_TOKEN: langlebiger Page Access Token einer Meta-App
 *    mit der Berechtigung `pages_manage_posts`
 *
 * Gepostet wird nur, wenn:
 *  - der Beitrag den Status "veröffentlicht" hat,
 *  - die Checkbox "Beim Veröffentlichen auf Facebook posten" gesetzt ist,
 *  - und noch keine facebookPostId existiert (kein Doppelpost).
 */
export const postNewsToFacebook: CollectionAfterChangeHook = async ({
  doc,
  req,
  context,
}) => {
  // Endlosschleife verhindern: der Hook aktualisiert das Dokument selbst
  if (context?.skipFacebookPost) return doc

  const pageId = process.env.FB_PAGE_ID
  const token = process.env.FB_PAGE_ACCESS_TOKEN

  if (!pageId || !token) return doc
  if (doc._status !== 'published') return doc
  if (!doc.postToFacebook) return doc
  if (doc.facebookPostId) return doc

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
    // Bild ist optional für den Post
  }

  let postId: string | undefined
  let postError: string | undefined

  try {
    // Mit Bild → /photos (Bild + Text), ohne Bild → /feed (Text + Link)
    const endpoint = imageUrl
      ? `https://graph.facebook.com/v21.0/${pageId}/photos`
      : `https://graph.facebook.com/v21.0/${pageId}/feed`

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

  // Ergebnis am Beitrag speichern, damit es im Admin sichtbar ist
  try {
    await req.payload.update({
      collection: 'news',
      id: doc.id,
      data: {
        facebookPostId: postId,
        facebookPostError: postError,
      },
      context: { skipFacebookPost: true },
    })
  } catch (err) {
    req.payload.logger.error({ err }, 'Facebook-Status konnte nicht gespeichert werden')
  }

  if (postError) {
    req.payload.logger.error(`Facebook-Post fehlgeschlagen: ${postError}`)
  } else if (postId) {
    req.payload.logger.info(`News auf Facebook gepostet: ${postId}`)
  }

  return doc
}
