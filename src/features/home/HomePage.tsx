import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlarmClock,
  BellRing,
  Bot,
  Cpu,
  Apple,
  Check,
  CheckCircle2,
  Clock3,
  Dumbbell,
  House,
  Moon,
  Pill,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  MapPin,
  ShoppingBasket,
  Sparkles,
  HeartPulse,
  BatteryMedium,
  Store,
  Bed,
  Footprints,
  Salad,
  ShieldAlert,
  Sunrise,
  Utensils,
  Waves,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { appSettings } from '../../data/db'
import { foodCatalog } from '../../data/foodCatalog'
import { sleepAdhkar, wakeAdhkar } from '../../data/adhkar'
import {
  availableFoodRepo,
  checkInRepo,
  coachMessageRepo,
  customFoodRepo,
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  goalRepo,
  mealLogRepo,
  mealPlanRepo,
  preferencesRepo,
  profileRepo,
  waterRepo,
} from '../../data/repositories'
import {
  calculateTargets,
  dateKey,
  formatTimeAr,
  goalLabels,
  normalizeGoal,
  normalizePreferences,
  timeToMinutes,
} from '../../domain/dailyCoach'
import type { DailyTask, EnergyLevel, IllnessType, MealPlanItem } from '../../domain/models'
import { matchesArabicSearch } from '../../domain/search'
import {
  actionExplanation,
  clearIllnessMode,
  completePrayerTask,
  departForGym,
  enterGym,
  failedToSleep,
  finishGym,
  logActualCreatineNow,
  logActualMealInstead,
  logActualWaterNow,
  recordMissedSleepTime,
  replaceUnavailableMealIngredient,
  rescueMessyDay,
  setCustomGymTime,
  setGymDay,
  setEnergyLevel,
  setIllnessMode,
  setInsideHome,
  setOutsideHome,
  snoozeTaskAndReplan,
  startDayNow,
  startSleepNow,
} from '../../services/dayManagerService'
import { regenerateDailyPlan } from '../../services/planService'
import { syncDayWithDeviceClock, taskClockLabel } from '../../services/timeAwareService'
import { getPrayerTimes, type PrayerTimesResult } from '../../services/prayerTimesService'
import { captureDayUndoSnapshot, restoreDayUndoSnapshot, type DayUndoSnapshot } from '../../services/dayUndoService'
import {
  analyzeMealChoice,
  buildSmartShoppingList,
  energyLabel,
  frequentMealIds,
  getDayContext,
  illnessLabel,
} from '../../services/dayIntelligenceService'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'
import { askSmartCoach, type CoachQuestionContext } from '../../services/smartCoachService'
import {
  buildSmartDaySnapshot,
  generateProactiveNotices,
  locationLabel,
  isRamadanFastingNow,
  notifyProactiveCoach,
  seasonLabel,
  snapshotFromPrayerTimes,
} from '../../services/smartEngineService'
import {
  cancelSleepWakeAlarm,
  scheduleSleepWakeAlarm,
  syncDayNotifications,
} from '../../services/nativeNotificationsService'

const taskIcons = {
  water: Waves,
  meal: Utensils,
  gym: Dumbbell,
  creatine: Pill,
  checkin: Sunrise,
  prayer: Sparkles,
} as const


function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function selectSmartAction(tasks: DailyTask[], gymTask?: DailyTask) {
  const pending = tasks.filter((task) => !task.completed)
  if (!pending.length) return undefined

  const now = currentMinutes()
  const actionable = pending.filter((task) => task.type !== 'prayer' || task.timeMinutes >= now - 60)
  if (!actionable.length) return undefined
  const prayerSoon = actionable
    .filter((task) => task.type === 'prayer' && task.timeMinutes >= now - 20 && task.timeMinutes <= now + 30)
    .sort((a, b) => a.timeMinutes - b.timeMinutes)[0]
  if (prayerSoon) return prayerSoon

  const gymDelta = gymTask ? gymTask.timeMinutes - now : undefined

  if (gymTask && gymDelta !== undefined && gymDelta >= 0 && gymDelta <= 90) {
    const preGym = actionable.find((task) =>
      (task.type === 'meal' && task.title.includes('سناك')) ||
      (task.type === 'water' && task.timeMinutes <= gymTask.timeMinutes)
    )
    if (preGym) return preGym
  }

  const due = actionable.filter((task) => task.timeMinutes <= now + 30)
  if (due.length) {
    const priority = { prayer: 0, water: 1, creatine: 2, meal: 3, gym: 4, checkin: 5 } as const
    return [...due].sort((a, b) => priority[a.type] - priority[b.type])[0]
  }

  return [...actionable].sort((a, b) => a.timeMinutes - b.timeMinutes)[0]
}

function gymStageFromEvents(events: Awaited<ReturnType<typeof dayEventRepo.list>>) {
  const lastGym = [...events].reverse().find((event) =>
    event.type === 'gym_departed' ||
    event.type === 'gym_started' ||
    event.type === 'gym_finished'
  )

  return lastGym?.type === 'gym_started'
    ? 'in_gym'
    : lastGym?.type === 'gym_departed'
      ? 'on_the_way'
      : lastGym?.type === 'gym_finished'
        ? 'finished'
        : 'idle'
}

