import type {
  DailyCheckIn,
  DailyTask,
  FoodCatalogItem,
  Goal,
  GoalType,
  MealPlanItem,
  UserPreferences,
  UserProfile,
} from './models'

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
  fat_loss: 'سنخفض السعرات بشكل معتدل ونحافظ على بروتين مرتفع بدون خطة قاسية.',
  lean_gain: 'سنضيف زيادة صغيرة ومحسوبة في السعرات لدعم بناء العضلات.',
  recomp: 'سنقترب من سعرات الثبات مع بروتين مرتفع وتنظيم الوجبات.',
  maintain: 'سنركز على جودة الأكل والنوم والمياه وثبات الوزن.',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const roundTo = (value: number, step: number) => Math.round(value / step) * step

export function recommendGoal(profile: UserProfile): GoalRecommendation {
  const safeHeightCm = Math.max(profile.heightCm, 120)
  const heightM = safeHeightCm / 100
  const bmi = profile.currentWeightKg / (heightM * heightM)
  const waistToHeight = profile.waistCm && profile.waistCm > 0
    ? profile.waistCm / safeHeightCm
    : undefined

  const experience = profile.trainingExperience ?? 'new'
  const trend = profile.weightTrend ?? 'stable'
  const reasons: string[] = []
  let goal: GoalType

  if ((waistToHeight !== undefined && waistToHeight >= 0.56) || bmi >= 29) {
    goal = 'fat_loss'
    reasons.push('الوزن بالنسبة للطول مرتفع نسبيًا، فخفض الدهون أولًا أنسب.')
  } else if ((waistToHeight !== undefined && waistToHeight >= 0.51) || bmi >= 26.5) {
    goal = 'fat_loss'
    reasons.push('خفض الدهون مع الحفاظ على العضلات أنسب من زيادة السعرات الآن.')
  } else if (experience === 'new' && bmi >= 20.5 && bmi <= 28) {
    goal = 'recomp'
    reasons.push('بما إنك جديد نسبيًا، إعادة تكوين الجسم بداية عملية ومتوازنة.')
  } else if (bmi < 20.5) {
    goal = 'lean_gain'
    reasons.push('وزنك منخفض نسبيًا بالنسبة لطولك، فزيادة صغيرة ومحسوبة أنسب.')
  } else if (experience === 'new') {
    goal = 'recomp'
    reasons.push('الأفضل تبدأ بخطة متوازنة بدون تضخيم أو تنشيف قوي.')
  } else if (bmi < 23 && trend !== 'gaining') {
    goal = 'lean_gain'
    reasons.push('زيادة هادئة في السعرات قد تكون مناسبة مع متابعة الوزن.')
  } else {
    goal = 'maintain'
    reasons.push('المؤشرات متوازنة نسبيًا، فالأفضل تثبيت العادات ومراقبة الاتجاه.')
  }

  if (profile.waistCm) {
    reasons.push('التوصية استخدمت الطول والوزن ومحيط الخصر والخبرة واتجاه الوزن.')
  } else {
    reasons.push('محيط الخصر اختياري، وإضافته لاحقًا تحسن دقة التوصية.')
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
  const age = clamp(new Date().getFullYear() - profile.birthYear, 16, 80)
  const bmr = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * age + 5
  const activityFactor =
    profile.activityLevel === 'high' ? 1.7 :
    profile.activityLevel === 'moderate' ? 1.5 : 1.3

  const adjustment =
    goal.primary === 'fat_loss' ? -300 :
    goal.primary === 'lean_gain' ? 200 : 0

  const calories = roundTo(clamp(bmr * activityFactor + adjustment, 1500, 4500), 50)
  const proteinRate =
    goal.primary === 'fat_loss' || goal.primary === 'recomp' ? 1.9 :
    goal.primary === 'lean_gain' ? 1.8 : 1.6

  return {
    calories,
    proteinG: Math.round(profile.currentWeightKg * proteinRate),
    waterMl: roundTo(clamp(profile.currentWeightKg * 35, 2000, 4500), 250),
  }
}

function chooseGymTime(wake: number, period: UserPreferences['gymPeriod']): number {
  if (period === 'afternoon') return clamp(wake + 7 * 60, 15 * 60, 18 * 60)
  if (period === 'evening') return clamp(wake + 9 * 60, 18 * 60, 21 * 60 + 30)
  return clamp(wake + 9 * 60, 16 * 60, 21 * 60)
}

function chooseFood(
  foods: FoodCatalogItem[],
  category: FoodCatalogItem['category'],
  usedIds: Set<string>,
): FoodCatalogItem | undefined {
  return foods.find((food) => food.category === category && !usedIds.has(food.id))
    ?? foods.find((food) => food.category === category)
}

function buildMeal(
  title: string,
  mealKey: string,
  timeMinutes: number,
  availableFoods: FoodCatalogItem[],
): MealPlanItem | null {
  if (!availableFoods.length) return null

  const usedIds = new Set<string>()
  const selected: FoodCatalogItem[] = []
  const isBreakfast = title.includes('فطار')
  const isSnack = title.includes('سناك')

  const protein = chooseFood(availableFoods, 'protein', usedIds)
    ?? chooseFood(availableFoods, 'dairy', usedIds)
  if (protein) {
    selected.push(protein)
    usedIds.add(protein.id)
  }

  if (!isSnack) {
    const carb = chooseFood(availableFoods, 'carb', usedIds)
    if (carb) {
      selected.push(carb)
      usedIds.add(carb.id)
    }
  }

  const produce = chooseFood(
    availableFoods,
    isBreakfast || isSnack ? 'fruit' : 'vegetable',
    usedIds,
  )
  if (produce) {
    selected.push(produce)
    usedIds.add(produce.id)
  }

  if (selected.length < 2) {
    const dairy = chooseFood(availableFoods, 'dairy', usedIds)
    if (dairy) selected.push(dairy)
  }

  if (!selected.length) return null

  return {
    userId: '',
    dateKey: '',
    mealKey,
    timeMinutes,
    title,
    foodIds: selected.map((food) => food.id),
    ingredients: selected.map((food) => `${food.nameAr} — ${food.servingLabel}`),
    calories: selected.reduce((sum, food) => sum + food.calories, 0),
    protein: Math.round(selected.reduce((sum, food) => sum + food.protein, 0)),
  }
}

export function buildDailyPlan(params: {
  profile: UserProfile
  goal: Goal
  preferences: UserPreferences
  checkIn: DailyCheckIn
  availableFoods: FoodCatalogItem[]
}): { tasks: DailyTask[]; meals: MealPlanItem[]; targets: DailyTargets; gymTime?: number } {
  const { profile, goal, preferences, checkIn, availableFoods } = params
  const targets = calculateTargets(profile, goal)
  const wake = timeToMinutes(checkIn.wakeTime)
  const gymTime = checkIn.goingGym
    ? (checkIn.customGymTime ? timeToMinutes(checkIn.customGymTime) : chooseGymTime(wake, preferences.gymPeriod))
    : undefined

  const date = checkIn.dateKey
  const userId = checkIn.userId

  const mealTimes = checkIn.goingGym && gymTime !== undefined
    ? [wake + 45, gymTime - 210, gymTime - 60, gymTime + 45]
    : [wake + 45, wake + 5 * 60, wake + 8 * 60, wake + 11 * 60]

  const mealTitles = checkIn.goingGym
    ? ['الفطار', 'وجبة رئيسية قبل الجيم', 'سناك خفيف قبل الجيم', 'وجبة بعد الجيم']
    : ['الفطار', 'الغداء', 'سناك', 'العشاء']

  const meals = mealTimes
    .map((time, index) => buildMeal(
      mealTitles[index],
      `meal-${index + 1}`,
      time,
      availableFoods,
    ))
    .filter((meal): meal is MealPlanItem => meal !== null)
    .map((meal) => ({ ...meal, userId, dateKey: date }))

  const tasks: DailyTask[] = []

  const addTask = (
    timeMinutes: number,
    type: DailyTask['type'],
    title: string,
    details: string,
    options?: Pick<DailyTask, 'waterAmountMl' | 'mealKey'>,
  ) => {
    tasks.push({
      userId,
      dateKey: date,
      timeMinutes,
      type,
      title,
      details,
      completed: false,
      ...options,
    })
  }

  addTask(
    wake + 5,
    'water',
    'ابدأ يومك بالمياه',
    'اشرب 450 مل مياه بهدوء خلال أول نصف ساعة من الاستيقاظ.',
    { waterAmountMl: 450 },
  )

  meals.forEach((meal) => addTask(
    meal.timeMinutes,
    'meal',
    meal.title,
    meal.ingredients.join(' + '),
    { mealKey: meal.mealKey },
  ))

  addTask(wake + 2 * 60, 'water', 'دفعة مياه', 'اشرب 400 مل مياه.', { waterAmountMl: 400 })
  addTask(wake + 6 * 60, 'water', 'كمّل هدف المياه', 'اشرب 400 مل مياه.', { waterAmountMl: 400 })

  if (gymTime !== undefined) {
    addTask(gymTime, 'gym', 'ميعاد الجيم', 'لما تتحرك اضغط «رايح الجيم» من مدير يومك.')

    if (preferences.creatineEnabled) {
      addTask(
        gymTime + 60,
        'creatine',
        'الكرياتين',
        `لو لسه ماخدتوش، سجل جرعتك المعتادة: ${preferences.creatineDoseG} جم.`,
      )
    }
  } else if (preferences.creatineEnabled) {
    addTask(
      wake + 5 * 60,
      'creatine',
      'الكرياتين',
      `خد جرعتك المعتادة ${preferences.creatineDoseG} جم مع وجبة رئيسية.`,
    )
  }

  tasks.sort((a, b) => a.timeMinutes - b.timeMinutes)
  return { tasks, meals, targets, gymTime }
}

export function normalizeGoal(raw: Goal | undefined, userId: string): Goal {
  const primaryRaw = (raw as { primary?: string } | undefined)?.primary
  const primary: Goal['primary'] =
    primaryRaw === 'fat_loss' ? 'fat_loss' :
    primaryRaw === 'recomp' ? 'recomp' :
    primaryRaw === 'maintain' ? 'maintain' : 'lean_gain'

  return {
    id: raw?.id,
    userId,
    primary,
    targetWeightKg: raw?.targetWeightKg,
  }
}

export function normalizePreferences(raw: UserPreferences | undefined, userId: string): UserPreferences {
  const source = raw as Partial<UserPreferences> | undefined
  return {
    id: source?.id,
    userId,
    gymPeriod:
      source?.gymPeriod === 'afternoon' || source?.gymPeriod === 'evening'
        ? source.gymPeriod
        : 'auto',
    creatineEnabled: source?.creatineEnabled ?? true,
    creatineDoseG: Number(source?.creatineDoseG) || 5,
  }
}
