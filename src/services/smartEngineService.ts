import { timeToMinutes } from '../domain/dailyCoach'
import { getEgyptSeason } from '../domain/season'
import type {
  CreatineLog,
  DailyCheckIn,
  DailyTask,
  DayEvent,
  Goal,
  MealLog,
  MealPlanItem,
  UserPreferences,
  WaterLog,
} from '../domain/models'
import type { PrayerTimesResult } from './prayerTimesService'
import { getDayContext } from './dayIntelligenceService'

export type SmartLocation = 'home' | 'outside' | 'gym' | 'unknown'

export interface SmartDaySnapshot {
  now: Date
  nowMinutes: number
  season: 'summer' | 'winter'
  isFriday: boolean
  location: SmartLocation
  sleepHours?: number
  wakeMinutes: number
  hoursSinceMeal: number
  waterTodayMl: number
  waterTargetMl: number
  goal: Goal['primary']
  goingGym: boolean
  gymMinutes?: number
  gymStage: 'idle' | 'on_the_way' | 'in_gym' | 'finished'
  creatineTaken: boolean
  energy: ReturnType<typeof getDayContext>['energy']
  illness: ReturnType<typeof getDayContext>['illness']
  nextPrayer?: { title: string; timeMinutes: number; minutesAway: number }
  fastingNow: boolean
}

export interface ProactiveNotice {
  key: string
  title: string
  message: string
  priority: 1 | 2 | 3
  actionHint?: string
}

function eventStage(events: DayEvent[]): SmartDaySnapshot['gymStage'] {
  const latest = [...events].reverse().find((event) =>
    event.type === 'gym_departed' || event.type === 'gym_started' || event.type === 'gym_finished',
  )
  if (latest?.type === 'gym_started') return 'in_gym'
  if (latest?.type === 'gym_departed') return 'on_the_way'
  if (latest?.type === 'gym_finished') return 'finished'
  return 'idle'
}

function eventLocation(events: DayEvent[], stage: SmartDaySnapshot['gymStage']): SmartLocation {
  if (stage === 'in_gym') return 'gym'
  const latest = [...events].reverse().find((event) =>
    event.type === 'outside_home' || event.type === 'inside_home',
  )
  if (latest?.type === 'outside_home') return 'outside'
  if (latest?.type === 'inside_home') return 'home'
  return 'home'
}

function sameLocalDate(iso: string, date: Date) {
  const value = new Date(iso)
  return value.getFullYear() === date.getFullYear()
    && value.getMonth() === date.getMonth()
    && value.getDate() === date.getDate()
}

function lastMealMinutes(logs: MealLog[], wakeMinutes: number, now: Date) {
  const sorted = [...logs]
    .filter((log) => sameLocalDate(log.eatenAt, now))
    .sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))
  const latest = sorted[sorted.length - 1]
  if (!latest) return wakeMinutes
  const date = new Date(latest.eatenAt)
  return date.getHours() * 60 + date.getMinutes()
}

function nextPrayerFromTasks(tasks: DailyTask[], nowMinutes: number) {
  const prayer = tasks
    .filter((task) => task.type === 'prayer' && !task.completed && task.timeMinutes >= nowMinutes - 10)
    .sort((a, b) => a.timeMinutes - b.timeMinutes)[0]
  if (!prayer) return undefined
  return {
    title: prayer.title,
    timeMinutes: prayer.timeMinutes,
    minutesAway: prayer.timeMinutes - nowMinutes,
  }
}

export function buildSmartDaySnapshot(params: {
  now?: Date
  checkIn: DailyCheckIn
  tasks: DailyTask[]
  mealLogs: MealLog[]
  waterLogs: WaterLog[]
  creatineLog?: CreatineLog
  events: DayEvent[]
  goal: Goal
  waterTargetMl: number
  fastingNow?: boolean
}): SmartDaySnapshot {
  const now = params.now ?? new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const wakeMinutes = timeToMinutes(params.checkIn.wakeTime)
  const stage = eventStage(params.events)
  const mealMinutes = lastMealMinutes(params.mealLogs, wakeMinutes, now)
  const context = getDayContext(params.events)
  const gymTask = params.tasks.find((task) => task.type === 'gym' && !task.completed)

  return {
    now,
    nowMinutes,
    season: getEgyptSeason(now) === 'winter' ? 'winter' : 'summer',
    isFriday: now.getDay() === 5,
    location: eventLocation(params.events, stage),
    sleepHours: params.checkIn.sleepHours,
    wakeMinutes,
    hoursSinceMeal: Math.max(0, (nowMinutes - mealMinutes) / 60),
    waterTodayMl: params.waterLogs
      .filter((log) => sameLocalDate(log.date, now))
      .reduce((sum, log) => sum + log.amountMl, 0),
    waterTargetMl: params.waterTargetMl,
    goal: params.goal.primary,
    goingGym: params.checkIn.goingGym,
    gymMinutes: gymTask?.timeMinutes,
    gymStage: stage,
    creatineTaken: Boolean(params.creatineLog),
    energy: context.energy,
    illness: context.illness,
    nextPrayer: nextPrayerFromTasks(params.tasks, nowMinutes),
    fastingNow: Boolean(params.fastingNow),
  }
}

