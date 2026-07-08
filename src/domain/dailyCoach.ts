import type { DailyCheckIn, DailyTask, FoodCatalogItem, Goal, GoalType, MealPlanItem, UserPreferences, UserProfile } from './models'

export interface DailyTargets {
  calories: number
  proteinG: number
  waterMl: number
}

export interface GoalRecommendation {
  goal: GoalType
  title: string
  summary: string
  reasons: string[]
  bmi: number
  waistToHeight?: number
}

export const goalLabels: Record<GoalType, string> = {
  fat_loss: 'خسارة الدهون مع الحفاظ على العضلات',
  lean_gain: 'بناء عضلات بزيادة محسوبة',
  recomp: 'إعادة تكوين الجسم',
  maintain: 'الحفاظ على الوزن وتحسين العادات',
}

const goalSummaries: Record<GoalType, string> = {
  fat_loss: 'سنخفض السعرات بشكل معتدل ونحافظ على بروتين مرتفع حتى تخسر دهونًا بدون خطة قاسية.',
  lean_gain: 'سنضيف زيادة صغيرة ومحسوبة في السعرات لدعم بناء العضلات بدون تضخيم عشوائي.',
  recomp: 'سنقترب من سعرات الثبات مع بروتين مرتفع وتنظيم الوجبات حتى يتحسن شكل الجسم تدريجيًا.',
  maintain: 'سنثبت السعرات تقريبًا ونركز على جودة الأكل والنوم والمياه وثبات الوزن.',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const roundTo = (value: number, step: number) => Math.round(value / step) * step

export function recommendGoal(profile: UserProfile): GoalRecommendation {
  const safeHeightCm = Math.max(profile.heightCm, 120)
  const heightM = safeHeightCm / 100
  const bmi = profile.currentWeightKg / (heightM * heightM)
  const waistToHeight = profile.waistCm && profile.waistCm > 0 ? profile.waistCm / safeHeightCm : undefined
  const experience = profile.trainingExperience ?? 'new'
  const trend = profile.weightTrend ?? 'stable'
  const reasons: string[] = []
  let goal: GoalType

  if ((waistToHeight !== undefined && waistToHeight >= 0.56) || bmi >= 29) {
    goal = 'fat_loss'
    reasons.push('محيط الخصر أو الوزن بالنسبة للطول مرتفع نسبيًا، لذلك البداية بخفض الدهون أكثر منطقية من زيادة السعرات.')
  } else if ((waistToHeight !== undefined && waistToHeight >= 0.51) || bmi >= 26.5) {
    goal = 'fat_loss'
    reasons.push('هناك مساحة جيدة لخفض الدهون أولًا مع الحفاظ على العضلات بدل الدخول في زيادة سعرات الآن.')
  } else if (experience === 'new' && bmi >= 20.5 && bmi <= 28) {
    goal = 'recomp'
    reasons.push('أنت جديد نسبيًا على الجيم، لذلك إعادة تكوين الجسم خيار عملي بدل تضخيم أو تنشيف قوي من البداية.')
  } else if (bmi < 20.5 || (bmi < 22 && (waistToHeight === undefined || waistToHeight < 0.47))) {
    goal = 'lean_gain'
    reasons.push('وزنك منخفض نسبيًا بالنسبة لطولك، لذلك زيادة صغيرة ومحسوبة في السعرات أنسب لك.')
  } else if (waistToHeight !== undefined && waistToHeight >= 0.5) {
    goal = 'fat_loss'
    reasons.push('نسبة محيط الخصر إلى الطول تشير إلى أن تقليل الدهون أولًا سيكون أنسب من زيادة الوزن.')
  } else if (experience === 'new') {
    goal = 'recomp'
    reasons.push('خبرتك ما زالت محدودة، لذلك سنبدأ بخطة متوازنة تبني العضلات وتحسن شكل الجسم بدون تغييرات حادة في السعرات.')
  } else if (bmi < 23 && trend !== 'gaining') {
    goal = 'lean_gain'
    reasons.push('وزنك مناسب للبدء بزيادة هادئة في السعرات لدعم بناء العضلات مع مراقبة الخصر والوزن.')
  } else {
    goal = 'maintain'
    reasons.push('مؤشراتك الحالية متوازنة نسبيًا، لذلك الأفضل تثبيت الوزن وتحسين جودة يومك ومراقبة الاتجاه.')
  }

  if (trend === 'gaining' && goal === 'lean_gain') {
    reasons.push('بما أن وزنك يزيد بالفعل، ستكون الزيادة في السعرات محافظة جدًا حتى لا ترتفع الدهون بسرعة.')
  }
  if (profile.waistCm) {
    reasons.push('التوصية استخدمت الطول والوزن ومحيط الخصر مع خبرتك واتجاه وزنك، وليست مبنية على الوزن وحده.')
  } else {
    reasons.push('أضف محيط الخصر لتحسين دقة التوصية أكثر.')
  }

  return {
    goal,
    title: goalLabels[goal],
    summary: goalSummaries[goal],
    reasons,
    bmi: Number(bmi.toFixed(1)),
    waistToHeight: waistToHeight === undefined ? undefined : Number(waistToHeight.toFixed(2)),
  }
}

export function dateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return ((hours || 0) * 60 + (minutes || 0)) % 1440
}