export default function HomePage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()

  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const rawPreferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const checkIn = useLiveQuery(() => checkInRepo.get(userId, today), [userId, today])
  const tasks = useLiveQuery(() => dailyTaskRepo.list(userId, today), [userId, today]) ?? []
  const available = useLiveQuery(() => availableFoodRepo.list(userId, today), [userId, today]) ?? []
  const meals = useLiveQuery(() => mealPlanRepo.list(userId, today), [userId, today]) ?? []
  const mealLogs = useLiveQuery(() => mealLogRepo.list(userId, today), [userId, today]) ?? []
  const allMealLogs = useLiveQuery(() => mealLogRepo.listAll(userId), [userId]) ?? []
  const customFoods = useLiveQuery(() => customFoodRepo.list(userId), [userId]) ?? []
  const creatineLog = useLiveQuery(() => creatineRepo.get(userId, today), [userId, today])
  const events = useLiveQuery(() => dayEventRepo.list(userId, today), [userId, today]) ?? []
  const allEvents = useLiveQuery(() => dayEventRepo.listAll(userId), [userId]) ?? []
  const waterLogs = useLiveQuery(() => waterRepo.list(userId), [userId]) ?? []
  const coachMessages = useLiveQuery(() => coachMessageRepo.list(userId, today), [userId, today]) ?? []

  const [saving, setSaving] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [showGymTime, setShowGymTime] = useState(false)
  const [showMissedSleep, setShowMissedSleep] = useState(false)
  const [missedBedtime, setMissedBedtime] = useState('23:30')
  const [sleepMessage, setSleepMessage] = useState('')
  const [customGymTime, setCustomGymTimeValue] = useState('18:00')
  const [gymDrink, setGymDrink] = useState<'water' | 'juice'>('water')
  const [ingredientMeal, setIngredientMeal] = useState<MealPlanItem | null>(null)
  const [showSleepAdhkar, setShowSleepAdhkar] = useState(false)
  const [showWakeAdhkar, setShowWakeAdhkar] = useState(false)
  const [showActualEventMenu, setShowActualEventMenu] = useState(false)
  const [showActualFoodPicker, setShowActualFoodPicker] = useState(false)
  const [actualFoodSearch, setActualFoodSearch] = useState('')
  const [actualFoodSource, setActualFoodSource] = useState<'home' | 'restaurant' | 'quick'>('home')
  const [selectedActualFoodId, setSelectedActualFoodId] = useState('')
  const [actualServings, setActualServings] = useState('1')
  const [showEnergyPicker, setShowEnergyPicker] = useState(false)
  const [showIllnessPicker, setShowIllnessPicker] = useState(false)
  const [actualFeedback, setActualFeedback] = useState('')
  const [deviceNow, setDeviceNow] = useState(new Date())
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesResult | null>(null)
  const [prayerLoading, setPrayerLoading] = useState(false)
  const [prayerError, setPrayerError] = useState('')
  const [showPrayerDetails, setShowPrayerDetails] = useState(false)
  const [processingTaskId, setProcessingTaskId] = useState<number | null>(null)
  const [eventSaving, setEventSaving] = useState(false)
  const [undoSnapshot, setUndoSnapshot] = useState<DayUndoSnapshot | null>(null)
  const [undoLabel, setUndoLabel] = useState('')
  const undoTimerRef = useRef<number | null>(null)
  const [showCoach, setShowCoach] = useState(false)
  const [coachQuestion, setCoachQuestion] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState('')
  const [dismissedNoticeKeys, setDismissedNoticeKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`gym.dismissedNotices.${userId}.${today}`)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const lastSmartRefreshRef = useRef(0)


  const hasOpenModal = showGymTime || showMissedSleep || Boolean(ingredientMeal)
    || showActualEventMenu || showCoach || showEnergyPicker || showIllnessPicker
    || showActualFoodPicker || showSleepAdhkar || showWakeAdhkar

  useEffect(() => {
    if (!hasOpenModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setShowGymTime(false)
      setShowMissedSleep(false)
      setIngredientMeal(null)
      setShowActualEventMenu(false)
      setShowCoach(false)
      setShowEnergyPicker(false)
      setShowIllnessPicker(false)
      setShowActualFoodPicker(false)
      setShowSleepAdhkar(false)
      setShowWakeAdhkar(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [hasOpenModal])

  useEffect(() => {
    if (!actualFeedback) return
    const timer = window.setTimeout(() => setActualFeedback(''), 4200)
    return () => window.clearTimeout(timer)
  }, [actualFeedback])


useEffect(() => {
  let mounted = true

  async function syncClock() {
    if (!mounted) return
    const current = new Date()
    setDeviceNow(current)
    if (checkIn) {
      await syncDayWithDeviceClock(userId)
      if (current.getTime() - lastSmartRefreshRef.current >= 5 * 60_000) {
        lastSmartRefreshRef.current = current.getTime()
        await regenerateDailyPlan(userId, today)
      }
    }
  }

  void syncClock()
  const timer = window.setInterval(() => void syncClock(), 60_000)

  return () => {
    mounted = false
    window.clearInterval(timer)
  }
}, [userId, checkIn?.id, today])

  useEffect(() => {
    void loadPrayerTimes(false)
  }, [])

  useEffect(() => {
    if (checkIn && prayerTimes) void regenerateDailyPlan(userId, today)
  }, [checkIn?.id, prayerTimes?.fetchedAt, userId, today])

  const goal = normalizeGoal(rawGoal, userId)
  const preferences = normalizePreferences(rawPreferences, userId)
  const notificationTaskSignature = useMemo(
    () => tasks.map((task) => `${task.id}:${task.timeMinutes}:${task.completed}:${task.response ?? ''}`).join('|'),
    [tasks],
  )
  const targets = profile ? calculateTargets(profile, goal) : null

  const gymStage = gymStageFromEvents(events)
  const lastLocation = [...events].reverse().find((event) =>
    event.type === 'outside_home' || event.type === 'inside_home'
  )
  const isOutsideHome = lastLocation?.type === 'outside_home'

  const lastSleepEvent = [...allEvents].reverse().find((event) =>
    event.type === 'sleep_started' ||
    event.type === 'sleep_failed' ||
    event.type === 'woke_now'
  )
  const isTryingToSleep = lastSleepEvent?.type === 'sleep_started'
  const lastSleepFailed = lastSleepEvent?.type === 'sleep_failed'

  const gymTask = tasks.find((task) => task.type === 'gym' && !task.completed)
  const action = useMemo(
    () => selectSmartAction(tasks, gymTask),
    [tasks, gymTask, deviceNow],
  )

  const actionMeal = action?.mealKey
    ? meals.find((meal) => meal.mealKey === action.mealKey)
    : undefined

  const masturbationLoggedToday = events.some((event) => event.type === 'masturbation_logged')
  const foodUniverse = useMemo(() => [...foodCatalog, ...customFoods], [customFoods])
  const consumedCalories = mealLogs.reduce((sum, log) => sum + log.calories, 0)
  const consumedProtein = mealLogs.reduce((sum, log) => sum + log.protein, 0)
  const dayContext = useMemo(() => getDayContext(events), [events])
  const availableIds = useMemo(() => new Set(available.map((row) => row.foodId)), [available])
  const availableFoods = useMemo(
    () => foodUniverse.filter((food) => availableIds.has(food.id)),
    [foodUniverse, availableIds],
  )
  const frequentIds = useMemo(() => frequentMealIds(allMealLogs), [allMealLogs])
  const frequentFoods = useMemo(
    () => frequentIds.map((id) => foodUniverse.find((food) => food.id === id)).filter((food): food is NonNullable<typeof food> => Boolean(food)),
    [frequentIds, foodUniverse],
  )
  const shoppingSuggestions = useMemo(
    () => buildSmartShoppingList({ allFoods: foodUniverse, availableIds, goal, recentLogs: allMealLogs }),
    [foodUniverse, availableIds, goal.primary, allMealLogs],
  )
  const selectedActualFood = foodUniverse.find((food) => food.id === selectedActualFoodId)
  const servings = Math.min(10, Math.max(0.25, Number(actualServings) || 1))
  const scaledActualFood = selectedActualFood ? {
    ...selectedActualFood,
    nameAr: servings === 1 ? selectedActualFood.nameAr : `${selectedActualFood.nameAr} × ${servings}`,
    calories: Math.round(selectedActualFood.calories * servings),
    protein: Math.round(selectedActualFood.protein * servings * 10) / 10,
    carbs: Math.round(selectedActualFood.carbs * servings * 10) / 10,
    fats: Math.round(selectedActualFood.fats * servings * 10) / 10,
  } : undefined
  const selectedMealAnalysis = scaledActualFood
    ? analyzeMealChoice(scaledActualFood, availableFoods, Math.max(0, (targets?.proteinG ?? 0) - consumedProtein))
    : undefined
  const lateMealTask = tasks
    .filter((task) => !task.completed && task.type === 'meal' && currentMinutes() - task.timeMinutes >= 20)
    .sort((a, b) => a.timeMinutes - b.timeMinutes)[0]
  const planChangeReasons = useMemo(() => {
    const reasons: string[] = []
    if (lateMealTask) reasons.push(`وجبة «${lateMealTask.title}» اتأخرت، لذلك منتظرين قرارك قبل تحريك باقي اليوم.`)
    if (checkIn?.sleepHours !== undefined && checkIn.sleepHours < 6) reasons.push(`النوم المسجل ${checkIn.sleepHours} ساعة، فتم تخفيف ضغط اليوم وتعديل قرار شدة الجيم.`)
    if (dayContext.illness) reasons.push('وضع التعب مفعّل، فالأولوية للراحة والمياه وتم إيقاف الضغط غير المناسب.')
    if (dayContext.energy === 'low') reasons.push('الطاقة منخفضة، لذلك اتأجلت الخطوات الثقيلة لحين إعادة التقييم.')
    if (isOutsideHome) reasons.push('إنت مسجل إنك بره البيت، فتحولت اقتراحات الأكل لاختيارات عملية من الخارج.')
    if (events.some((event) => event.type === 'restaurant_meal')) reasons.push('تم تسجيل وجبة مطعم، فاتوزع باقي الأكل والسعرات على بقية اليوم.')
    if (events.some((event) => event.type === 'day_messy')) reasons.push('استخدمت «يومي اتلخبط»، فتم بناء المواعيد من الوقت الحالي بدل الخطة القديمة.')
    if (tasks.some((task) => task.response === 'snoozed' && !task.completed)) reasons.push('في خطوة اتأجلت يدويًا، فتم تحريك الخطوات التالية مع الحفاظ على الفواصل المناسبة.')
    if (tasks.some((task) => task.contextKey?.includes('smart-water-deficit'))) reasons.push('شرب المياه أقل من المناسب لوقت اليوم، لذلك ظهر تعويض تدريجي للمياه.')
    if (tasks.some((task) => task.contextKey?.includes('smart-long-meal-gap'))) reasons.push('مر وقت طويل من آخر وجبة، لذلك اتضافت وجبة عملية قبل استمرار اليوم.')
    if (tasks.some((task) => task.type === 'prayer' && !task.completed && task.timeMinutes >= currentMinutes() - 10 && task.timeMinutes <= currentMinutes() + 30)) reasons.push('موعد صلاة قريب من الجيم، فالصلاة اتقدمت وتم منع التعارض.')
    return reasons.length ? reasons.slice(0, 5) : ['الخطة الحالية مبنية على الساعة، نومك، الجيم، مكانك، الأكل المسجل والمياه. مفيش تغيير استثنائي الآن.']
  }, [lateMealTask?.id, checkIn?.sleepHours, dayContext.illness, dayContext.energy, isOutsideHome, events, tasks])
  const isFriday = deviceNow.getDay() === 5
  const prayerBlocksGym = tasks.some((task) =>
    task.type === 'prayer' && !task.completed && task.timeMinutes >= currentMinutes() - 10 && task.timeMinutes <= currentMinutes() + 30
  )

  const smartSnapshot = useMemo(() => {
    if (!checkIn || !targets) return undefined
    const snapshot = buildSmartDaySnapshot({
      now: deviceNow,
      checkIn,
      tasks,
      mealLogs,
      waterLogs,
      creatineLog,
      events,
      goal,
      waterTargetMl: targets.waterMl,
      fastingNow: Boolean(preferences.ramadanMode) && isRamadanFastingNow(prayerTimes, deviceNow.getHours() * 60 + deviceNow.getMinutes()),
    })
    return snapshotFromPrayerTimes(snapshot, prayerTimes)
  }, [checkIn, targets, deviceNow, tasks, mealLogs, waterLogs, creatineLog, events, goal.primary, prayerTimes, preferences.ramadanMode])

  const proactiveNotices = useMemo(
    () => smartSnapshot && preferences.proactiveCoachEnabled !== false
      ? generateProactiveNotices(smartSnapshot)
      : [],
    [smartSnapshot, preferences.proactiveCoachEnabled],
  )
  const proactiveNotice = proactiveNotices.find((notice) => !dismissedNoticeKeys.includes(notice.key))

  const coachContext = useMemo<CoachQuestionContext | undefined>(() => smartSnapshot ? ({
    snapshot: smartSnapshot,
    availableFoods,
    frequentFoods,
    preferences,
    profile,
    mealsToday: mealLogs,
    eventsToday: events,
    plannedMeals: meals.map((meal) => ({
      title: meal.title,
      timeMinutes: meal.timeMinutes,
      calories: meal.calories,
      protein: meal.protein,
    })),
    nextTaskTitles: tasks.filter((task) => !task.completed).slice(0, 6).map((task) => task.title),
  }) : undefined, [smartSnapshot, availableFoods, frequentFoods, preferences, profile, mealLogs, events, meals, tasks])

  useEffect(() => {
    if (!preferences.browserNotificationsEnabled) return
    void syncDayNotifications(tasks, preferences, today).catch(() => undefined)
  }, [notificationTaskSignature, preferences.browserNotificationsEnabled, preferences.notificationStartHour, preferences.notificationEndHour, preferences.maxNotificationsPerDay, preferences.mealNotificationsEnabled, preferences.waterNotificationsEnabled, preferences.creatineNotificationsEnabled, preferences.prayerNotificationsEnabled, preferences.gymNotificationsEnabled, today])

  useEffect(() => {
    if (!proactiveNotice || !preferences.browserNotificationsEnabled) return
    void notifyProactiveCoach(userId, today, proactiveNotice, preferences)
  }, [proactiveNotice?.key, preferences, userId, today])

  function dismissProactiveNotice() {
    if (!proactiveNotice) return
    const next = [...new Set([...dismissedNoticeKeys, proactiveNotice.key])]
    setDismissedNoticeKeys(next)
    localStorage.setItem(`gym.dismissedNotices.${userId}.${today}`, JSON.stringify(next))
  }

  async function openCoach() {
    setShowCoach(true)
    setCoachError('')
    if (coachMessages.length || !coachContext) return
    await coachMessageRepo.add({
      userId,
      dateKey: today,
      role: 'assistant',
      source: 'local',
      createdAt: new Date().toISOString(),
      text: 'أنا شايف بيانات يومك الحالية وخطتك وما سجلته فعلًا. قولّي حصل إيه، وأنا هديك القرار الأنسب الآن بدون ما أقدّم تمارين.',
    })
  }

  async function submitCoachQuestion(questionOverride?: string) {
    const question = (questionOverride ?? coachQuestion).trim()
    if (!question || !coachContext || coachLoading) return
    setCoachQuestion('')
    setCoachLoading(true)
    setCoachError('')

    await coachMessageRepo.add({
      userId,
      dateKey: today,
      role: 'user',
      source: 'local',
      createdAt: new Date().toISOString(),
      text: question,
    })

    try {
      const reply = await askSmartCoach(question, coachContext)
      await coachMessageRepo.add({
        userId,
        dateKey: today,
        role: 'assistant',
        source: reply.source,
        createdAt: new Date().toISOString(),
        text: reply.text,
      })
      if (reply.fallbackReason) setCoachError(`تم استخدام المحرك المحلي لأن خدمة AI لم ترد: ${reply.fallbackReason}`)
    } catch {
      setCoachError('حصل خطأ أثناء تجهيز الرد. جرّب تاني.')
    } finally {
      setCoachLoading(false)
    }
  }

  async function loadPrayerTimes(forceRefresh = false) {
    setPrayerLoading(true)
    setPrayerError('')
    try {
      const result = await getPrayerTimes(forceRefresh)
      setPrayerTimes(result)
    } catch (error) {
      const isDenied = typeof GeolocationPositionError !== 'undefined' && error instanceof GeolocationPositionError && error.code === 1
      setPrayerError(isDenied
        ? 'اسمح للموقع بالوصول، أو اختر مدينتك يدويًا من صفحة «المزيد».'
        : 'مقدرناش نجيب مواقيت الصلاة دلوقتي. جرّب تاني.')
    } finally {
      setPrayerLoading(false)
    }
  }

  async function wakeNow() {
    setSaving(true)
    await cancelSleepWakeAlarm().catch(() => undefined)
    await startDayNow(userId)
    setSaving(false)
    setShowWakeAdhkar(true)
  }

  async function saveMissedSleepTime() {
    setSaving(true)
    const hours = await recordMissedSleepTime(userId, missedBedtime, checkIn?.goingGym ?? false)
    setSaving(false)

    if (hours) {
      setSleepMessage(`تم تسجيل نومك تقريبًا ${hours} ساعة.`)
      setShowMissedSleep(false)
    } else {
      setSleepMessage('الوقت غير منطقي. اختار وقت نوم أقرب للصحيح.')
    }
  }

  async function sleepNow() {
    await startSleepNow(userId)
    if (preferences.sleepAlarmEnabled !== false) {
      await scheduleSleepWakeAlarm(preferences.sleepAlarmAfterHours ?? 8, profile?.name, preferences).catch(() => undefined)
    }
    setSleepMessage(preferences.sleepAlarmEnabled !== false
      ? `بدأ النوم. منبّه الاستيقاظ مضبوط بعد ${preferences.sleepAlarmAfterHours ?? 8} ساعات.`
      : 'بدأت محاولة النوم. لو النوم مجاش اضغط «مقدرتش أنام».')
    setShowSleepAdhkar(true)
  }

  async function couldNotSleep() {
    await cancelSleepWakeAlarm().catch(() => undefined)
    await failedToSleep(userId)
    setSleepMessage('ما حسبناش إنك نمت، وتم إلغاء منبّه الاستيقاظ. خُد هدوء شوية وبعدها جرّب تاني.')
  }

  async function trySleepAgain() {
    await startSleepNow(userId)
    if (preferences.sleepAlarmEnabled !== false) {
      await scheduleSleepWakeAlarm(preferences.sleepAlarmAfterHours ?? 8, profile?.name, preferences).catch(() => undefined)
    }
    setSleepMessage(preferences.sleepAlarmEnabled !== false
      ? `بدأت محاولة نوم جديدة والمنبّه مضبوط بعد ${preferences.sleepAlarmAfterHours ?? 8} ساعات.`
      : 'بدأت محاولة نوم جديدة من الوقت الحالي.')
  }

  function offerUndo(snapshot: DayUndoSnapshot, label: string) {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    setUndoSnapshot(snapshot)
    setUndoLabel(label)
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null)
      setUndoLabel('')
    }, 12_000)
  }

  async function undoLastAction() {
    if (!undoSnapshot) return
    await restoreDayUndoSnapshot(undoSnapshot)
    setUndoSnapshot(null)
    setUndoLabel('')
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    setActualFeedback('تم التراجع ورجعت حالة اليوم لما كانت عليه قبل التسجيل.')
  }

  async function skipLateMeal(task: DailyTask) {
    if (!task.id) return
    await dailyTaskRepo.markUnavailable(task.id)
    await regenerateDailyPlan(userId, today)
    setActualFeedback(`تم تخطي «${task.title}» وترتيب باقي اليوم بدون تعويض قاسي.`)
  }

  async function completeTask(task: DailyTask) {
    if (!task.id || task.completed || processingTaskId !== null) return
    setProcessingTaskId(task.id)
    const canUndo = task.type === 'water' || task.type === 'meal' || task.type === 'creatine'
    const snapshot = canUndo ? await captureDayUndoSnapshot(userId, today) : null

    try {
      if (task.type === 'prayer') {
        await completePrayerTask(userId, task)
        await regenerateDailyPlan(userId, today)
        return
      }

      if (task.type === 'water' && task.waterAmountMl) {
        await waterRepo.addFromTaskOnce({
          userId,
          amountMl: task.waterAmountMl,
          date: new Date().toISOString(),
          sourceTaskId: task.id,
        })
      }

      if (task.type === 'creatine') {
        await creatineRepo.markTaken({
          userId,
          dateKey: today,
          doseG: preferences.creatineDoseG,
          takenAt: new Date().toISOString(),
        })
      }

      if (task.type === 'meal' && task.mealKey && !await mealLogRepo.existsForTask(userId, task.id)) {
        const plannedMeal = meals.find((meal) => meal.mealKey === task.mealKey)
        if (plannedMeal) {
          await mealLogRepo.add({
            userId,
            dateKey: today,
            foodId: `planned:${plannedMeal.mealKey}`,
            foodNameAr: plannedMeal.ingredients.map((item) => item.split('—')[0].trim()).join(' + '),
            mealLabel: plannedMeal.title,
            eatenAt: new Date().toISOString(),
            calories: plannedMeal.calories,
            protein: plannedMeal.protein,
            sourceTaskId: task.id,
            source: 'home',
          })
        }
      }

      await dailyTaskRepo.setCompleted(task.id, true)
      await regenerateDailyPlan(userId, today)
      if (snapshot) offerUndo(snapshot, task.type === 'water' ? 'تسجيل المياه' : task.type === 'creatine' ? 'تسجيل الكرياتين' : 'تسجيل الوجبة')
    } finally {
      setProcessingTaskId(null)
    }
  }

  async function chooseUnavailableIngredient(foodId: string) {
    if (!ingredientMeal || !action) return
    await replaceUnavailableMealIngredient(userId, action, foodId)
    setIngredientMeal(null)
  }

  async function toggleGymDay() {
    if (!checkIn) return
    await setGymDay(userId, !checkIn.goingGym)
  }


  async function confirmActualFood() {
    if (!scaledActualFood || eventSaving) return
    setEventSaving(true)
    const snapshot = await captureDayUndoSnapshot(userId, today)
    try {
      const mealTask = action?.type === 'meal' ? action : lateMealTask
      await logActualMealInstead(userId, mealTask, scaledActualFood, actualFoodSource)
      setShowActualFoodPicker(false)
      setShowActualEventMenu(false)
      setActualFoodSearch('')
      setSelectedActualFoodId('')
      setActualServings('1')
      offerUndo(snapshot, 'تسجيل الوجبة')
      setActualFeedback(actualFoodSource === 'restaurant'
        ? 'اتسجلت وجبة المطعم، وباقي اليوم اتظبط بدون جلد ذات أو إلغاء الخطة.'
        : 'اتسجل اللي أكلته فعلًا، وباقي اليوم اتعاد ترتيبه.')
      await syncDayWithDeviceClock(userId)
    } catch {
      setActualFeedback('حصلت مشكلة أثناء تسجيل الوجبة. جرّب تاني بدون ما تسجلها مرتين.')
    } finally {
      setEventSaving(false)
    }
  }

  async function recordWater(amount: number) {
    if (eventSaving) return
    setEventSaving(true)
    const snapshot = await captureDayUndoSnapshot(userId, today)
    try {
      await logActualWaterNow(userId, amount)
      offerUndo(snapshot, 'تسجيل المياه')
      setShowActualEventMenu(false)
      setActualFeedback(`تم تسجيل ${amount} مل مياه وتحديث حالة اليوم.`)
    } catch {
      setActualFeedback('مقدرناش نسجل المياه دلوقتي. جرّب تاني.')
    } finally {
      setEventSaving(false)
    }
  }

  async function recordCreatine() {
    if (eventSaving) return
    setEventSaving(true)
    const snapshot = await captureDayUndoSnapshot(userId, today)
    try {
      await logActualCreatineNow(userId)
      offerUndo(snapshot, 'تسجيل الكرياتين')
      setShowActualEventMenu(false)
      setActualFeedback('تم تسجيل الكرياتين وإلغاء تذكيره من باقي اليوم.')
    } catch {
      setActualFeedback('مقدرناش نسجل الكرياتين دلوقتي. جرّب تاني.')
    } finally {
      setEventSaving(false)
    }
  }

  async function runActualEvent(operation: () => Promise<unknown>, feedback?: string) {
    if (eventSaving) return
    setEventSaving(true)
    try {
      await operation()
      setShowActualEventMenu(false)
      if (feedback) setActualFeedback(feedback)
    } catch {
      setActualFeedback('حصلت مشكلة أثناء تحديث اليوم. جرّب تاني.')
    } finally {
      setEventSaving(false)
    }
  }

  async function updateEnergy(level: EnergyLevel) {
    await setEnergyLevel(userId, level)
    setShowEnergyPicker(false)
    setActualFeedback(level === 'low'
      ? 'خففنا ضغط اليوم وأجلنا الجيم لحد ما ترتاح وتقيّم طاقتك.'
      : 'تم تحديث طاقتك وإعادة ترتيب اليوم.')
  }

  async function updateIllness(value: IllnessType) {
    await setIllnessMode(userId, value)
    setShowIllnessPicker(false)
    setActualFeedback('تم تفعيل وضع «أنا تعبان»: الجيم القوي اتوقف، والأولوية للمياه والراحة.')
  }

  async function saveGymTime() {
    await setCustomGymTime(userId, customGymTime)
    setShowGymTime(false)
  }

  const prayerItems = prayerTimes ? [
    { key: 'Fajr', label: 'الفجر', time: prayerTimes.timings.Fajr },
    { key: 'Dhuhr', label: isFriday ? 'الجمعة' : 'الظهر', time: prayerTimes.timings.Dhuhr },
    { key: 'Asr', label: 'العصر', time: prayerTimes.timings.Asr },
    { key: 'Maghrib', label: 'المغرب', time: prayerTimes.timings.Maghrib },
    { key: 'Isha', label: preferences.ramadanMode ? 'العشاء والتراويح' : 'العشاء', time: prayerTimes.timings.Isha },
  ] : []

  const nowTotalMinutes = deviceNow.getHours() * 60 + deviceNow.getMinutes()
  const upcomingPrayer = prayerItems.find((item) => {
    const [hours, minutes] = item.time.split(':').map(Number)
    return hours * 60 + minutes > nowTotalMinutes
  })
  const nextPrayer = upcomingPrayer ?? prayerItems[0]
  const nextPrayerIsTomorrow = Boolean(prayerItems.length && !upcomingPrayer)

  return (
    <Page className="home-page" title={`أهلاً ${profile?.name ?? ''}`} subtitle="أهم خطوة أولًا، والتفاصيل موجودة وقت ما تحتاجها">
      {!isTryingToSleep && !checkIn && (
        <Card className="daily-checkin-card">
          <span className="eyebrow">بداية اليوم</span>
          <h2>أول ما تصحى ابدأ من هنا</h2>
          <p className="muted">الموقع ياخد الوقت الحالي تلقائيًا. مفيش سؤال عن ميعاد استيقاظ مستهدف.</p>

          <p className="wake-gym-note">
            بعد ما تصحى، «يوم جيم» بيكون متعلم تلقائيًا كل يوم ما عدا الجمعة. تقدر تغيّره من الملخص فوق في أي وقت.
          </p>

          <div className="button-row">
            <Button disabled={saving} onClick={wakeNow}>
              <Sunrise size={18} />
              {saving ? 'ببدأ يومك...' : 'أنا صحيت الآن'}
            </Button>

            <Button variant="secondary" onClick={() => setShowMissedSleep(true)}>
              <Moon size={18} />
              صحيت ونسيت أسجل نومي
            </Button>
          </div>
        </Card>
      )}

      {!isTryingToSleep && checkIn && (
        <>
        <div className="live-device-clock">
          <Clock3 size={16} />
          <span>الوقت عندك الآن</span>
          <strong>{deviceNow.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</strong>
        </div>
        <div className="day-summary-bar">
          <div><Sunrise size={18} /><span>صحيت {formatTimeAr(timeToMinutes(checkIn.wakeTime))}</span></div>
          {checkIn.sleepHours && <div><Moon size={18} /><span>نوم {checkIn.sleepHours} ساعة تقريبًا</span></div>}
          <button
            className={`gym-day-toggle ${checkIn.goingGym ? 'active' : ''}`}
            onClick={toggleGymDay}
            aria-pressed={checkIn.goingGym}
          >
            <span className="gym-day-check">{checkIn.goingGym ? <Check size={15} /> : null}</span>
            <Dumbbell size={18} />
            <span>{dayContext.illness ? 'الجيم متوقف مؤقتًا' : checkIn.goingGym ? 'يوم جيم' : 'مفيش جيم'}</span>
          </button>
        </div>
        </>
      )}


      {!isTryingToSleep && checkIn && isFriday && (
        <Card className="friday-mode-card">
          <div>
            <span className="eyebrow">وضع الجمعة</span>
            <h2>يوم مرن وصلاة الجمعة هي الأولوية</h2>
            <p>الجيم غير مفعل افتراضيًا، وخطة اليوم أخف. تقدر تفعله يدويًا من ملخص اليوم.</p>
          </div>
          <Sparkles size={30} />
        </Card>
      )}

      {!isTryingToSleep && checkIn && preferences.ramadanMode && (
        <Card className="ramadan-mode-card">
          <div>
            <span className="eyebrow">وضع رمضان</span>
            <h2>الإفطار والسحور والمياه والصلاة داخل الخطة</h2>
            <p>الوجبات النهارية اتوقفت، والمياه متوزعة بين المغرب والفجر، والجيم يتحرك لما بعد الإفطار.</p>
          </div>
          <Moon size={30} />
        </Card>
      )}

      {!isTryingToSleep && (
        <Card title="مواقيت الصلاة اليوم" className="prayer-times-card">
          <div className="prayer-times-head">
            <div>
              <span className="eyebrow">حسب إعدادات الموقع والصلاة</span>
              {prayerTimes && (
                <p className="muted prayer-location"><MapPin size={15} />{prayerTimes.cityLabel}</p>
              )}
            </div>
            <Button variant="secondary" disabled={prayerLoading} onClick={() => loadPrayerTimes(true)}>
              <RefreshCw size={16} />
              {prayerLoading ? 'بحدّث...' : 'تحديث'}
            </Button>
          </div>

          {!prayerTimes && !prayerError && (
            <div className="prayer-empty">
              <p>اسمح بالوصول للموقع علشان نحسب مواقيت الصلاة بدقة، حتى لو الإنترنت مش متاح.</p>
              <Button disabled={prayerLoading} onClick={() => loadPrayerTimes(true)}>
                <MapPin size={17} />
                {prayerLoading ? 'بحدد موقعك...' : 'فعّل مواقيت الصلاة'}
              </Button>
            </div>
          )}

          {prayerError && (
            <div className="prayer-error">
              <p>{prayerError}</p>
              <Button variant="secondary" onClick={() => loadPrayerTimes(true)}>جرّب تاني</Button>
            </div>
          )}

          {prayerTimes && nextPrayer && (
            <>
              <div className="prayer-compact-summary">
                <span className="prayer-compact-icon"><Sparkles size={22} /></span>
                <span className="prayer-compact-copy">
                  <small>الصلاة القادمة</small>
                  <strong>{nextPrayer.label}{nextPrayerIsTomorrow ? ' غدًا' : ''} • {nextPrayer.time}</strong>
                  <em>{prayerTimes.source === 'offline' ? 'محسوبة محليًا بدون إنترنت وقد تختلف دقائق بسيطة' : 'تمت مزامنتها عبر الإنترنت'}</em>
                </span>
                <button className="prayer-details-toggle" onClick={() => setShowPrayerDetails((value) => !value)}>
                  {showPrayerDetails ? 'إخفاء' : 'كل المواقيت'}
                </button>
              </div>

              {showPrayerDetails && (
                <>
                  <div className="prayer-grid">
                    {prayerItems.map((item) => (
                      <div key={item.key} className={`prayer-item ${nextPrayer?.key === item.key ? 'next' : ''}`}>
                        <span>{item.label}</span>
                        <strong>{item.time}</strong>
                        {nextPrayer?.key === item.key && <small>الصلاة القادمة</small>}
                      </div>
                    ))}
                  </div>
                  <p className="prayer-note">الصلاة جزء من مدير يومك: لو وجبة أو جيم قربوا منها، تظهر الصلاة أولًا ويتحرك باقي اليوم تلقائيًا.</p>
                </>
              )}
            </>
          )}
        </Card>
      )}

      <Card className={`sleep-control-card ${isTryingToSleep ? 'sleep-active sleep-minimal' : ''}`}>
        <div className="sleep-control-head">
          <div>
            <span className="eyebrow">النوم</span>
            <h2>
              {isTryingToSleep
                ? 'وضع النوم شغال'
                : lastSleepFailed
                  ? 'النوم ماجاش آخر مرة'
                  : 'جاهز للنوم؟'}
            </h2>
            <p className="muted">
              {isTryingToSleep
                ? 'لما تصحى اضغط «أنا صحيت الآن». لو النوم مجاش اضغط «مقدرتش أنام».'
                : lastSleepFailed
                  ? 'لما تبقى جاهز ابدأ محاولة جديدة.'
                  : 'اضغط وقت ما تدخل تنام فعلًا.'}
            </p>
          </div>
          <Moon size={30} />
        </div>

        <div className="button-row">
          {!isTryingToSleep && !lastSleepFailed && (
            <Button onClick={sleepNow}><Moon size={18} /> أنا هنام الآن</Button>
          )}

          {isTryingToSleep && (
            <>
              <Button onClick={couldNotSleep}><AlarmClock size={18} /> مقدرتش أنام</Button>
              <Button variant="secondary" onClick={wakeNow}><Sunrise size={18} /> أنا صحيت الآن</Button>
            </>
          )}

          {lastSleepFailed && (
            <Button onClick={trySleepAgain}><Moon size={18} /> هحاول أنام تاني</Button>
          )}
        </div>
      </Card>

      {sleepMessage && (
        <Card className="success-card">
          <Check size={24} />
          <div><h2>تحديث النوم</h2><p>{sleepMessage}</p></div>
        </Card>
      )}

      {!isTryingToSleep && checkIn && proactiveNotice && (
        <section className={`proactive-coach-card priority-${proactiveNotice.priority}`}>
          <div className="proactive-coach-icon"><BellRing /></div>
          <div className="proactive-coach-copy">
            <span className="eyebrow">المدرب بدأ الكلام</span>
            <h2>{proactiveNotice.title}</h2>
            <p>{proactiveNotice.message}</p>
            {proactiveNotice.actionHint && <small>{proactiveNotice.actionHint}</small>}
          </div>
          <button className="proactive-dismiss" onClick={dismissProactiveNotice} aria-label="إخفاء التنبيه"><X size={18} /></button>
        </section>
      )}

      {!isTryingToSleep && checkIn && gymStage !== 'in_gym' && (
        <section className="command-center command-center-pro">
          <div className="command-center-head">
            <div>
              <span className="eyebrow">مدير يومك</span>
              <h2>الخطوات المناسبة لحالتك بس</h2>
            </div>

            <button
              className="icon-action"
              onClick={() => regenerateDailyPlan(userId, today)}
              title="أعد ترتيب اليوم"
            >
              <RefreshCw size={19} />
            </button>
          </div>

          {smartSnapshot && (
            <div className="smart-engine-status">
              <div className="smart-engine-title"><Cpu size={19} /><span><strong>Smart Engine محلي</strong><small>يعمل بدون AI وبدون إنترنت</small></span></div>
              <div className="smart-engine-chips">
                <span>{locationLabel(smartSnapshot.location)}</span>
                <span>{seasonLabel(smartSnapshot.season)}</span>
                {smartSnapshot.isFriday && <span>وضع الجمعة</span>}
                <span>{smartSnapshot.sleepHours !== undefined ? `نوم ${smartSnapshot.sleepHours} س` : 'النوم غير مسجل'}</span>
                <span>{goalLabels[smartSnapshot.goal]}</span>
              </div>
            </div>
          )}

          <button className="actual-event-master" onClick={() => setShowActualEventMenu(true)}>
            <span className="manager-now-icon"><RefreshCw /></span>
            <span><strong>إيه اللي حصل فعلًا؟</strong><small>سجّل أي تغيير، وأنا أعيد ترتيب باقي اليوم</small></span>
          </button>

          <button className="ask-coach-button" onClick={() => void openCoach()}>
            <span className="manager-now-icon"><Bot /></span>
            <span><strong>اسأل المدرب الذكي</strong><small>اكتب بطريقتك الطبيعية — محلي مجانًا وAI اختياري</small></span>
          </button>

          <div className="day-state-strip">
            <button onClick={() => setShowEnergyPicker(true)}>
              <BatteryMedium size={18} />
              <span>طاقتك: <strong>{energyLabel(dayContext.energy)}</strong></span>
            </button>
            <button className={dayContext.illness ? 'warning' : ''} onClick={() => setShowIllnessPicker(true)}>
              <HeartPulse size={18} />
              <span>{dayContext.illness ? `تعبان: ${illnessLabel(dayContext.illness)}` : 'أنا تعبان'}</span>
            </button>
          </div>

          <button className="manager-now-button" onClick={() => setShowWhy(!showWhy)}>
            <span className="manager-now-icon"><Sparkles /></span>
            <span><strong>ماذا أفعل الآن؟</strong><small>أهم خطوة وسببها</small></span>
          </button>

          {showWhy && (
            <div className="why-box">
              <strong>{action?.title ?? 'لا توجد خطوة معلقة'}</strong>
              <p>{actionExplanation(action)}</p>
              <h3>ليه الخطة اتغيرت؟</h3>
              <ul className="reason-list">{planChangeReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {!isTryingToSleep && isOutsideHome && (
        <Card title="اقتراحات من السوبر ماركت" className="supermarket-card">
          <div className="supermarket-head">
            <ShoppingBasket size={26} />
            <p>مش لازم تختار إن الحاجة موجودة عندك. دور على أول اقتراح تلاقيه.</p>
          </div>
          <ol className="supermarket-list">
            {shoppingSuggestions.map((food) => <li key={food.id}>{food.nameAr} — {food.servingLabel}</li>)}
            {shoppingSuggestions.length === 0 && <li>المتاح عندك متوازن حاليًا؛ اشترِ فقط اللي خلص.</li>}
          </ol>
        </Card>
      )}

      {!isTryingToSleep && gymStage === 'in_gym' && (
        <section className="gym-live-card">
          <div className="gym-live-head">
            <div><span className="live-dot" /><span>أنت في الجيم الآن</span></div>
            <Dumbbell size={26} />
          </div>

          <h2>وضع الجيم شغال — باقي الموقع اتظبط على الحالة دي</h2>

          <div className="gym-drink-choice">
            <span>معاك إيه؟</span>
            <div>
              <button className={gymDrink === 'water' ? 'active' : ''} onClick={() => setGymDrink('water')}>
                <Waves size={17} /> مياه
              </button>
              <button className={gymDrink === 'juice' ? 'active' : ''} onClick={() => setGymDrink('juice')}>
                <Utensils size={17} /> عصير
              </button>
            </div>
          </div>

          <div className="gym-live-tips">
            {gymDrink === 'water' ? (
              <div>
                <Waves />
                <span>
                  <strong>اشرب على رشفات</strong>
                  <small>خد رشفات بين المجموعات، وما تشربش كمية كبيرة مرة واحدة.</small>
                </span>
              </div>
            ) : (
              <>
                <div>
                  <Utensils />
                  <span>
                    <strong>اشرب العصير على مراحل</strong>
                    <small>كمية صغيرة على مراحل، مش الزجاجة كلها مرة واحدة.</small>
                  </span>
                </div>
                <div>
                  <Waves />
                  <span>
                    <strong>لو فيه مياه خُد منها برضه</strong>
                    <small>المياه تفضل الأساس أثناء التمرين.</small>
                  </span>
                </div>
              </>
            )}

            {profile?.smoker && (
              <div>
                <AlarmClock />
                <span>
                  <strong>بما إنك مسجل إنك مدخن</strong>
                  <small>ما تتجاهلش ضيق النفس أو الدوخة، وخد راحة لو احتجت.</small>
                </span>
              </div>
            )}
          </div>

          <Button onClick={() => finishGym(userId)}>
            <Check size={18} />
            خلصت الجيم
          </Button>
        </section>
      )}

      {!isTryingToSleep && checkIn && available.length === 0 && !isOutsideHome && (
        <Card className="attention-card">
          <Apple size={28} />
          <div>
            <h2>لسه محتاج أعرف الأكل المتاح</h2>
            <p>اختار الموجود فقط — من غير كميات.</p>
          </div>
          <Link to="/food"><Button>حدد الأكل المتاح</Button></Link>
        </Card>
      )}

      {!isTryingToSleep && checkIn && lateMealTask && gymStage !== 'in_gym' && (
        <Card className="late-meal-card">
          <div>
            <span className="eyebrow">الوجبة اتأخرت</span>
            <h2>{lateMealTask.title}</h2>
            <p>ميعادها كان {formatTimeAr(lateMealTask.timeMinutes)}. اختار اللي حصل فعلًا علشان باقي اليوم يتحرك صح.</p>
          </div>
          <div className="task-actions">
            <Button disabled={processingTaskId !== null} onClick={() => void completeTask(lateMealTask)}><Check size={18} /> أكلتها</Button>
            <Button variant="secondary" onClick={() => { setActualFoodSource('home'); setSelectedActualFoodId(''); setActualServings('1'); setShowActualFoodPicker(true) }}>أكلت حاجة تانية</Button>
            <Button variant="secondary" onClick={() => void snoozeTaskAndReplan(lateMealTask, 30)}><AlarmClock size={18} /> أجّل 30 دقيقة</Button>
            <Button variant="secondary" onClick={() => void skipLateMeal(lateMealTask)}>مش هاكلها</Button>
          </div>
        </Card>
      )}

      {!isTryingToSleep && gymStage !== 'in_gym' && checkIn && action && action.id !== lateMealTask?.id && (
        <section className="next-action-card">
          <div className="next-action-top">
            <span className="live-dot" />
            الخطوة الأهم الآن
          </div>

          <div className="next-action-main">
            <div className={`task-icon ${action.type}`}>
              {(() => {
                const Icon = taskIcons[action.type]
                return <Icon />
              })()}
            </div>

            <div>
              <span className="time-label">
                <Clock3 size={15} />
                {taskClockLabel(action, deviceNow) ?? formatTimeAr(action.timeMinutes)}
              </span>
              <h2>{action.title}</h2>
              <p>{action.details}</p>
            </div>
          </div>

          <div className="task-actions">
            <Button disabled={processingTaskId !== null} onClick={() => void completeTask(action)}>
              <Check size={18} /> {processingTaskId === action.id ? 'بسجل...' : 'تم'}
            </Button>
            {action.type !== 'prayer' && (
              <Button
                variant="secondary"
                disabled={processingTaskId !== null}
                onClick={() => void snoozeTaskAndReplan(action, 30)}
              >
                <AlarmClock size={18} /> أجّل 30 دقيقة
              </Button>
            )}

            {action.type === 'meal' && (
              <Button variant="secondary" onClick={() => { setActualFoodSource('home'); setActualServings('1'); setShowActualFoodPicker(true) }}>
                أنا أكلت حاجة تانية
              </Button>
            )}

            {action.type === 'meal' && actionMeal && !isOutsideHome && (
              <Button variant="secondary" onClick={() => setIngredientMeal(actionMeal)}>
                مكون مش متاح
              </Button>
            )}
          </div>
        </section>
      )}

      {masturbationLoggedToday && !isTryingToSleep && (
        <Card className="habit-context-card">
          <p>
            تم تسجيل العادة اليوم. مفيش وجبة خاصة مطلوبة؛ كمل خطتك طبيعي،
            وخلي قرار الجيم حسب طاقتك الفعلية.
          </p>
        </Card>
      )}


      {actualFeedback && !isTryingToSleep && (
        <Card className="success-card actual-feedback-card">
          <CheckCircle2 size={24} />
          <div><h2>تم تحديث يومك</h2><p>{actualFeedback}</p></div>
        </Card>
      )}

      {undoSnapshot && !isTryingToSleep && (
        <div className="undo-toast">
          <span>تم {undoLabel}</span>
          <button onClick={() => void undoLastAction()}><RotateCcw size={16} /> تراجع</button>
        </div>
      )}

      {!isTryingToSleep && checkIn?.goingGym && gymStage === 'idle' && (
        <div className="compact-gym-time">
          <div><Dumbbell size={18} /><span>لو ناوي تروح في ساعة معينة</span></div>
          <button onClick={() => setShowGymTime(true)}>حدد الساعة</button>
        </div>
      )}

      {!isTryingToSleep && checkIn && (mealLogs.length > 0 || Boolean(targets) || tasks.length > 0) && (
        <details className="day-details-panel">
          <summary>
            <span><Sparkles size={18} /><strong>تفاصيل اليوم كاملة</strong></span>
            <small>الأكل المسجل، الأهداف والخطة الزمنية</small>
          </summary>

          <div className="day-details-content">
            {mealLogs.length > 0 && (
              <Card title="اللي أكلته فعلًا النهارده" className="actual-meals-card">
                <div className="actual-meals-list">
                  {mealLogs.map((log) => (
                    <div key={log.id} className="actual-meal-row">
                      <div>
                        <strong>{log.foodNameAr}</strong>
                        <span>{log.mealLabel}</span>
                      </div>
                      <small>{new Date(log.eatenAt).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</small>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {targets && (
              <div className="stats-grid day-stats-grid">
                <Stat label="هدفك الحالي" value={goalLabels[goal.primary]} />
                <Stat label="السعرات التقديرية" value={`${targets.calories} سعر`} />
                <Stat label="البروتين المستهدف" value={`${targets.proteinG} جم`} />
                <Stat label="المتبقي من السعرات" value={`${Math.max(0, targets.calories - consumedCalories)} سعر تقريبًا`} />
                <Stat label="المتبقي من البروتين" value={`${Math.max(0, targets.proteinG - consumedProtein)} جم تقريبًا`} />
                <Stat label="المياه المستهدفة" value={`${targets.waterMl} مل`} />
                <Stat
                  label="الكرياتين اليوم"
                  value={preferences.creatineEnabled ? (creatineLog ? 'تم أخذه' : `${preferences.creatineDoseG} جم`) : 'غير مفعل'}
                />
              </div>
            )}

            {tasks.length > 0 && gymStage !== 'in_gym' && (
              <Card title="خطة يومك بالترتيب" className="day-plan-card">
                <div className="timeline">
                  {tasks.map((task) => {
                    const Icon = taskIcons[task.type]

                    return (
                      <div key={task.id} className={`timeline-row ${task.completed ? 'completed' : ''}`}>
                        <span className={`timeline-icon ${task.type}`}><Icon size={18} /></span>
                        <span className="timeline-time">{formatTimeAr(task.timeMinutes)}</span>
                        <span className="timeline-copy">
                          <strong>{task.title}</strong>
                          <small>{task.details}</small>
                        </span>

                        <div className="timeline-mini-actions">
                          {!task.completed && (
                            <button
                              disabled={processingTaskId !== null}
                              onClick={() => void completeTask(task)}
                            >
                              {processingTaskId === task.id ? '...' : 'تم'}
                            </button>
                          )}
                          {!task.completed && task.type !== 'prayer' && (
                            <button
                              disabled={processingTaskId !== null}
                              onClick={() => void snoozeTaskAndReplan(task, 30)}
                            >
                              تأجيل
                            </button>
                          )}
                          {task.completed && <span><Check size={16} /></span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        </details>
      )}

      {!isTryingToSleep && checkIn && gymStage !== 'in_gym' && (
        <button className="actual-event-fab" onClick={() => setShowActualEventMenu(true)}>
          <RefreshCw size={18} />
          <span>إيه اللي حصل؟</span>
        </button>
      )}

      {showGymTime && (
        <div className="modal-backdrop" onClick={() => setShowGymTime(false)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>هتقدر تروح الجيم إمتى؟</h2>
            <p className="muted">الموقع يعيد ترتيب الخطوات حوالين الوقت اللي تختاره.</p>
            <label>
              ميعاد الجيم
              <input
                type="time"
                value={customGymTime}
                onChange={(event) => setCustomGymTimeValue(event.target.value)}
              />
            </label>

            <div className="button-row">
              <Button onClick={saveGymTime}>ثبت الوقت</Button>
              <Button variant="secondary" onClick={() => setShowGymTime(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {showMissedSleep && (
        <div className="modal-backdrop" onClick={() => setShowMissedSleep(false)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">تصحيح النوم</span>
            <h2>نمت تقريبًا الساعة كام؟</h2>
            <p className="muted">الخيار ده موجود في الصحيان فقط.</p>

            <label>
              وقت النوم التقريبي
              <input
                type="time"
                value={missedBedtime}
                onChange={(event) => setMissedBedtime(event.target.value)}
              />
            </label>

            <div className="button-row">
              <Button disabled={saving} onClick={saveMissedSleepTime}>
                {saving ? 'بسجل...' : 'سجل وقت نومي'}
              </Button>
              <Button variant="secondary" onClick={() => setShowMissedSleep(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {ingredientMeal && (
        <div className="modal-backdrop" onClick={() => setIngredientMeal(null)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>إيه المكون اللي مش متاح دلوقتي؟</h2>
            <p className="muted">
              هنشيله من الوجبة، ونسيب باقي المكونات. ولو فيه بديل من نفس النوع هنبدله تلقائيًا.
            </p>

            <div className="ingredient-choice-list">
              {ingredientMeal.foodIds.map((foodId) => {
                const food = foodCatalog.find((item) => item.id === foodId)
                if (!food) return null

                return (
                  <button key={foodId} onClick={() => chooseUnavailableIngredient(foodId)}>
                    <strong>{food.nameAr}</strong>
                    <span>مش متاح عندي دلوقتي</span>
                  </button>
                )
              })}
            </div>

            <Button variant="secondary" onClick={() => setIngredientMeal(null)}>إلغاء</Button>
          </div>
        </div>
      )}


{showActualEventMenu && (
  <div className="modal-backdrop" onClick={() => setShowActualEventMenu(false)}>
    <div role="dialog" aria-modal="true" className="modal actual-event-modal" onClick={(event) => event.stopPropagation()}>
      <span className="eyebrow">اللي حصل فعلًا</span>
      <h2>إيه اللي اتغير دلوقتي؟</h2>
      <p className="muted">كل اختيار يلغي الخطوات القديمة غير المنطقية ويرتب باقي اليوم من جديد.</p>

      <fieldset className="actual-event-grid" disabled={eventSaving}>
        <button onClick={() => { setActualFoodSource('home'); setSelectedActualFoodId(''); setActualServings('1'); setShowActualFoodPicker(true) }}><Utensils /><span><strong>أكلت حاجة</strong><small>في البيت أو من المعتاد</small></span></button>
        <button onClick={() => { setActualFoodSource('restaurant'); setSelectedActualFoodId(''); setActualServings('1'); setShowActualFoodPicker(true) }}><Store /><span><strong>أكلت من مطعم</strong><small>برجر، شاورما، كشري...</small></span></button>
        <button onClick={() => recordWater(250)}><Waves /><span><strong>شربت مياه</strong><small>250 مل</small></span></button>
        <button onClick={() => recordWater(500)}><Waves /><span><strong>شربت مياه كتير</strong><small>500 مل</small></span></button>
        <button onClick={recordCreatine}><Pill /><span><strong>أخذت الكرياتين</strong><small>يلغي تذكيره اليوم</small></span></button>
        {!isOutsideHome && <button onClick={() => void runActualEvent(() => setOutsideHome(userId), 'تم تسجيل خروجك من البيت وتحديث اقتراحات اليوم.')}><Footprints /><span><strong>خرجت من البيت</strong><small>فعّل اقتراحات الشراء</small></span></button>}
        {isOutsideHome && <button onClick={() => void runActualEvent(() => setInsideHome(userId), 'تم تسجيل رجوعك للبيت وإعادة ترتيب الخطة.')}><House /><span><strong>رجعت البيت</strong><small>ارجع لخطة البيت</small></span></button>}
        {checkIn?.goingGym && gymStage === 'idle' && !prayerBlocksGym && <button onClick={() => void runActualEvent(() => departForGym(userId), 'تم تسجيل تحركك للجيم.')}><Dumbbell /><span><strong>اتحركت للجيم</strong><small>يغيّر مرحلة اليوم</small></span></button>}
        {gymStage === 'on_the_way' && <button onClick={() => void runActualEvent(() => enterGym(userId), 'وضع الجيم شغال الآن.')}><Dumbbell /><span><strong>بدأت الجيم</strong><small>فعّل وضع التمرين</small></span></button>}
        {gymStage === 'in_gym' && <button onClick={() => void runActualEvent(() => finishGym(userId), 'تم تسجيل انتهاء الجيم وترتيب ما بعد التمرين.')}><Check /><span><strong>خلصت الجيم</strong><small>رتب ما بعد التمرين</small></span></button>}
        <button onClick={() => void runActualEvent(sleepNow)}><Bed /><span><strong>هروح أنام</strong><small>ابدأ تسجيل النوم</small></span></button>
        <button onClick={() => void runActualEvent(() => rescueMessyDay(userId), 'تم إنقاذ باقي اليوم وترتيبه من الوقت الحالي.')}><AlarmClock /><span><strong>يومي اتلخبط</strong><small>رتب كل الباقي</small></span></button>
      </fieldset>
      <Button variant="secondary" onClick={() => setShowActualEventMenu(false)}>إلغاء</Button>
    </div>
  </div>
)}

{showCoach && (
  <div className="modal-backdrop" onClick={() => setShowCoach(false)}>
    <div role="dialog" aria-modal="true" className="modal smart-coach-modal" onClick={(event) => event.stopPropagation()}>
      <div className="smart-coach-modal-head">
        <div><span className="eyebrow">مدربك الشخصي</span><h2>اسأل المدرب الذكي</h2></div>
        <button onClick={() => setShowCoach(false)} aria-label="إغلاق"><X size={20} /></button>
      </div>
      <p className="muted">الرد يعتمد على ملفك ووقتك ونومك وأكلك ومياهك والجيم والصلاة وخطة اليوم. الذكاء الاصطناعي يعمل عبر Cloudflare، والمحرك المحلي يظل احتياطيًا بدون إنترنت.</p>

      <div className="coach-example-chips">
        {['صحيت تعبان النهارده', 'معايا 100 جنيه أجيب أكل إيه؟', 'عندي فول وبيض وطعمية، أعمل إيه؟', 'أتمرن النهارده ولا أريح؟', 'نسيت الكرياتين الصبح'].map((example) => (
          <button key={example} disabled={coachLoading} onClick={() => void submitCoachQuestion(example)}>{example}</button>
        ))}
      </div>

      <div className="coach-conversation">
        {coachMessages.map((message) => (
          <article key={message.id} className={`coach-message ${message.role}`}>
            <div className="coach-message-meta">
              <strong>{message.role === 'user' ? 'إنت' : 'المدرب'}</strong>
              {message.role === 'assistant' && <span>{message.source === 'ai' ? 'AI' : 'محلي'}</span>}
            </div>
            <p>{message.text}</p>
          </article>
        ))}
        {coachLoading && <article className="coach-message assistant loading"><strong>المدرب</strong><p>براجع حالة يومك...</p></article>}
      </div>

      {coachError && <div className="coach-fallback-note">{coachError}</div>}

      <div className="coach-input-row">
        <textarea
          value={coachQuestion}
          onChange={(event) => setCoachQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submitCoachQuestion()
            }
          }}
          placeholder="مثال: نمت 5 ساعات ولسه ماكلتش، أروح الجيم؟"
          rows={2}
        />
        <button disabled={!coachQuestion.trim() || coachLoading || !coachContext} onClick={() => void submitCoachQuestion()} aria-label="إرسال"><Send size={20} /></button>
      </div>
    </div>
  </div>
)}

{showEnergyPicker && (
  <div className="modal-backdrop" onClick={() => setShowEnergyPicker(false)}>
    <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
      <span className="eyebrow">تحديث اختياري</span>
      <h2>طاقتك دلوقتي؟</h2>
      <p className="muted">مش هنسألك تلقائيًا. افتحها بس لما تحس إن يومك اتغير.</p>
      <div className="energy-choice-grid">
        <button onClick={() => updateEnergy('low')}><span>😫</span><strong>قليلة</strong></button>
        <button onClick={() => updateEnergy('normal')}><span>🙂</span><strong>عادية</strong></button>
        <button onClick={() => updateEnergy('high')}><span>🔥</span><strong>عالية</strong></button>
      </div>
      <Button variant="secondary" onClick={() => setShowEnergyPicker(false)}>إلغاء</Button>
    </div>
  </div>
)}

{showIllnessPicker && (
  <div className="modal-backdrop" onClick={() => setShowIllnessPicker(false)}>
    <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
      <span className="eyebrow">وضع أنا تعبان</span>
      <h2>إيه أقرب وصف؟</h2>
      <p className="muted">التطبيق لا يشخّص. هو فقط يمنع توجيهات غير مناسبة ويخفف اليوم.</p>
      <div className="illness-choice-list">
        <button onClick={() => updateIllness('cold_fever')}>برد / حرارة</button>
        <button onClick={() => updateIllness('headache')}>صداع</button>
        <button onClick={() => updateIllness('stomach')}>مغص أو تعب معدة</button>
        <button onClick={() => updateIllness('fatigue')}>إرهاق عام</button>
        <button onClick={() => updateIllness('injury')}>ألم أو إصابة</button>
      </div>
      {dayContext.illness && (
        <Button onClick={async () => { await clearIllnessMode(userId); setShowIllnessPicker(false); setActualFeedback('تم إنهاء وضع التعب وإعادة الخطة العادية.') }}>
          أنا أحسن دلوقتي
        </Button>
      )}
      <div className="safety-note"><ShieldAlert size={18} /> لو الأعراض شديدة أو مستمرة أو بتسوء، اطلب تقييمًا طبيًا.</div>
      <Button variant="secondary" onClick={() => setShowIllnessPicker(false)}>إلغاء</Button>
    </div>
  </div>
)}

{showActualFoodPicker && (
  <div className="modal-backdrop" onClick={() => setShowActualFoodPicker(false)}>
    <div role="dialog" aria-modal="true" className="modal actual-food-modal" onClick={(event) => event.stopPropagation()}>
      <span className="eyebrow">{actualFoodSource === 'restaurant' ? 'أكل من مطعم' : 'اختبر وسجّل وجبتك'}</span>
      <h2>{actualFoodSource === 'restaurant' ? 'أكلت إيه تقريبًا؟' : 'الأكلة دي تكفيك ولا تضيف حاجة؟'}</h2>
      <p className="muted">اختار الأكلة الأول. هنقولك هل تكفي حسب يومك، وبعد التأكيد نرتب الباقي.</p>

      <div className="food-source-tabs">
        <button className={actualFoodSource !== 'restaurant' ? 'active' : ''} onClick={() => setActualFoodSource('home')}>أكل عادي</button>
        <button className={actualFoodSource === 'restaurant' ? 'active' : ''} onClick={() => setActualFoodSource('restaurant')}>مطعم</button>
      </div>

      {frequentFoods.length > 0 && actualFoodSource !== 'restaurant' && (
        <div className="frequent-meals">
          <strong>وجباتك المعتادة</strong>
          <div>{frequentFoods.map((food) => <button key={food.id} onClick={() => { setSelectedActualFoodId(food.id); setActualFoodSource('quick'); setActualServings('1') }}>{food.nameAr}</button>)}</div>
        </div>
      )}

      <div className="search-box">
        <Search size={17} />
        <input
          value={actualFoodSearch}
          onChange={(event) => setActualFoodSearch(event.target.value)}
          placeholder={actualFoodSource === 'restaurant' ? 'برجر، شاورما، كشري، بيتزا...' : 'مثال: فول'}
          autoFocus
        />
      </div>

      <div className="actual-food-grid">
        {foodUniverse
          .filter((food) => matchesArabicSearch(food.nameAr, actualFoodSearch))
          .filter((food) => actualFoodSource !== 'restaurant' || food.kind === 'complete_meal' || food.category === 'meal' || ['شاورما', 'برجر', 'فراخ مشوية', 'فول', 'طعمية'].some((name) => food.nameAr.includes(name)))
          .slice(0, 30)
          .map((food) => (
            <button className={selectedActualFoodId === food.id ? 'selected' : ''} key={food.id} onClick={() => setSelectedActualFoodId(food.id)}>
              <strong>{food.nameAr}</strong>
              <span>{food.servingLabel}</span>
            </button>
          ))}
      </div>

      {selectedActualFood && (
        <div className="servings-control">
          <label>
            عدد الحصص
            <input
              type="number"
              min="0.25"
              max="10"
              step="0.25"
              value={actualServings}
              onChange={(event) => setActualServings(event.target.value)}
            />
          </label>
          <div>
            <strong>{scaledActualFood?.calories ?? 0} سعر تقريبي</strong>
            <span>{scaledActualFood?.protein ?? 0} جم بروتين</span>
          </div>
        </div>
      )}

      {selectedActualFood && selectedMealAnalysis && (
        <div className={`meal-analysis ${selectedMealAnalysis.enough ? 'enough' : ''}`}>
          <Salad size={24} />
          <div>
            <strong>{selectedMealAnalysis.verdict}</strong>
            <p>{selectedMealAnalysis.detail}</p>
          </div>
        </div>
      )}

      <div className="button-row">
        <Button disabled={!selectedActualFood || eventSaving} onClick={confirmActualFood}>
          {eventSaving ? 'بسجل...' : actualFoodSource === 'restaurant' ? 'سجّل وجبة المطعم' : 'سجّل إني أكلتها'}
        </Button>
        <Button variant="secondary" onClick={() => setShowActualFoodPicker(false)}>إلغاء</Button>
      </div>
    </div>
  </div>
)}

      {showSleepAdhkar && (
        <div className="modal-backdrop" onClick={() => setShowSleepAdhkar(false)}>
          <div role="dialog" aria-modal="true" className="modal adhkar-modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">أذكار النوم</span>
            <h2>اقرأ اللي تقدر عليه بهدوء</h2>
            <div className="adhkar-list">
              {sleepAdhkar.map((item) => (
                <article key={item.title} className="dhikr-card">
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                  {item.repeat && <span>{item.repeat}</span>}
                  {item.note && <small>{item.note}</small>}
                </article>
              ))}
            </div>
            <Button onClick={() => setShowSleepAdhkar(false)}>تم، هنام دلوقتي</Button>
          </div>
        </div>
      )}

      {showWakeAdhkar && (
        <div className="modal-backdrop" onClick={() => setShowWakeAdhkar(false)}>
          <div role="dialog" aria-modal="true" className="modal adhkar-modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">أذكار الاستيقاظ</span>
            <h2>ابدأ يومك بالذكر</h2>
            <div className="adhkar-list">
              {wakeAdhkar.map((item) => (
                <article key={item.title} className="dhikr-card">
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                  {item.note && <small>{item.note}</small>}
                </article>
              ))}
            </div>
            <div className="sunnah-wake-note">
              <CheckCircle2 size={22} />
              <p>خطوة بسيطة: امسح أثر النوم عن وجهك، ثم ابدأ يومك بهدوء.</p>
            </div>
            <Button onClick={() => setShowWakeAdhkar(false)}>تم، ابدأ يومي</Button>
          </div>
        </div>
      )}

      {!action && checkIn && tasks.length > 0 && !isTryingToSleep && gymStage !== 'in_gym' && (
        <Card><EmptyState text="مفيش خطوة معلقة دلوقتي." /></Card>
      )}
    </Page>
  )
}