function generatedTask(task: DailyTask) {
  return Boolean(task.contextKey?.startsWith('smart-'))
}

function hasSoonTask(tasks: DailyTask[], type: DailyTask['type'], now: number, within = 45) {
  return tasks.some((task) =>
    !task.completed && task.type === type && task.timeMinutes >= now - 10 && task.timeMinutes <= now + within,
  )
}

function goalMealText(goal: Goal['primary']) {
  if (goal === 'fat_loss') return 'اختار وجبة مشبعة فيها بروتين وخضار، من غير حرمان أو تعويض قاسي.'
  if (goal === 'lean_gain') return 'اختار وجبة فيها بروتين ونشويات مناسبة علشان تدعم التمرين والزيادة المحسوبة.'
  if (goal === 'recomp') return 'اختار بروتين مع نشويات أو خضار حسب المتاح، وخلي الكمية معتدلة.'
  return 'اختار وجبة متوازنة من الموجود عندك.'
}

export function applyOfflineSmartEngine(params: {
  tasks: DailyTask[]
  meals: MealPlanItem[]
  snapshot: SmartDaySnapshot
  preferences: UserPreferences
  userId: string
  dateKey: string
}) {
  const { snapshot, preferences, userId, dateKey } = params
  let tasks = params.tasks.filter((task) => !generatedTask(task))
  const meals = [...params.meals]
  const now = snapshot.nowMinutes

  if (snapshot.location === 'outside') {
    tasks = tasks.map((task) => {
      if (task.completed || task.type !== 'meal' || task.timeMinutes < now - 20) return task
      return {
        ...task,
        title: 'اختيار عملي وإنت بره',
        details: 'اختار أقرب وجبة بسيطة فيها بروتين ومصدر نشويات أو خضار، وسجّل اللي حصل فعلًا بعدها.',
      }
    })
  }

  if (snapshot.isFriday) {
    tasks = tasks.map((task) => {
      if (task.completed || task.type !== 'gym') return task
      return {
        ...task,
        title: 'جيم اختياري في يوم الجمعة',
        details: 'الجمعة يوم مرن، والصلاة أولًا. روح فقط لو وقتك وطاقتك مناسبين.',
      }
    })
  }

  if (!snapshot.illness && snapshot.sleepHours !== undefined && snapshot.sleepHours < 6 && snapshot.goingGym) {
    tasks = tasks.map((task) => {
      if (task.completed || task.type !== 'gym') return task
      const veryLow = snapshot.sleepHours! <= 4.5
      return {
        ...task,
        title: veryLow ? 'قرار الجيم بعد تقييم التعب' : 'جيم أخف بسبب قلة النوم',
        details: veryLow
          ? `نمت ${snapshot.sleepHours} ساعة تقريبًا. لو التعب واضح، الراحة أفضل. لو هتتمرن خلي الشدة خفيفة وتوقف عند دوخة أو إجهاد غير طبيعي.`
          : `نمت ${snapshot.sleepHours} ساعة تقريبًا. قلل الشدة أو الحجم، واهتم بالأكل والمياه قبل التمرين.`,
      }
    })

    if (!hasSoonTask(tasks, 'checkin', now, 30)) {
      tasks.push({
        userId,
        dateKey,
        timeMinutes: now + 10,
        type: 'checkin',
        title: 'راجع طاقتك بسبب قلة النوم',
        details: 'كل واشرب وخد هدوء، وبعدها قرر الجيم حسب إحساسك الحقيقي بدل الالتزام بالخطة بالعافية.',
        completed: false,
        contextKey: 'smart-low-sleep-check',
      })
    }
  }

  const gymSoon = snapshot.gymMinutes !== undefined
    && snapshot.gymMinutes >= now - 10
    && snapshot.gymMinutes <= now + 180

  if (!snapshot.fastingNow && !snapshot.illness && snapshot.hoursSinceMeal >= 5 && !hasSoonTask(tasks, 'meal', now, 40)) {
    tasks.push({
      userId,
      dateKey,
      timeMinutes: now + 5,
      type: 'meal',
      title: gymSoon ? 'كل دلوقتي علشان الجيم' : 'بقالك فترة من غير أكل',
      details: `${goalMealText(snapshot.goal)}${gymSoon ? ' متستناش لحد قبل الجيم مباشرة.' : ''}`,
      completed: false,
      contextKey: 'smart-long-meal-gap',
    })
  }

  const awakeMinutes = Math.max(0, now - snapshot.wakeMinutes)
  const expectedWater = Math.min(
    snapshot.waterTargetMl,
    Math.max(350, Math.round(snapshot.waterTargetMl * Math.min(1, awakeMinutes / (12 * 60)))),
  )
  const waterDeficit = expectedWater - snapshot.waterTodayMl

  if (!snapshot.fastingNow && awakeMinutes >= 180 && waterDeficit >= 350 && !hasSoonTask(tasks, 'water', now, 30)) {
    const amount = Math.min(500, Math.max(250, Math.round(waterDeficit / 50) * 50))
    tasks.push({
      userId,
      dateKey,
      timeMinutes: now + 5,
      type: 'water',
      title: 'عوض نقص المياه بهدوء',
      details: `شربك أقل من المناسب لوقت اليوم. اشرب ${amount} مل على مراحل، مش دفعة واحدة.`,
      waterAmountMl: amount,
      completed: false,
      contextKey: 'smart-water-deficit',
    })
  }

  if (preferences.creatineEnabled && !snapshot.creatineTaken && !snapshot.illness && !snapshot.fastingNow) {
    const shouldPrompt = snapshot.gymStage === 'finished' || now >= 19 * 60
    if (shouldPrompt) {
      const existing = tasks.find((task) => task.type === 'creatine' && !task.completed)
      if (existing) {
        tasks = tasks.map((task) => task === existing ? {
          ...task,
          timeMinutes: Math.min(task.timeMinutes, now + 15),
          details: `لسه ما سجلتش الكرياتين. خُد جرعتك المعتادة ${preferences.creatineDoseG} جم مع مياه، والوقت مش لازم يكون الصبح.`,
        } : task)
      } else {
        tasks.push({
          userId,
          dateKey,
          timeMinutes: now + 15,
          type: 'creatine',
          title: 'الكرياتين لسه متاخدش',
          details: `خُد جرعتك المعتادة ${preferences.creatineDoseG} جم مع مياه. الانتظام أهم من توقيت محدد.`,
          completed: false,
          contextKey: 'smart-creatine-late',
        })
      }
    }
  }

  return {
    tasks: tasks.sort((a, b) => a.timeMinutes - b.timeMinutes),
    meals,
  }
}

