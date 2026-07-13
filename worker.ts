interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

interface Env {
  ASSETS: Fetcher
  AI?: AiBinding
  AI_TEXT_MODEL?: string
  AI_STRUCTURED_MODEL?: string
  AI_API_ENDPOINT?: string
  AI_API_KEY?: string
  AI_MODEL?: string
}

interface CoachRequest {
  messages?: Array<{ role: string; content: string }>
}

interface NutritionRequest {
  description?: string
  serving?: string
  category?: string
  context?: string
}

const DEFAULT_TEXT_MODEL = '@cf/zai-org/glm-4.7-flash'
const FALLBACK_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const DEFAULT_STRUCTURED_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FOOD_CATEGORIES = ['protein', 'carb', 'dairy', 'fruit', 'fat', 'vegetable', 'meal', 'treat'] as const

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

const TRUSTED_APP_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
])

function getAllowedOrigin(request: Request, url: URL): string | null | false {
  const origin = request.headers.get('origin')
  if (!origin) return null
  if (origin === url.origin || TRUSTED_APP_ORIGINS.has(origin)) return origin
  return false
}

function withCors(response: Response, origin: string | null) {
  if (!origin) return response
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', origin)
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS')
  headers.set('access-control-allow-headers', 'Content-Type')
  headers.set('access-control-max-age', '86400')
  headers.append('vary', 'Origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function contentToText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!Array.isArray(value)) return ''
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return ''
    const record = item as Record<string, unknown>
    return typeof record.text === 'string' ? record.text : typeof record.content === 'string' ? record.content : ''
  }).filter(Boolean).join('\n').trim()
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const direct = contentToText(record.response) || contentToText(record.output_text) || contentToText(record.text)
  if (direct) return direct
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined
  return contentToText(first?.message?.content) || contentToText(first?.text)
}

function asStructured(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const candidate = record.response ?? record.result ?? record
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>
  }
  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }
  return null
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

async function runExternalFallback(env: Env, messages: Array<{ role: string; content: string }>) {
  if (!env.AI_API_ENDPOINT || !env.AI_API_KEY) throw new Error('AI is not configured')
  const upstream = await fetch(env.AI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: 0.25,
      messages,
    }),
  })
  if (!upstream.ok) throw new Error(`Upstream AI failed: ${upstream.status}`)
  const data = await upstream.json()
  const text = asText(data)
  if (!text) throw new Error('Empty AI response')
  return text
}