export function minutesToTimeInput(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatTimeAr(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440
  const hours24 = Math.floor(normalized / 60)
  const minutes = normalized % 60
  const suffix = hours24 < 12 ? 'ص' : 'م'
  const hour12 = hours24 % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function calculateTargets(profile: UserProfile, goal: Goal): DailyTargets {
  const currentYear = new Date().getFullYear()
  const age = clamp(currentYear - profile.birthYear, 16, 80)
  const bmr = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * age + 5
  const activityFactor = profile.activityLevel === 'high' ? 1.7 : profile.activityLevel === 'moderate' ? 1.5 : 1.3
  const adjustment = goal.primary === 'fat_loss' ? -300 : goal.primary === 'lean_gain' ? 200 : 0
  const calories = roundTo(clamp(bmr * activityFactor + adjustment, 1500, 4500), 50)
  const proteinRate = goal.primary === 'fat_loss' || goal.primary === 'recomp' ? 1.9 : goal.primary === 'lean_gain' ? 1.8 : 1.6
  const proteinG = Math.round(profile.currentWeightKg * proteinRate)
  const waterMl = roundTo(clamp(profile.currentWeightKg * 35, 2000, 4500), 250)
  return { calories, proteinG, waterMl }
}

function adjustedTomorrowWake(actualWake: number, targetWake: number): number {
  let diff = targetWake - actualWake
  if (diff > 720) diff -= 1440
  if (diff < -720) diff += 1440
  const adjustment = clamp(diff, -60, 60)
  return (actualWake + adjustment + 1440) % 1440
}

function chooseGymTime(wake: number, period: UserPreferences['gymPeriod']): number {
  if (period === 'afternoon') return clamp(wake + 7 * 60, 15 * 60, 18 * 60)
  if (period === 'evening') return clamp(wake + 9 * 60, 18 * 60, 21 * 60 + 30)
  return clamp(wake + 9 * 60, 16 * 60, 21 * 60)
}

function pick(items: FoodCatalogItem[], category: FoodCatalogItem['category'], fallback?: FoodCatalogItem): FoodCatalogItem | undefined {
  return items.find((item) => item.category === category) ?? fallback
}

function servingsForProtein(item: FoodCatalogItem | undefined, targetProtein: number): number {
  if (!item || item.protein <= 0) return 0
  return clamp(Math.ceil(targetProtein / item.protein), 1, 3)
}

function ingredientLine(item: FoodCatalogItem, servings: number): string {
  return servings <= 1 ? `${item.nameAr} — ${item.servingLabel}` : `${servings} × ${item.nameAr} (${item.servingLabel})`
}

function buildMeal(title: string, timeMinutes: number, foods: FoodCatalogItem[], proteinTarget: number, calorieShare: number): MealPlanItem | null {
  if (!foods.length) return null
  const protein = pick(foods, 'protein') ?? pick(foods, 'dairy')
  const carb = pick(foods, 'carb')
  const fruit = pick(foods, 'fruit')
  const vegetable = pick(foods, 'vegetable')
  const fat = pick(foods, 'fat')

  const selected: Array<{ item: FoodCatalogItem; servings: number }> = []
  if (protein) selected.push({ item: protein, servings: servingsForProtein(protein, proteinTarget) })
  if (carb) selected.push({ item: carb, servings: calorieShare > 500 ? 2 : 1 })
  if (title.includes('فطار') && fruit) selected.push({ item: fruit, servings: 1 })
  else if (vegetable) selected.push({ item: vegetable, servings: 1 })
  else if (fruit) selected.push({ item: fruit, servings: 1 })
  if (selected.length < 3 && fat) selected.push({ item: fat, servings: 1 })

  if (!selected.length) selected.push({ item: foods[0], servings: 1 })
  const calories = Math.round(selected.reduce((sum, entry) => sum + entry.item.calories * entry.servings, 0))
  const proteinG = Math.round(selected.reduce((sum, entry) => sum + entry.item.protein * entry.servings, 0))
  return {
    userId: '',
    dateKey: '',
    timeMinutes,
    title,
    ingredients: selected.map((entry) => ingredientLine(entry.item, entry.servings)),
    calories,
    protein: proteinG,
  }
}

export function buildDailyPlan(params: {
  profile: UserProfile
  goal: Goal
  preferences: UserPreferences
  checkIn: DailyCheckIn
  availableFoods: FoodCatalogItem[]
}): { tasks: DailyTask[]; meals: MealPlanItem[]; targets: DailyTargets; gymTime?: number; tomorrowWake: number; bedtime: number } {
  const { profile, goal, preferences, checkIn, availableFoods } = params
  const targets = calculateTargets(profile, goal)
  const wake = timeToMinutes(checkIn.wakeTime)
  const targetWake = timeToMinutes(preferences.targetWakeTime)
  const tomorrowWake = adjustedTomorrowWake(wake, targetWake)
  const bedtimeClock = (tomorrowWake - Math.round(preferences.desiredSleepHours * 60) + 1440) % 1440
  const bedtime = bedtimeClock <= wake ? bedtimeClock + 1440 : bedtimeClock
  const gymTime = checkIn.goingGym ? chooseGymTime(wake, preferences.gymPeriod) : undefined
  const date = checkIn.dateKey
  const userId = checkIn.userId

  const mealTimes = checkIn.goingGym && gymTime !== undefined
    ? [wake + 45, gymTime - 210, gymTime - 60, gymTime + 45]
    : [wake + 45, wake + 5 * 60, wake + 8 * 60, wake + 11 * 60]
  const mealTitles = checkIn.goingGym
    ? ['الفطار', 'وجبة رئيسية قبل الجيم', 'سناك خفيف قبل الجيم', 'وجبة بعد الجيم']
    : ['الفطار', 'الغداء', 'سناك', 'العشاء']

  const meals = mealTimes
    .map((time, index) => buildMeal(mealTitles[index], time, availableFoods, Math.ceil(targets.proteinG / 4), targets.calories / 4))
    .filter((meal): meal is MealPlanItem => meal !== null)
    .map((meal) => ({ ...meal, userId, dateKey: date }))

  const tasks: DailyTask[] = []
  const addTask = (timeMinutes: number, type: DailyTask['type'], title: string, details: string) => {
    tasks.push({ userId, dateKey: date, timeMinutes, type, title, details, completed: false })
  }

  addTask(wake + 5, 'water', 'ابدأ يومك بالمياه', 'اشرب 400–500 مل مياه بهدوء خلال أول نصف ساعة من الاستيقاظ.')
  meals.forEach((meal) => addTask(meal.timeMinutes, 'meal', meal.title, meal.ingredients.join(' + ')))
  addTask(wake + 2 * 60, 'water', 'دفعة مياه', 'اشرب 300–500 مل مياه.')
  addTask(wake + 6 * 60, 'water', 'كمّل هدف المياه', 'اشرب 300–500 مل مياه وراجع تقدّمك.')

  if (gymTime !== undefined) {
    addTask(gymTime, 'gym', 'وقت الجيم', 'روح الجيم الآن. توقيت الأكل والمياه قبل الجيم اتظبط بالفعل في خطة يومك.')
    if (preferences.creatineEnabled) {
      addTask(gymTime + 45, 'creatine', 'خد الكرياتين', `خد جرعتك اليومية المسجلة: ${preferences.creatineDoseG} جم، مع وجبة ما بعد الجيم أو بعدها مباشرة.`)
    }
  } else if (preferences.creatineEnabled) {
    addTask(wake + 5 * 60, 'creatine', 'خد الكرياتين', `خد جرعتك اليومية المسجلة: ${preferences.creatineDoseG} جم مع وجبة رئيسية.`)
  }

  addTask(bedtime - 45, 'sleep', 'ابدأ تهدئة اليوم', 'قلل الإضاءة والشاشات وجهّز نفسك للنوم.')
  addTask(bedtime, 'sleep', 'ميعاد النوم المقترح', `نام الآن لتقرب من ${preferences.desiredSleepHours} ساعات نوم وتصحى تقريبًا ${formatTimeAr(tomorrowWake)}.`)

  tasks.sort((a, b) => a.timeMinutes - b.timeMinutes)
  return { tasks, meals, targets, gymTime, tomorrowWake, bedtime }
}

export function taskState(taskTime: number, now = new Date()): 'past' | 'now' | 'future' {
  const current = now.getHours() * 60 + now.getMinutes()
  const delta = taskTime - current
  if (Math.abs(delta) <= 45) return 'now'
  return delta < 0 ? 'past' : 'future'
}

export function normalizeGoal(raw: Goal | undefined, userId: string): Goal {
  const primaryRaw = (raw as { primary?: string } | undefined)?.primary
  const primary: Goal['primary'] = primaryRaw === 'fat_loss'
    ? 'fat_loss'
    : primaryRaw === 'recomp'
      ? 'recomp'
      : primaryRaw === 'maintain' || primaryRaw === 'healthy' || primaryRaw === 'fitness'
        ? 'maintain'
        : 'lean_gain'
  return { id: raw?.id, userId, primary, targetWeightKg: raw?.targetWeightKg }
}

export function normalizePreferences(raw: UserPreferences | undefined, userId: string): UserPreferences {
  const source = raw as Partial<UserPreferences> | undefined
  return {
    id: source?.id,
    userId,
    targetWakeTime: source?.targetWakeTime || '08:00',
    desiredSleepHours: Number(source?.desiredSleepHours) || 8,
    gymPeriod: source?.gymPeriod === 'afternoon' || source?.gymPeriod === 'evening' ? source.gymPeriod : 'auto',
    creatineEnabled: source?.creatineEnabled ?? true,
    creatineDoseG: Number(source?.creatineDoseG) || 5,
  }
}