export function generateProactiveNotices(snapshot: SmartDaySnapshot): ProactiveNotice[] {
  const notices: ProactiveNotice[] = []
  const gymAway = snapshot.gymMinutes === undefined ? undefined : snapshot.gymMinutes - snapshot.nowMinutes

  if (snapshot.fastingNow && gymAway !== undefined && gymAway >= 0 && gymAway <= 90) {
    notices.push({
      key: 'ramadan-gym-window',
      title: 'الجيم يتظبط بعد الإفطار',
      message: 'إنت في وقت الصيام دلوقتي. الأفضل تأجل الجيم لما بعد الإفطار والمياه بوقت مناسب بدل الضغط على جسمك.',
      priority: 3,
    })
  }

  if (snapshot.illness) {
    notices.push({
      key: `illness-${snapshot.illness}`,
      title: 'خلّي الأولوية للتعافي',
      message: 'بما إنك مفعّل وضع التعب، الخطة هتركز على الراحة والمياه ومش هتضغط عليك بالجيم.',
      priority: 3,
      actionHint: 'حدّث حالتك لما تتحسن.',
    })
  }

  if (snapshot.nextPrayer && snapshot.nextPrayer.minutesAway >= 0 && snapshot.nextPrayer.minutesAway <= 30
    && gymAway !== undefined && gymAway <= 45) {
    notices.push({
      key: `prayer-before-gym-${snapshot.nextPrayer.title}`,
      title: 'الصلاة قبل الجيم',
      message: `باقي ${snapshot.nextPrayer.minutesAway} دقيقة تقريبًا على ${snapshot.nextPrayer.title}. الأفضل صلّي الأول وبعدها اتحرك للجيم.`,
      priority: 3,
    })
  }

  if (!snapshot.fastingNow && snapshot.hoursSinceMeal >= 5) {
    notices.push({
      key: `meal-gap-${Math.floor(snapshot.hoursSinceMeal)}`,
      title: 'بقالك فترة طويلة من غير أكل',
      message: gymAway !== undefined && gymAway >= 0 && gymAway <= 180
        ? `بقالك أكثر من ${Math.floor(snapshot.hoursSinceMeal)} ساعات من غير أكل، وعندك جيم قريب. كل دلوقتي وجبة مناسبة بدل ما تستنى لآخر لحظة.`
        : `بقالك أكثر من ${Math.floor(snapshot.hoursSinceMeal)} ساعات من غير أكل. اختار وجبة متوازنة من الموجود عندك.`,
      priority: 3,
    })
  }

  const awakeMinutes = Math.max(0, snapshot.nowMinutes - snapshot.wakeMinutes)
  const expectedWaterByNow = Math.min(
    snapshot.waterTargetMl,
    Math.max(250, Math.round(snapshot.waterTargetMl * Math.min(0.85, awakeMinutes / (12 * 60)))),
  )
  if (!snapshot.fastingNow && awakeMinutes >= 180 && snapshot.waterTodayMl + 300 < expectedWaterByNow) {
    notices.push({
      key: `low-water-${Math.floor(snapshot.waterTodayMl / 250)}`,
      title: 'مياهك قليلة لحد دلوقتي',
      message: `سجلت ${snapshot.waterTodayMl} مل تقريبًا، والمناسب لوقت يومك أقرب إلى ${expectedWaterByNow} مل. زوّد المياه تدريجيًا، خصوصًا لو عندك جيم.`,
      priority: 2,
    })
  }

  if (snapshot.sleepHours !== undefined && snapshot.sleepHours <= 5.5 && snapshot.goingGym) {
    notices.push({
      key: `low-sleep-${snapshot.sleepHours}`,
      title: 'قلل شدة التمرين النهارده',
      message: `نمت ${snapshot.sleepHours} ساعة تقريبًا. متحاولش تعوّض التعب بتمرين أقوى؛ خليه أخف أو خُد راحة لو الإرهاق واضح.`,
      priority: 2,
    })
  }

  if (!snapshot.creatineTaken && snapshot.goingGym && gymAway !== undefined && gymAway <= 90 && gymAway >= -120) {
    notices.push({
      key: 'creatine-gym-window',
      title: 'الكرياتين لسه متاخدش',
      message: 'مش لازم تاخده الصبح. خُد جرعتك المعتادة في وقت مناسب اليوم مع مياه، قبل أو بعد الجيم حسب راحتك.',
      priority: 1,
    })
  }

  if (snapshot.location === 'outside') {
    notices.push({
      key: 'outside-smart-buy',
      title: 'بما إنك بره البيت',
      message: 'لو هتشتري أكل، ركّز على الحاجة الناقصة عندك بدل شراء قائمة ثابتة. افتح اقتراحات السوبر ماركت من مدير اليوم.',
      priority: 1,
    })
  }

  return notices.sort((a, b) => b.priority - a.priority)
}

