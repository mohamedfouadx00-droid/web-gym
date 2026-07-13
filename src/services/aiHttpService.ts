import { Capacitor, CapacitorHttp } from '@capacitor/core'

export class AiHttpError extends Error {
  readonly status?: number
  readonly code: 'timeout' | 'network' | 'http' | 'invalid-response'
  readonly details?: string

  constructor(
    message: string,
    options: {
      status?: number
      code?: AiHttpError['code']
      details?: string
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'AiHttpError'
    this.status = options.status
    this.code = options.code ?? 'network'
    this.details = options.details
  }
}

function normalizeResponseData<T>(value: unknown): T {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) throw new AiHttpError('خدمة الذكاء الاصطناعي أعادت ردًا فارغًا.', { code: 'invalid-response' })
    if (/^<!doctype html|^<html/i.test(trimmed)) {
      throw new AiHttpError('الخادم أعاد صفحة الموقع بدل مسار الذكاء الاصطناعي.', {
        code: 'invalid-response',
        details: 'تأكد أن run_worker_first يحتوي على /api/* ثم أعد نشر Cloudflare.',
      })
    }
    try {
      return JSON.parse(trimmed) as T
    } catch (error) {
      throw new AiHttpError('خدمة الذكاء الاصطناعي أعادت صيغة غير مفهومة.', {
        code: 'invalid-response',
        details: trimmed.slice(0, 240),
        cause: error,
      })
    }
  }

  if (!value || typeof value !== 'object') {
    throw new AiHttpError('خدمة الذكاء الاصطناعي أعادت ردًا غير صالح.', { code: 'invalid-response' })
  }
  return value as T
}

function extractErrorDetail(value: unknown): string {
  try {
    const data = normalizeResponseData<{ error?: string; message?: string }>(value)
    return String(data.error || data.message || '').trim()
  } catch {
    return typeof value === 'string' ? value.trim().slice(0, 240) : ''
  }
}

export async function requestAiJson<T>(options: {
  url: string
  method?: 'GET' | 'POST'
  data?: unknown
  timeoutMs?: number
}): Promise<T> {
  const url = options.url.trim()
  if (!url) throw new AiHttpError('رابط خدمة الذكاء الاصطناعي غير موجود.', { code: 'network' })
  const method = options.method ?? 'GET'
  const timeoutMs = options.timeoutMs ?? 60_000

  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: options.data,
        connectTimeout: Math.min(timeoutMs, 20_000),
        readTimeout: timeoutMs,
      })

      if (response.status < 200 || response.status >= 300) {
        const detail = extractErrorDetail(response.data)
        throw new AiHttpError(
          detail || `فشلت خدمة الذكاء الاصطناعي بكود ${response.status}.`,
          { status: response.status, code: 'http', details: detail },
        )
      }
      return normalizeResponseData<T>(response.data)
    } catch (error) {
      if (error instanceof AiHttpError) throw error
      const message = error instanceof Error ? error.message : String(error)
      const timeout = /timeout|timed out/i.test(message)
      throw new AiHttpError(
        timeout ? 'انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي.' : 'تعذر الوصول إلى خدمة الذكاء الاصطناعي من الهاتف.',
        { code: timeout ? 'timeout' : 'network', details: message, cause: error },
      )
    }
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(options.data ?? {}) : undefined,
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    const raw = await response.text()
    if (!response.ok) {
      const detail = extractErrorDetail(raw)
      throw new AiHttpError(
        detail || `فشلت خدمة الذكاء الاصطناعي بكود ${response.status}.`,
        { status: response.status, code: 'http', details: detail },
      )
    }
    return normalizeResponseData<T>(raw)
  } catch (error) {
    if (error instanceof AiHttpError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiHttpError('انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي.', {
        code: 'timeout',
        cause: error,
      })
    }
    throw new AiHttpError('تعذر الوصول إلى خدمة الذكاء الاصطناعي.', {
      code: 'network',
      details: error instanceof Error ? error.message : String(error),
      cause: error,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function describeAiHttpError(error: unknown): string {
  if (!(error instanceof AiHttpError)) {
    return error instanceof Error ? error.message : 'خطأ غير معروف في الاتصال.'
  }
  if (error.status === 403) return 'Cloudflare رفض الطلب. أعد نشر worker.ts المصحح.'
  if (error.status === 404) return 'مسار الذكاء الاصطناعي غير موجود على Cloudflare.'
  if (error.status === 405) return 'الرابط صحيح لكن تم استدعاؤه بطريقة غير صحيحة.'
  if (error.status === 429) return 'تم الوصول لحد الاستخدام مؤقتًا. جرّب بعد قليل.'
  if (error.status && error.status >= 500) return `الخدمة متاحة لكن الموديل فشل مؤقتًا (${error.status}).`
  if (error.code === 'timeout') return 'الاتصال استغرق وقتًا طويلًا وانتهت المهلة.'
  if (error.code === 'invalid-response') return error.message
  return error.message || 'تعذر الوصول إلى خدمة الذكاء الاصطناعي.'
}
