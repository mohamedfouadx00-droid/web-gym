export interface PrayerTimes {
  Fajr: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
}

export interface PrayerTimesResult {
  timings: PrayerTimes
  cityLabel: string
  latitude: number
  longitude: number
  fetchedAt: string
  source?: 'network' | 'offline'
}

interface StoredLocation {
  latitude: number
  longitude: number
  savedAt: string
}

const CACHE_KEY = 'gym.prayerTimes.v2'
const LOCATION_KEY = 'gym.prayerLocation.v1'

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getStoredPrayerTimes(): (PrayerTimesResult & { dayKey?: string }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) as PrayerTimesResult & { dayKey?: string } : null
  } catch {
    return null
  }
}

export function getCachedPrayerTimes(): PrayerTimesResult | null {
  const parsed = getStoredPrayerTimes()
  if (!parsed || parsed.dayKey !== todayKey()) return null
  return parsed
}

function saveCache(value: PrayerTimesResult) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...value, dayKey: todayKey() }))
  saveLocation(value.latitude, value.longitude)
}

function saveLocation(latitude: number, longitude: number) {
  const value: StoredLocation = { latitude, longitude, savedAt: new Date().toISOString() }
  localStorage.setItem(LOCATION_KEY, JSON.stringify(value))
}

function getStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (raw) return JSON.parse(raw) as StoredLocation
    const old = getStoredPrayerTimes()
    return old ? { latitude: old.latitude, longitude: old.longitude, savedAt: old.fetchedAt } : null
  } catch {
    return null
  }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation-not-supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60 * 60 * 1000,
    })
  })
}

function cleanTime(value: string): string {
  return value.split(' ')[0]
}

function degreesToRadians(value: number) {
  return value * Math.PI / 180
}

