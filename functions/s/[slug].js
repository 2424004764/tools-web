import { initDatabase } from '../utils/db.js'
import { LinksService } from '../services/linksService.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const slug = url.pathname.replace('/s/', '')

  if (!slug) {
    return new Response('Not Found', { status: 404 })
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return new Response('Server Error', { status: 500 })
  }

  try {
    const linksService = new LinksService(dbInit.db)
    const result = await linksService.redirect(slug)

    if (!result.success) {
      return new Response('Not Found', { status: 404 })
    }

    return Response.redirect(result.data.url, 302)
  } catch (error) {
    console.error('Redirect error:', error)
    return new Response('Server Error', { status: 500 })
  }
}
