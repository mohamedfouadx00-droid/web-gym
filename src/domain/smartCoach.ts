import type {
  Goal,
  PrescribedExercise,
  RecoveryLog,
  UserPreferences,
  UserProfile,
  WorkoutSession,
} from './models'

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isSameLocalDay(value: string, date = new Date()): boolean {
  return localDateKey(new Date(value)) === localDateKey(date)
}

export function calculateReadiness(log?: RecoveryLog): number | null {
  if (!log) return null
  const sleep = Math.min(100, (log.sleepHours / 8) * 100) * 0.35
  const quality = log.sleepQuality * 10 * 0.15
  const fatigue = (10 - log.fatigue) * 10 * 0.2
  const soreness = (10 - log.soreness) * 10 * 0.15
  const pain = (10 - log.pain) * 10 * 0.15
  return Math.max(0, Math.min(100, Math.round(sleep + quality + fatigue + soreness + pain)))
}

export type TodayActionType = 'checkin' | 'workout' | 'recovery' | 'active_recovery' | 'post_workout'

export interface TodayAction {
  type: TodayActionType
  title: string
  message: string
  cta: string
  route: string
  priority: 'high' | 'normal'
}

export function getTodayAction(
  preferences: UserPreferences | undefined,
  recoveryLogs: RecoveryLog[],
  workouts: WorkoutSession[],
): TodayAction {
  const todayRecovery = recoveryLogs.find((item) => isSameLocalDay(item.date))
  const completedToday = workouts.some((item) => item.endedAt && isSameLocalDay(item.endedAt))

  if (completedToday) {
    return {
      type: 'post_workout',
      title: 'تمرينك خلص، دلوقتي دور التعافي',
      message: 'سجّل وجبتك التالية واشرب مياه، وسيب العضلات تتعافى قبل الجلسة القادمة.',
      cta: 'شوف أكلك دلوقتي',
      route: '/nutrition',
      priority: 'normal',
    }
  }

  if (!todayRecovery) {
    return {
      type: 'checkin',
      title: 'قبل ما أقولك تتمرن ولا ترتاح',
      message: 'سجّل نومك والإجهاد والألم في أقل من دقيقة، وبعدها القرار هيظهر تلقائيًا.',
      cta: 'احسب جاهزيتي',
      route: '/recovery',
      priority: 'high',
    }
  }

  const score = calculateReadiness(todayRecovery) ?? 0
  if (todayRecovery.pain >= 5) {
    return {
      type: 'recovery',
      title: 'النهارده مش يوم ضغط على جسمك',
      message: 'الألم المسجل مرتفع. أوقف التمرين على المنطقة المؤلمة وركز على التعافي، واستعن بمتخصص إذا الألم شديد أو مستمر.',
      cta: 'خطة التعافي',
      route: '/recovery',
      priority: 'high',
    }
  }

  if (score < 55) {
    return {
      type: 'recovery',
      title: 'النهارده تعافي أفضل من تمرين قوي',
      message: 'جاهزيتك منخفضة. خفف المجهود واعمل حركة بسيطة بدل جلسة مقاومة كاملة.',
      cta: 'شوف قرار التعافي',
      route: '/recovery',
      priority: 'high',
    }
  }

  const todayName = DAY_NAMES[new Date().getDay()]
  const isWorkoutDay = preferences?.workoutDays.includes(todayName) ?? false
  if (!isWorkoutDay) {
    return {
      type: 'active_recovery',
      title: 'النهارده راحة محسوبة',
      message: 'امشِ مشيًا خفيفًا، اشرب مياه، واهتم بالنوم. تمرينك القادم محفوظ ومجهز.',
      cta: 'شوف تمرينك القادم',
      route: '/workout',
      priority: 'normal',
    }
  }

  return {
    type: 'workout',
    title: 'جاهز. تمرين اليوم متجهز لك',
    message: score >= 75 ? 'جاهزيتك جيدة. نفّذ الخطة كما هي.' : 'جاهزيتك متوسطة. هنحافظ على التكنيك ونقلل الضغط لو لزم.',
    cta: 'ابدأ تمرين اليوم',
    route: '/workout',
    priority: 'high',
  }
}

