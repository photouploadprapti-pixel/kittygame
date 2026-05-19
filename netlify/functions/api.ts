import type { Handler } from '@netlify/functions'
import { handleApiRequest } from '../../dist/server/api-handler.js'

/**
 * Netlify serverless handler for /api/* routes.
 */
export const handler: Handler = async (event) => {
  const url = new URL(event.rawUrl)
  const path = url.pathname

  let body: Record<string, unknown> = {}
  if (event.body) {
    try {
      body = JSON.parse(event.body) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  try {
    const result = await handleApiRequest({
      method: event.httpMethod,
      pathname: path,
      viewerId: url.searchParams.get('viewerId'),
      body,
    })

    if (!result) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) }
    }

    return {
      statusCode: result.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.body),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    }
  }
}
