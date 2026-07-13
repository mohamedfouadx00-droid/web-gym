import type {
  DailyTask,
  DayEvent,
  EnergyLevel,
  FoodCatalogItem,
  Goal,
  IllnessType,
  MealLog,
  MealPlanItem,
  UserPreferences,
} from '../domain/models'
import type { PrayerTimesResult } from './prayerTimesService'
import { getEgyptSeason, isFoodInSeason } from '../domain/season'

export interface DayContext {
  energy: EnergyLevel
  illness?: IllnessType
}

const illnessLabels: Record<IllnessType, string> = {
  cold_fever: 'برد أو حرارة',
  headache: 'صداع',
  stomach: 'مغص أو تعب معدة',
  fatigue: 'إرهاق عام',
  injury: 'ألم أو إصابة',
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function eventTime(event: DayEvent) {
  return new Date(event.createdAt).getTime()
}

export function getDayContext(events: DayEvent[]): DayContext {
  const latestEnergy = [...events]
    .reverse()
    .find((event) => event.type === 'energy_low' || event.type === 'energy_normal' || event.type === 'energy_high')

  const energy: EnergyLevel = latestEnergy?.type === 'energy_low'
    ? 'low'
    : latestEnergy?.type === 'energy_high'
      ? 'high'
      : 'normal'

  const latestIllnessSet = [...events].reverse().find((event) => event.type === 'illness_set')
  const latestIllnessClear = [...events].reverse().find((event) => event.type === 'illness_cleared')
  const illnessActive = latestIllnessSet && (!latestIllnessClear || eventTime(latestIllnessSet) > eventTime(latestIllnessClear))
  const illness = illnessActive ? latestIllnessSet.note as IllnessType : undefined

  return { energy, illness }
}

export function energyLabel(level: EnergyLevel) {
  if (level === 'low') return '😫 قليلة'
  if (level === 'high') return '🔥 عالية'
  return '🙂 عادية'
}

export function illnessLabel(value?: IllnessType) {
  return value ? illnessLabels[value] : undefined
}

function prayerTasks(
  userId: string,
  dateKey: string,
  prayerTimes: PrayerTimesResult,
  ramadanMode: boolean,
): DailyTask[] {
  const friday = new Date(`${dateKey}T12:00:00`).getDay() === 5
  const items = [
    { key: 'Fajr', label: 'الفجر', time: prayerTimes.timings.Fajr },
    { key: 'Dhuhr', label: friday ? 'صلاة الجمعة' : 'الظهر', time: prayerTimes.timings.Dhuhr },
    { key: 'Asr', label: 'العصر', time: prayerTimes.timings.Asr },
    { key: 'Maghrib', label: 'المغرب', time: prayerTimes.timings.Maghrib },
    { key: 'Isha', label: ramadanMode ? 'العشاء والتراويح' : 'العشاء', time: prayerTimes.timings.Isha },
  ]

  return items.map((item) => ({
    userId,
    dateKey,
    timeMinutes: parseTime(item.time),
    type: 'prayer',
    title: item.label,
    details: friday && item.key === 'Dhuhr'
      ? 'جهّز نفسك لصلاة الجمعة، وبعدها كمّل يومك بهدوء.'
      : ramadanMode && item.key === 'Isha'
        ? 'صلّي العشاء، ولو هتصلّي التراويح خلّيها جزء من ترتيب المساء.'
        : `موعد صلاة ${item.label}. خلّي الخطوات اللي بعدها تبدأ بعد الصلاة.`,
    completed: false,
    contextKey: `prayer-${item.key}`,
  }))
}

function moveAroundPrayers(task: DailyTask, prayers: DailyTask[]) {
  if (task.completed || task.type === 'prayer') return task

  const conflict = prayers.find((prayer) => {
    const before = task.type === 'gym' ? 35 : task.type === 'meal' ? 25 : 10
    const after = task.type === 'gym' ? 25 : task.type === 'meal' ? 15 : 8
    return task.timeMinutes >= prayer.timeMinutes - before && task.timeMinutes <= prayer.timeMinutes + after
  })

  if (!conflict) return task

  const gap = task.type === 'gym' ? 35 : task.type === 'meal' ? 25 : 15
  return {
    ...task,
    timeMinutes: conflict.timeMinutes + gap,
    details: `${task.details} — اتأجلت لما بعد ${conflict.title} علشان الصلاة تيجي الأول.`,
  }
}

export function applyPrayerPriority(params: {
  tasks: DailyTask[]
  prayerTimes: PrayerTimesResult | null
  userId: string
  dateKey: string
  ramadanMode: boolean
}) {
  const withoutPrayers = params.tasks.filter((task) => task.type !== 'prayer')
  if (!params.prayerTimes) return withoutPrayers
  const prayers = prayerTasks(params.userId, params.dateKey, params.prayerTimes, params.ramadanMode)
  return [
    ...withoutPrayers.map((task) => moveAroundPrayers(task, prayers)),
    ...prayers,
  ].sort((a, b) => a.timeMinutes - b.timeMinutes)
}

function addRecoveryTasks(tasks: DailyTask[], userId: string, dateKey: string, illness: IllnessType, now: number) {
  const label = illnessLabels[illness]
  const withoutGym = tasks.filter((task) => task.type !== 'gym' && !task.title.includes('قبل الجيم'))
  const additions: DailyTask[] = [
    {
      userId,
      dateKey,
      timeMinutes: now + 5,
      type: 'water',
      title: 'مياه وراحة',
      details: `بما إنك سجلت ${label}، اشرب مياه بهدوء وخد راحة. التطبيق لا يشخّص حالتك.`,
      waterAmountMl: 300,
      completed: false,
      contextKey: 'illness-water',
    },
    {
      userId,
      dateKey,
      timeMinutes: now + 25,
      type: 'checkin',
      title: 'قيّم حالتك بعد الراحة',
      details: illness === 'injury'
        ? 'متتمرنش على الألم أو الإصابة. لو الألم شديد أو مستمر، اطلب تقييمًا طبيًا.'
        : 'لو الأعراض قوية، مستمرة، أو بتسوء، تواصل مع طبيب أو جهة طبية مناسبة.',
      completed: false,
      contextKey: 'illness-checkin',
    },
  ]

  return [...withoutGym, ...additions]
}

function applyLowEnergy(tasks: DailyTask[], userId: string, dateKey: string, now: number) {
  const updated = tasks.map((task) => {
    if (task.completed || task.type !== 'gym') return task
    return {
      ...task,
      timeMinutes: Math.max(task.timeMinutes, now + 90),
      details: 'طاقتك قليلة. خُد راحة وكل واشرب الأول، وبعدها قرر الجيم حسب إحساسك الحقيقي.',
    }
  })

  if (!updated.some((task) => task.contextKey === 'low-energy-reset' && !task.completed)) {
    updated.push({
      userId,
      dateKey,
      timeMinutes: now + 15,
      type: 'checkin',
      title: 'راحة قصيرة ثم قيّم طاقتك',
      details: 'خد 15–20 دقيقة هدوء، واشرب مياه. لو التعب حقيقي أو مستمر، شيل الجيم النهارده.',
      completed: false,
      contextKey: 'low-energy-reset',
    })
  }

  return updated
}

function applyRamadanMode(
  tasks: DailyTask[],
  userId: string,
  dateKey: string,
  prayerTimes: PrayerTimesResult,
  nowMinutes: number,
) {
  const fajr = parseTime(prayerTimes.timings.Fajr)
  const maghrib = parseTime(prayerTimes.timings.Maghrib)
  const isha = parseTime(prayerTimes.timings.Isha)

  const kept = tasks.filter((task) => {
    if (task.completed) return true
    if (task.type === 'meal') return false
    if (task.type === 'water' && task.timeMinutes >= fajr && task.timeMinutes < maghrib) return false
    return true
  }).map((task) => {
    if (task.type === 'gym' && !task.completed) {
      return {
        ...task,
        timeMinutes: Math.max(task.timeMinutes, maghrib + 120),
        details: 'في وضع رمضان، الجيم اتظبط بعد الإفطار بوقت مناسب. قلل الشدة لو نومك أو طاقتك منخفضين.',
      }
    }
    if (task.type === 'creatine' && !task.completed) {
      return {
        ...task,
        timeMinutes: Math.max(task.timeMinutes, maghrib + 60),
        details: 'خد جرعتك المعتادة بعد الإفطار أو بعد الجيم، مع مياه كفاية بين المغرب والفجر.',
      }
    }
    return task
  })

  const additions: DailyTask[] = [
    {
      userId,
      dateKey,
      timeMinutes: maghrib + 5,
      type: 'meal',
      title: 'الإفطار',
      details: 'ابدأ بهدوء، واشرب مياه على مراحل، وبعدها كمل وجبتك بدون استعجال.',
      completed: false,
      contextKey: 'ramadan-iftar',
    },
    {
      userId,
      dateKey,
      timeMinutes: maghrib + 25,
      type: 'water',
      title: 'مياه بعد الإفطار',
      details: 'وزّع المياه من المغرب للفجر بدل شرب كمية كبيرة مرة واحدة.',
      waterAmountMl: 400,
      completed: false,
      contextKey: 'ramadan-water-1',
    },
    {
      userId,
      dateKey,
      timeMinutes: isha + 75,
      type: 'water',
      title: 'كمّل مياه رمضان',
      details: 'اشرب كمية معتدلة بعد العشاء أو التراويح.',
      waterAmountMl: 400,
      completed: false,
      contextKey: 'ramadan-water-2',
    },
  ]

  const gymTask = kept.find((task) => task.type === 'gym' && !task.completed)
  if (gymTask) {
    additions.push({
      userId,
      dateKey,
      timeMinutes: gymTask.timeMinutes + 60,
      type: 'meal',
      title: 'وجبة بعد الجيم',
      details: 'اختار بروتين ووجبة متوازنة، وكمل مياهك تدريجيًا.',
      completed: false,
      contextKey: 'ramadan-post-gym',
    })
  }

  if (fajr >= 75 && nowMinutes < fajr) {
    additions.push({
      userId,
      dateKey,
      timeMinutes: fajr - 60,
      type: 'meal',
      title: 'السحور',
      details: 'اختار بروتين + نشويات مناسبة + مياه، وقلل الملح لو العطش بيتعبك.',
      completed: false,
      contextKey: 'ramadan-suhoor',
    })
  }

  return [...kept, ...additions]
}

export function applyDayIntelligence(params: {
  tasks: DailyTask[]
  meals: MealPlanItem[]
  events: DayEvent[]
  preferences: UserPreferences
  prayerTimes: PrayerTimesResult | null
  userId: string
  dateKey: string
  nowMinutes: number
}) {
  const { events, preferences, prayerTimes, userId, dateKey, nowMinutes } = params
  const context = getDayContext(events)
  let tasks = params.tasks.filter((task) => task.type !== 'prayer')
  let meals = [...params.meals]

  if (context.illness) {
    tasks = addRecoveryTasks(tasks, userId, dateKey, context.illness, nowMinutes)
    meals = meals.filter((meal) => !meal.title.includes('قبل الجيم'))
  } else if (context.energy === 'low') {
    tasks = applyLowEnergy(tasks, userId, dateKey, nowMinutes)
  }

  if (preferences.ramadanMode && prayerTimes) {
    const fajr = parseTime(prayerTimes.timings.Fajr)
    const maghrib = parseTime(prayerTimes.timings.Maghrib)
    tasks = applyRamadanMode(tasks, userId, dateKey, prayerTimes, nowMinutes)
    meals = meals.filter((meal) => meal.timeMinutes < fajr || meal.timeMinutes >= maghrib)
  }

  tasks = applyPrayerPriority({
    tasks,
    prayerTimes,
    userId,
    dateKey,
    ramadanMode: Boolean(preferences.ramadanMode),
  })

  return {
    tasks,
    meals,
    context,
  }
}

const baseShoppingIds = ['eggs', 'yogurt-plain', 'tuna-water', 'bread-baladi', 'banana', 'cucumber']
const winterFruitIds = ['orange', 'mandarin', 'apple']
const summerFruitIds = ['mango', 'watermelon', 'grapes']

export function buildSmartShoppingList(params: {
  allFoods: FoodCatalogItem[]
  availableIds: Set<string>
  goal: Goal
  recentLogs: MealLog[]
}) {
  const { allFoods, availableIds, goal, recentLogs } = params
  const season = getEgyptSeason()
  const byId = new Map(allFoods.map((food) => [food.id, food]))
  const availableFoods = allFoods.filter((food) => availableIds.has(food.id))
  const hasProtein = availableFoods.some((food) => food.category === 'protein' || food.category === 'dairy')
  const hasFruit = availableFoods.some((food) => food.category === 'fruit')
  const hasVegetable = availableFoods.some((food) => food.category === 'vegetable')
  const hasCarb = availableFoods.some((food) => food.category === 'carb')

  const ids: string[] = []
  if (!hasProtein) ids.push('eggs', 'tuna-water', 'yogurt-greek')
  if (!hasCarb) ids.push('bread-baladi', 'oats')
  if (!hasVegetable) ids.push('cucumber', 'mixed-salad')
  if (!hasFruit) ids.push(...(season === 'winter' ? winterFruitIds : summerFruitIds))
  if (goal.primary === 'lean_gain') ids.push('milk-whole', 'peanut-butter', 'banana')
  if (goal.primary === 'fat_loss') ids.push('cottage-cheese', 'yogurt-greek', 'mixed-salad')
  ids.push(...baseShoppingIds)

  const recentCounts = new Map<string, number>()
  recentLogs.slice(-30).forEach((log) => recentCounts.set(log.foodId, (recentCounts.get(log.foodId) ?? 0) + 1))
  const frequentMissing = [...recentCounts.entries()]
    .filter(([id]) => !availableIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  ids.unshift(...frequentMissing)

  const unique = [...new Set(ids)]
    .filter((id) => !availableIds.has(id))
    .map((id) => byId.get(id))
    .filter((food): food is FoodCatalogItem => Boolean(food))
    .filter((food) => food.category !== 'fruit' || isFoodInSeason(food, season) || food.season === 'all')
    .slice(0, 7)

  return unique
}

export interface MealAnalysis {
  verdict: string
  detail: string
  additions: FoodCatalogItem[]
  enough: boolean
}

export function analyzeMealChoice(food: FoodCatalogItem, availableFoods: FoodCatalogItem[], remainingProtein = 0): MealAnalysis {
  const additions: FoodCatalogItem[] = []
  const hasStrongProtein = food.protein >= 22
  const isComplete = food.kind === 'complete_meal' || food.category === 'meal'
  const highCalories = food.calories >= 600

  if (!hasStrongProtein && remainingProtein > 25) {
    const protein = availableFoods.find((item) =>
      item.id !== food.id && (item.category === 'protein' || item.category === 'dairy') && item.protein >= 8,
    )
    if (protein) additions.push(protein)
  }

  if (!isComplete && food.category === 'protein') {
    const carb = availableFoods.find((item) => item.category === 'carb' && item.id !== food.id)
    const vegetable = availableFoods.find((item) => item.category === 'vegetable' && item.id !== food.id)
    if (carb) additions.push(carb)
    if (vegetable) additions.push(vegetable)
  }

  if (isComplete && !highCalories) {
    const produce = availableFoods.find((item) =>
      (item.category === 'vegetable' || item.category === 'fruit') && item.id !== food.id,
    )
    if (produce) additions.push(produce)
  }

  const unique = [...new Map(additions.map((item) => [item.id, item])).values()].slice(0, 3)
  const enough = highCalories || (hasStrongProtein && isComplete) || unique.length === 0

  if (enough) {
    return {
      verdict: 'الوجبة كفاية غالبًا',
      detail: highCalories
        ? 'الوجبة مش محتاجة إضافات كبيرة. سجّلها وكمل باقي اليوم أخف بشكل طبيعي.'
        : 'تركيبتها مناسبة لوقتك الحالي، ومتزودش حاجة إلا لو لسه جعان فعلًا.',
      additions: [],
      enough: true,
    }
  }

  return {
    verdict: 'مناسبة، لكن ينقصها جزء بسيط',
    detail: unique.length
      ? `من الموجود عندك أضف: ${unique.map((item) => item.nameAr).join(' أو ')}.`
      : 'كمّلها بمصدر بروتين أو خضار بسيط حسب المتاح عندك.',
    additions: unique,
    enough: false,
  }
}

export function frequentMealIds(logs: MealLog[], limit = 5) {
  const counts = new Map<string, number>()
  logs.forEach((log) => counts.set(log.foodId, (counts.get(log.foodId) ?? 0) + 1))
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