const GYM_PLAN_A: PrescribedExercise[] = [
  { exerciseId: 'leg-press', sets: 2, minReps: 8, maxReps: 12, restSeconds: 120, reason: 'تقوية الرجلين بحركة سهلة التعلم للمبتدئ' },
  { exerciseId: 'machine-chest-press', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'بناء الصدر والدفع مع ثبات أكبر' },
  { exerciseId: 'lat-pulldown', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'تقوية الظهر وتعلم السحب' },
  { exerciseId: 'seated-leg-curl', sets: 2, minReps: 10, maxReps: 15, restSeconds: 75, reason: 'تقوية العضلات الخلفية للرجل' },
  { exerciseId: 'plank', sets: 2, minReps: 20, maxReps: 40, restSeconds: 60, reason: 'تثبيت الجذع وتحسين التحكم' },
]

const GYM_PLAN_B: PrescribedExercise[] = [
  { exerciseId: 'goblet-squat', sets: 2, minReps: 8, maxReps: 12, restSeconds: 120, reason: 'تعلم السكوات بطريقة أبسط وأكثر تحكمًا' },
  { exerciseId: 'seated-row', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'تقوية منتصف الظهر وتحسين وضع الكتفين' },
  { exerciseId: 'machine-shoulder-press', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'تقوية الكتف بحركة ثابتة' },
  { exerciseId: 'hip-thrust-machine', sets: 2, minReps: 10, maxReps: 15, restSeconds: 90, reason: 'تقوية المؤخرة والورك' },
  { exerciseId: 'cable-curl', sets: 2, minReps: 10, maxReps: 15, restSeconds: 60, reason: 'إضافة بسيطة للذراع بعد الحركات الأساسية' },
]

const HOME_PLAN_A: PrescribedExercise[] = [
  { exerciseId: 'chair-squat', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'تعلم نمط السكوات بأمان باستخدام كرسي ثابت' },
  { exerciseId: 'incline-push-up', sets: 2, minReps: 8, maxReps: 12, restSeconds: 75, reason: 'تقوية الصدر بدرجة صعوبة يمكن التحكم فيها' },
  { exerciseId: 'backpack-row', sets: 2, minReps: 8, maxReps: 12, restSeconds: 75, reason: 'تقوية الظهر بأداة موجودة في البيت' },
  { exerciseId: 'glute-bridge', sets: 2, minReps: 10, maxReps: 15, restSeconds: 60, reason: 'تقوية المؤخرة والورك بدون أجهزة' },
  { exerciseId: 'dead-bug', sets: 2, minReps: 6, maxReps: 10, restSeconds: 45, reason: 'تعلم تثبيت الجذع والتحكم في الظهر' },
]

const HOME_PLAN_B: PrescribedExercise[] = [
  { exerciseId: 'reverse-lunge', sets: 2, minReps: 6, maxReps: 10, restSeconds: 90, reason: 'تقوية الرجلين والتوازن بشكل تدريجي' },
  { exerciseId: 'push-up', sets: 2, minReps: 6, maxReps: 12, restSeconds: 75, reason: 'تطوير قوة الدفع بعد الضغط المائل' },
  { exerciseId: 'backpack-rdl', sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, reason: 'تعلم حركة الورك وتقوية الخلفية' },
  { exerciseId: 'backpack-row', sets: 2, minReps: 8, maxReps: 12, restSeconds: 75, reason: 'استمرار تقوية الظهر والسحب' },
  { exerciseId: 'plank', sets: 2, minReps: 20, maxReps: 40, restSeconds: 60, reason: 'تثبيت الجذع وتحسين التحكم' },
]