function radiansToDegrees(value: number) {
  return value * 180 / Math.PI
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

function normalizeHours(value: number) {
  return ((value % 24) + 24) % 24
}

function julianDate(year: number, month: number, day: number) {
  let adjustedYear = year
  let adjustedMonth = month
  if (adjustedMonth <= 2) {
    adjustedYear -= 1
    adjustedMonth += 12
  }
  const a = Math.floor(adjustedYear / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (adjustedYear + 4716))
    + Math.floor(30.6001 * (adjustedMonth + 1))
    + day + b - 1524.5
}

function sunPosition(jd: number) {
  const d = jd - 2451545.0
  const g = normalizeDegrees(357.529 + 0.98560028 * d)
  const q = normalizeDegrees(280.459 + 0.98564736 * d)
  const l = normalizeDegrees(q + 1.915 * Math.sin(degreesToRadians(g)) + 0.020 * Math.sin(degreesToRadians(2 * g)))
  const e = 23.439 - 0.00000036 * d
  const rightAscension = normalizeHours(radiansToDegrees(Math.atan2(
    Math.cos(degreesToRadians(e)) * Math.sin(degreesToRadians(l)),
    Math.cos(degreesToRadians(l)),
  )) / 15)
  const equation = q / 15 - rightAscension
  const declination = radiansToDegrees(Math.asin(
    Math.sin(degreesToRadians(e)) * Math.sin(degreesToRadians(l)),
  ))
  return { declination, equation }
}

function midDay(jDate: number, time: number) {
  const equation = sunPosition(jDate + time).equation
  return normalizeHours(12 - equation)
}

function sunAngleTime(jDate: number, latitude: number, angle: number, time: number, beforeNoon: boolean) {
  const declination = sunPosition(jDate + time).declination
  const noon = midDay(jDate, time)
  const numerator = -Math.sin(degreesToRadians(angle))
    - Math.sin(degreesToRadians(declination)) * Math.sin(degreesToRadians(latitude))
  const denominator = Math.cos(degreesToRadians(declination)) * Math.cos(degreesToRadians(latitude))
  const ratio = Math.max(-1, Math.min(1, numerator / denominator))
  const difference = radiansToDegrees(Math.acos(ratio)) / 15
  return noon + (beforeNoon ? -difference : difference)
}

function arccot(value: number) {
  return radiansToDegrees(Math.atan(1 / value))
}

function asrTime(jDate: number, latitude: number, factor: number, time: number) {
  const declination = sunPosition(jDate + time).declination
  const angle = -arccot(factor + Math.tan(degreesToRadians(Math.abs(latitude - declination))))
  return sunAngleTime(jDate, latitude, angle, time, false)
}

function timeString(value: number) {
  const roundedMinutes = Math.round(normalizeHours(value) * 60)
  const hours = Math.floor(roundedMinutes / 60) % 24
  const minutes = roundedMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function calculatePrayerTimesOffline(latitude: number, longitude: number, date = new Date()): PrayerTimes {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const timezone = -new Date(year, month - 1, day, 12).getTimezoneOffset() / 60
  const jDate = julianDate(year, month, day) - longitude / (15 * 24)

  const fajr = sunAngleTime(jDate, latitude, 19.5, 5 / 24, true)
  const sunrise = sunAngleTime(jDate, latitude, 0.833, 6 / 24, true)
  const dhuhr = midDay(jDate, 12 / 24)
  const asr = asrTime(jDate, latitude, 1, 13 / 24)
  const sunset = sunAngleTime(jDate, latitude, 0.833, 18 / 24, false)
  const isha = sunAngleTime(jDate, latitude, 17.5, 18 / 24, false)
  const adjustment = timezone - longitude / 15

  // Sunrise is calculated as a sanity check even though it is not shown.
  void sunrise

  return {
    Fajr: timeString(fajr + adjustment),
    Dhuhr: timeString(dhuhr + adjustment + 1 / 60),
    Asr: timeString(asr + adjustment),
    Maghrib: timeString(sunset + adjustment + 1 / 60),
    Isha: timeString(isha + adjustment),
  }
}

async function fetchNetworkPrayerTimes(latitude: number, longitude: number): Promise<PrayerTimesResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const url = new URL('https://api.aladhan.com/v1/timings')
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('method', '5')
    url.searchParams.set('school', '0')

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('prayer-times-request-failed')

    const json = await response.json() as {
      data?: { timings?: Record<string, string>; meta?: { timezone?: string } }
    }
    const timings = json.data?.timings
    if (!timings) throw new Error('prayer-times-invalid-response')

    return {
      timings: {
        Fajr: cleanTime(timings.Fajr),
        Dhuhr: cleanTime(timings.Dhuhr),
        Asr: cleanTime(timings.Asr),
        Maghrib: cleanTime(timings.Maghrib),
        Isha: cleanTime(timings.Isha),
      },
      cityLabel: json.data?.meta?.timezone?.replace('_', ' ') ?? 'موقعك الحالي',
      latitude,
      longitude,
      fetchedAt: new Date().toISOString(),
      source: 'network',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

function offlineResult(latitude: number, longitude: number): PrayerTimesResult {
  return {
    timings: calculatePrayerTimesOffline(latitude, longitude),
    cityLabel: 'موقعك الحالي • حساب محلي',
    latitude,
    longitude,
    fetchedAt: new Date().toISOString(),
    source: 'offline',
  }
}

export async function getPrayerTimes(forceRefresh = false): Promise<PrayerTimesResult> {
  if (!forceRefresh) {
    const cached = getCachedPrayerTimes()
    if (cached) return cached
  }

  let latitude: number
  let longitude: number

  try {
    const position = await getPosition()
    latitude = position.coords.latitude
    longitude = position.coords.longitude
    saveLocation(latitude, longitude)
  } catch (positionError) {
    const stored = getStoredLocation()
    if (!stored) throw positionError
    latitude = stored.latitude
    longitude = stored.longitude
  }

  let result: PrayerTimesResult
  try {
    result = navigator.onLine
      ? await fetchNetworkPrayerTimes(latitude, longitude)
      : offlineResult(latitude, longitude)
  } catch {
    result = offlineResult(latitude, longitude)
  }

  saveCache(result)
  return result
}
