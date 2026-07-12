interface Env {
  ASSETS: Fetcher
  AI_API_ENDPOINT?: string
  AI_API_KEY?: string
  AI_MODEL?: string
}

interface CoachRequest {
  model?: string
  messages?: Array<{ role: string; content: string }>
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/coach') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

      const origin = request.headers.get('origin')
      if (origin && origin !== url.origin) return json({ error: 'Cross-origin request blocked' }, 403)
      if (!env.AI_API_ENDPOINT || !env.AI_API_KEY) {
        return json({ error: 'AI proxy is not configured on Cloudflare.' }, 503)
      }

      let body: CoachRequest
      try {
        body = await request.json() as CoachRequest
      } catch {
        return json({ error: 'Invalid JSON body' }, 400)
      }

      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : []
      const totalLength = messages.reduce((sum, item) => sum + String(item.content ?? '').length, 0)
      if (!messages.length || totalLength > 12_000) {
        return json({ error: 'Invalid or oversized request' }, 400)
      }

      const upstream = await fetch(env.AI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AI_MODEL || body.model,
          temperature: 0.35,
          messages,
        }),
      })

      const responseText = await upstream.text()
      return new Response(responseText, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8' },
      })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