export function buildBeginnerWorkoutPlan(
  workouts: WorkoutSession[],
  preferences?: UserPreferences,
  place: 'gym' | 'home' = 'gym',
): { id: string; title: string; estimatedMinutes: number; exercises: PrescribedExercise[] } {
  const placeHistory = workouts.filter((item) => item.endedAt && item.planId?.startsWith(place))
  const completed = placeHistory.length
  const usePlanA = completed % 2 === 0
  const base = place === 'home'
    ? (usePlanA ? HOME_PLAN_A : HOME_PLAN_B)
    : (usePlanA ? GYM_PLAN_A : GYM_PLAN_B)
  const allCompleted = workouts.filter((item) => item.endedAt).length
  const graduatedSets = allCompleted >= 4 ? base.map((item) => ({ ...item, sets: Math.min(3, item.sets + 1) })) : base
  const maxExercises = (preferences?.workoutDurationMin ?? 60) <= 40 ? 4 : graduatedSets.length
  const placeLabel = place === 'home' ? 'البيت' : 'الجيم'
  return {
    id: `${place}-beginner-full-body-${usePlanA ? 'a' : 'b'}`,
    title: `تمرين جسم كامل في ${placeLabel} ${usePlanA ? 'A' : 'B'}`,
    estimatedMinutes: maxExercises <= 4 ? 35 : 50,
    exercises: graduatedSets.slice(0, maxExercises),
  }
}

function roundToStep(value: number, step: number): number {
  return Math.max(0, Math.round(value / step) * step)
}

export interface WeightRecommendation {
  mode: 'calibration' | 'history'
  suggestedKg?: number
  title: string
  message: string
}

export function getWeightRecommendation(
  exerciseId: string,
  workouts: WorkoutSession[],
  repRange: { min: number; max: number },
  incrementKg = 2.5,
  startingWeightGuide: string,
): WeightRecommendation {
  if (incrementKg <= 0) {
    return {
      mode: 'calibration',
      suggestedKg: 0,
      title: 'استخدم وزن جسمك',
      message: startingWeightGuide,
    }
  }

  const latestEntry = workouts
    .filter((workout) => workout.endedAt)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .flatMap((workout) => workout.exercises)
    .find((entry) => entry.exerciseId === exerciseId && entry.sets.length > 0)

  if (!latestEntry) {
    return {
      mode: 'calibration',
      title: 'أول مرة؟ أنا هحدد الوزن معاك',
      message: startingWeightGuide,
    }
  }

  const validSets = latestEntry.sets.filter((set) => set.weightKg > 0)
  if (!validSets.length) {
    return { mode: 'calibration', title: 'اختبار الوزن الأول', message: startingWeightGuide }
  }

  const baseWeight = Math.max(...validSets.map((set) => set.weightKg))
  const avgRpe = validSets.reduce((sum, set) => sum + set.rpe, 0) / validSets.length
  const avgReps = validSets.reduce((sum, set) => sum + set.reps, 0) / validSets.length
  const poorForm = validSets.some((set) => set.formQuality === 'poor')

  if (poorForm || avgRpe >= 9 || avgReps < repRange.min) {
    const suggestedKg = roundToStep(Math.max(0, baseWeight - incrementKg), incrementKg)
    return { mode: 'history', suggestedKg, title: `ابدأ بـ ${suggestedKg} كجم`, message: 'هنقلل الحمل قليلًا عشان تكمل العدات بالتكنيك الصحيح.' }
  }

  if (avgReps >= repRange.max && avgRpe <= 8) {
    const suggestedKg = roundToStep(baseWeight + incrementKg, incrementKg)
    return { mode: 'history', suggestedKg, title: `ابدأ بـ ${suggestedKg} كجم`, message: 'أنت جاهز لزيادة صغيرة محسوبة عن آخر مرة.' }
  }

  return { mode: 'history', suggestedKg: baseWeight, title: `ابدأ بـ ${baseWeight} كجم`, message: 'نفس الوزن مناسب. حاول تحسن العدات أو جودة الحركة.' }
}