async function runWorkersText(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 700,
) {
  if (!env.AI) throw new Error('Cloudflare Workers AI binding is not configured.')
  const requestedModel = env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL
  const candidates = [...new Set([requestedModel, DEFAULT_TEXT_MODEL, FALLBACK_TEXT_MODEL])]
  let lastError: unknown

  for (const model of candidates) {
    try {
      const result = await env.AI.run(model, {
        messages,
        temperature: 0.25,
        max_tokens: maxTokens,
      })
      const text = asText(result)
      if (!text) throw new Error('Empty AI response')
      return { text, model }
    } catch (error) {
      lastError = error
      console.error('Workers AI model failed', {
        model,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Workers AI models failed')
}

async function handleAiTest(env: Env) {
  if (!env.AI && !(env.AI_API_ENDPOINT && env.AI_API_KEY)) {
    return json({ ok: false, error: 'AI is not configured' }, 503)
  }
  try {
    if (env.AI) {
      const result = await runWorkersText(env, [
        { role: 'system', content: 'أجب بكلمة «تم» فقط.' },
        { role: 'user', content: 'اختبار اتصال.' },
      ], 20)
      return json({ ok: true, text: result.text, provider: 'cloudflare-workers-ai', model: result.model })
    }
    const text = await runExternalFallback(env, [{ role: 'user', content: 'Reply with OK only.' }])
    return json({ ok: true, text, provider: 'external', model: env.AI_MODEL || 'external' })
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'AI model test failed',
    }, 503)
  }
}

async function handleCoach(request: Request, env: Env) {
  let body: CoachRequest
  try {
    body = await request.json() as CoachRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const supplied = Array.isArray(body.messages) ? body.messages.slice(-14) : []
  const messages = supplied
    .filter((item) => item && ['system', 'user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, 6000) }))
  const totalLength = messages.reduce((sum, item) => sum + item.content.length, 0)
  if (!messages.length || totalLength > 22_000) return json({ error: 'Invalid or oversized request' }, 400)

  const safetyPrompt = [
    'أنت العقل الذكي المركزي داخل تطبيق عربي مصري للتغذية وتنظيم اليوم والجيم.',
    'استخدم بيانات المستخدم الفعلية الموجودة في السياق، ولا تدّعي أنك رأيت بيانات غير مذكورة.',
    'ممنوع تمامًا تقديم أسماء تمارين أو حركات أو جداول تدريب أو مجموعات أو تكرارات. مسموح توقيت الجيم، قرار الذهاب، الشدة العامة، الراحة، التغذية، المياه والكرياتين والتعافي.',
    'لست طبيبًا ولا تشخّص الأمراض ولا تصف أدوية ولا تغيّر جرعات علاج. عند أعراض خطرة أو مستمرة وجّه المستخدم للطبيب أو الطوارئ بوضوح.',
    'فرّق بين المعلومة المؤكدة والتقدير، واذكر أن تقدير الطعام تقريبي عند غياب الوزن وطريقة الطهي.',
    'أجب بالعربية المصرية بصورة عملية ومختصرة، وابدأ بأهم قرار الآن ثم السبب ثم خطوة قابلة للتنفيذ.',
    'لا تخوّف المستخدم ولا تجلده ولا تشجعه على تجاهل الألم أو الأعراض.',
  ].join('\n')
  const finalMessages = [{ role: 'system', content: safetyPrompt }, ...messages]

  try {
    if (env.AI) {
      const result = await runWorkersText(env, finalMessages, 700)
      return json({ text: result.text, provider: 'cloudflare-workers-ai', model: result.model })
    }
    const text = await runExternalFallback(env, finalMessages)
    return json({ text, provider: 'external', model: env.AI_MODEL || 'external' })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 503)
  }
}

async function handleNutrition(request: Request, env: Env) {
  if (!env.AI) return json({ error: 'Cloudflare Workers AI binding is not configured.' }, 503)

  let body: NutritionRequest
  try {
    body = await request.json() as NutritionRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const description = String(body.description ?? '').trim().slice(0, 1200)
  const serving = String(body.serving ?? '').trim().slice(0, 250)
  const category = FOOD_CATEGORIES.includes(body.category as typeof FOOD_CATEGORIES[number]) ? body.category! : 'meal'
  const context = String(body.context ?? '').trim().slice(0, 1500)
  if (description.length < 2) return json({ error: 'Food description is required.' }, 400)

  const messages = [
    {
      role: 'system',
      content: [
        'أنت محلل تغذية متخصص في الوجبات المصرية والعربية الشائعة.',
        'قدّر القيم للحصة المذكورة فقط، مع مراعاة الزيت والقلي والخبز والصلصات عندما يذكرها المستخدم.',
        'لا تخترع وزنًا دقيقًا؛ استخدم افتراضًا معقولًا واكتبه في assumptions.',
        'القيم تقريبية وليست تشخيصًا طبيًا. اجعل الاسم والوصف بالعربية.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `وصف الطعام: ${description}\nوصف الحصة: ${serving || 'غير محدد'}\nالتصنيف المبدئي: ${category}\nسياق المستخدم: ${context || 'لا يوجد'}`,
    },
  ]

  const schema = {
    type: 'object',
    properties: {
      nameAr: { type: 'string' },
      servingLabel: { type: 'string' },
      category: { type: 'string', enum: FOOD_CATEGORIES },
      calories: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fats: { type: 'number' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      assumptions: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' },
    },
    required: ['nameAr', 'servingLabel', 'category', 'calories', 'protein', 'carbs', 'fats', 'confidence', 'assumptions', 'note'],
    additionalProperties: false,
  }

  try {
    const result = await env.AI.run(env.AI_STRUCTURED_MODEL || DEFAULT_STRUCTURED_MODEL, {
      messages,
      temperature: 0.15,
      max_tokens: 550,
      response_format: { type: 'json_schema', json_schema: schema },
    })
    const estimate = asStructured(result)
    if (!estimate) throw new Error('The nutrition estimate could not be parsed')

    const normalizedCategory = FOOD_CATEGORIES.includes(estimate.category as typeof FOOD_CATEGORIES[number])
      ? estimate.category
      : category
    return json({
      estimate: {
        nameAr: String(estimate.nameAr || description).slice(0, 140),
        servingLabel: String(estimate.servingLabel || serving || 'حصة متوسطة').slice(0, 120),
        category: normalizedCategory,
        calories: Math.round(clampNumber(estimate.calories, 0, 5000, 500)),
        protein: Math.round(clampNumber(estimate.protein, 0, 400, 20) * 10) / 10,
        carbs: Math.round(clampNumber(estimate.carbs, 0, 700, 50) * 10) / 10,
        fats: Math.round(clampNumber(estimate.fats, 0, 400, 20) * 10) / 10,
        confidence: ['low', 'medium', 'high'].includes(String(estimate.confidence)) ? estimate.confidence : 'medium',
        assumptions: Array.isArray(estimate.assumptions)
          ? estimate.assumptions.map((item) => String(item).slice(0, 180)).slice(0, 5)
          : [],
        note: String(estimate.note || 'تقدير تقريبي قابل للتعديل قبل الحفظ.').slice(0, 300),
      },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Nutrition estimation failed' }, 503)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      const allowedOrigin = getAllowedOrigin(request, url)
      if (allowedOrigin === false) {
        return json({ error: 'Cross-origin request blocked' }, 403)
      }

      if (request.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }), allowedOrigin)
      }

      let response: Response
      if (url.pathname === '/api/ai/status') {
        response = json({
          ready: Boolean(env.AI || (env.AI_API_ENDPOINT && env.AI_API_KEY)),
          provider: env.AI ? 'Cloudflare Workers AI' : 'External proxy',
          textModel: env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
          structuredModel: env.AI_STRUCTURED_MODEL || DEFAULT_STRUCTURED_MODEL,
        })
      } else if (url.pathname === '/api/ai/test') {
        response = request.method === 'POST'
          ? await handleAiTest(env)
          : json({ error: 'Method not allowed. Send a POST request.' }, 405)
      } else if (url.pathname === '/api/coach') {
        response = request.method === 'POST'
          ? await handleCoach(request, env)
          : json({ error: 'Method not allowed. Send a POST request with JSON messages.' }, 405)
      } else if (url.pathname === '/api/nutrition/estimate') {
        response = request.method === 'POST'
          ? await handleNutrition(request, env)
          : json({ error: 'Method not allowed. Send a POST request with a food description.' }, 405)
      } else {
        response = json({ error: 'API route not found' }, 404)
      }

      return withCors(response, allowedOrigin)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