export function seasonLabel(season: SmartDaySnapshot['season']) {
  return season === 'winter' ? 'الشتاء' : 'الصيف'
}

export function locationLabel(location: SmartLocation) {
  if (location === 'gym') return 'في الجيم'
  if (location === 'outside') return 'بره البيت'
  if (location === 'home') return 'في البيت'
  return 'غير محدد'
}

export async function notifyProactiveCoach(userId: string, dateKey: string, notice: ProactiveNotice) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false

  const storageKey = `gym.proactiveNotice.${userId}.${dateKey}`
  const current = localStorage.getItem(storageKey)
  if (current === notice.key) return false

  const options: NotificationOptions = {
    body: notice.message,
    icon: '/pwa-192.svg',
    badge: '/pwa-192.svg',
    tag: `gym-coach-${notice.key}`,
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(notice.title, options)
    } else {
      new Notification(notice.title, options)
    }
    localStorage.setItem(storageKey, notice.key)
    return true
  } catch {
    return false
  }
}

export function parsePrayerTime(value: string) {
  return timeToMinutes(value)
}

export function isRamadanFastingNow(prayerTimes: PrayerTimesResult | null, nowMinutes: number) {
  if (!prayerTimes) return false
  const fajr = parsePrayerTime(prayerTimes.timings.Fajr)
  const maghrib = parsePrayerTime(prayerTimes.timings.Maghrib)
  return nowMinutes >= fajr && nowMinutes < maghrib
}

export function snapshotFromPrayerTimes(snapshot: SmartDaySnapshot, prayerTimes: PrayerTimesResult | null) {
  if (!prayerTimes || snapshot.nextPrayer) return snapshot
  const rows = [
    ['الفجر', prayerTimes.timings.Fajr],
    ['الظهر', prayerTimes.timings.Dhuhr],
    ['العصر', prayerTimes.timings.Asr],
    ['المغرب', prayerTimes.timings.Maghrib],
    ['العشاء', prayerTimes.timings.Isha],
  ] as const
  const next = rows
    .map(([title, value]) => ({ title, timeMinutes: parsePrayerTime(value) }))
    .find((item) => item.timeMinutes >= snapshot.nowMinutes)
  return next ? {
    ...snapshot,
    nextPrayer: { ...next, minutesAway: next.timeMinutes - snapshot.nowMinutes },
  } : snapshot
}