export function analyzeSet(
  weightKg: number,
  reps: number,
  rpe: number,
  formGood: boolean,
  minReps: number,
  maxReps: number,
  incrementKg: number,
): { nextWeightKg: number; message: string; tone: 'good' | 'adjust' | 'stop' } {
  if (incrementKg <= 0) {
    if (!formGood || rpe >= 10) return { nextWeightKg: 0, message: 'سهّل نسخة التمرين أو قلل العدات. التكنيك أهم من إنهاء المجموعة.', tone: 'stop' }
    if (reps < minReps || rpe >= 9) return { nextWeightKg: 0, message: 'استخدم نسخة أسهل في المجموعة القادمة وحافظ على المدى الصحيح.', tone: 'adjust' }
    if (reps >= maxReps && rpe <= 7) return { nextWeightKg: 0, message: 'ممتاز. في المرة القادمة استخدم نسخة أصعب قليلًا أو زوّد العدات تدريجيًا.', tone: 'good' }
    return { nextWeightKg: 0, message: 'النسخة الحالية مناسبة. كررها بنفس التكنيك.', tone: 'good' }
  }
  if (!formGood) return { nextWeightKg: roundToStep(Math.max(0, weightKg - incrementKg), incrementKg), message: 'التكنيك أهم من الرقم. قلل الوزن في المجموعة القادمة وركز على الحركة.', tone: 'adjust' }
  if (rpe >= 10) return { nextWeightKg: roundToStep(Math.max(0, weightKg - incrementKg), incrementKg), message: 'المجموعة كانت أقصى من المطلوب. قلل الوزن ولا تكرر محاولة فشل الآن.', tone: 'stop' }
  if (reps < minReps || rpe >= 9) return { nextWeightKg: roundToStep(Math.max(0, weightKg - incrementKg), incrementKg), message: 'الحمل أعلى من هدف المجموعة. قلل خطوة واحدة.', tone: 'adjust' }
  if (reps >= maxReps && rpe <= 7) return { nextWeightKg: roundToStep(weightKg + incrementKg, incrementKg), message: 'ممتاز. زوّد خطوة صغيرة في المجموعة القادمة.', tone: 'good' }
  return { nextWeightKg: weightKg, message: 'الوزن مناسب. ثبته في المجموعة القادمة.', tone: 'good' }
}

export interface NutritionTargets {
  calories: number
  proteinG: number
  carbsG: number
  fatsG: number
}

export function calculateNutritionTargets(profile: UserProfile, goal: Goal): NutritionTargets {
  const age = Math.max(18, new Date().getFullYear() - profile.birthYear)
  const bmr = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * age + 5
  const activityFactor = profile.activityLevel === 'high' ? 1.65 : profile.activityLevel === 'moderate' ? 1.45 : 1.3
  const maintenance = bmr * activityFactor
  const goalFactor: Record<Goal['primary'], number> = {
    muscle: 1.1,
    fat_loss: 0.85,
    recomp: 0.95,
    strength: 1.05,
    fitness: 1,
    maintain: 1,
  }
  const calories = Math.round((maintenance * goalFactor[goal.primary]) / 50) * 50
  const proteinG = Math.round(profile.currentWeightKg * 1.7)
  const fatsG = Math.round(profile.currentWeightKg * 0.8)
  const carbsG = Math.max(80, Math.round((calories - proteinG * 4 - fatsG * 9) / 4))
  return { calories, proteinG, carbsG, fatsG }
}

export function getMealNowSuggestion(
  hour: number,
  remainingCalories: number,
  remainingProtein: number,
): { title: string; items: string[]; reason: string } {
  if (remainingCalories <= 150 && remainingProtein <= 15) {
    return { title: 'هدفك اليوم شبه مكتمل', items: ['مياه', 'مشروب بدون سعرات عند الحاجة'], reason: 'مش محتاج تضيف وجبة كبيرة الآن.' }
  }
  if (hour < 11) {
    return { title: 'فطار بسيط عالي البروتين', items: ['3 بيضات', 'رغيف عيش بلدي', 'ثمرة فاكهة'], reason: 'بداية سهلة فيها بروتين وطاقة بدون تعقيد.' }
  }
  if (remainingProtein >= 45) {
    return { title: 'وجبة بروتين أساسية', items: ['200 جم صدر دجاج', 'أرز حسب السعرات المتبقية', 'طبق خضار'], reason: 'أكبر نقص عندك حاليًا هو البروتين.' }
  }
  if (hour >= 21) {
    return { title: 'وجبة خفيفة قبل نهاية اليوم', items: ['تونة مصفاة أو زبادي عالي البروتين', 'خبز حسب السعرات المتبقية'], reason: 'تكمل بروتينك بدون وجبة ثقيلة.' }
  }
  return { title: 'وجبة متوازنة الآن', items: ['مصدر بروتين', 'مصدر نشويات', 'خضار'], reason: 'اختيار متوازن مناسب للمتبقي من يومك.' }
}
