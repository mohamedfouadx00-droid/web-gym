import {
  availableFoodRepo,
  checkInRepo,
  customFoodRepo,
  dailyTaskRepo,
  dayEventRepo,
  goalRepo,
  mealLogRepo,
  mealPlanRepo,
  preferencesRepo,
  profileRepo,
  waterRepo,
  creatineRepo,
} from '../data/repositories'
import { foodCatalog } from '../data/foodCatalog'
import { buildDailyPlan, normalizeGoal, normalizePreferences, recommendGoal } from '../domain/dailyCoach'
import type { DailyTask, MealPlanItem } from '../domain/models'
import { applyDayIntelligence, applyPrayerPriority } from './dayIntelligenceService'
import { getCachedPrayerTimes } from './prayerTimesService'
import { applyOfflineSmartEngine, buildSmartDaySnapshot, isRamadanFastingNow } from './smartEngineService'

function gymStage(events: Awaited<ReturnType<typeof dayEventRepo.list>>) {
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

function isOutside(events: Awaited<ReturnType<typeof dayEventRepo.list>>) {
  const lastLocation = [...events].reverse().find((event) =>
    event.type === 'outside_home' || event.type === 'inside_home'
  )
  return lastLocation?.type === 'outside_home'
}

function isPreGym(title: string) {
  return title.includes('قبل الجيم') || title.includes('سناك خفيف قبل الجيم')
}

function supermarketText() {
  return 'اختار أول حاجة تلاقيها: 1) زبادي عالي البروتين + موزة، 2) تونة + عيش أو توست، 3) لبن + موز، 4) جبنة قريش أو بيضاء + عيش، 5) زبادي عادي + فاكهة.'
}

export async function regenerateDailyPlan(userId: string, date: string) {
  const [
    profile,
    rawGoal,
    rawPreferences,
    checkIn,
    foodRows,
    customFoods,
    events,
    oldTasks,
    mealLogs,
    waterLogs,
    creatineLog,
  ] = await Promise.all([
    profileRepo.get(userId),
    goalRepo.get(userId),
    preferencesRepo.get(userId),
    checkInRepo.get(userId, date),
    availableFoodRepo.list(userId, date),
    customFoodRepo.list(userId),
    dayEventRepo.list(userId, date),
    dailyTaskRepo.list(userId, date),
    mealLogRepo.list(userId, date),
    waterRepo.list(userId),
    creatineRepo.get(userId, date),
  ])

  if (!profile || !checkIn) return null

  const recommendation = recommendGoal(profile)
  const normalizedGoal = normalizeGoal(rawGoal, userId)
  const goal = { ...normalizedGoal, primary: recommendation.goal }
  if (!rawGoal || normalizedGoal.primary !== recommendation.goal) {
    await goalRepo.save(goal)
  }

  const preferences = normalizePreferences(rawPreferences, userId)
  const selectedIds = new Set(foodRows.map((row) => row.foodId))
  const allFoods = [...foodCatalog, ...customFoods]
  const availableFoods = allFoods.filter((food) => selectedIds.has(food.id))

  const plan = buildDailyPlan({
    profile,
    goal,
    preferences,
    checkIn,
    availableFoods,
  })

  const stage = gymStage(events)
  const outside = isOutside(events)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  let meals: MealPlanItem[] = [...plan.meals]
  let tasks: DailyTask[] = [...plan.tasks]

  if (stage === 'in_gym' || stage === 'finished') {
    meals = meals.filter((meal) => !isPreGym(meal.title))
    tasks = tasks.filter((task) =>
      task.type !== 'gym' &&
      !(task.type === 'meal' && isPreGym(task.title))
    )
  }

  if (outside) {
    tasks = tasks.map((task) => {
      if (task.completed || task.type !== 'meal' || task.timeMinutes < nowMinutes) {
        return task
      }

      return {
        ...task,
        title: 'اختيار من السوبر ماركت',
        details: supermarketText(),
        mealKey: undefined,
      }
    })
  }

  const prayerTimes = getCachedPrayerTimes()
  const intelligent = applyDayIntelligence({
    tasks,
    meals,
    events,
    preferences,
    prayerTimes,
    userId,
    dateKey: date,
    nowMinutes,
  })
  tasks = intelligent.tasks
  meals = intelligent.meals

  const snapshot = buildSmartDaySnapshot({
    now,
    checkIn,
    tasks,
    mealLogs,
    waterLogs,
    creatineLog,
    events,
    goal,
    waterTargetMl: plan.targets.waterMl,
    fastingNow: Boolean(preferences.ramadanMode) && isRamadanFastingNow(prayerTimes, nowMinutes),
  })
  const smart = applyOfflineSmartEngine({
    tasks,
    meals,
    snapshot,
    preferences,
    userId,
    dateKey: date,
  })
  tasks = applyPrayerPriority({
    tasks: smart.tasks,
    prayerTimes,
    userId,
    dateKey: date,
    ramadanMode: Boolean(preferences.ramadanMode),
  })
  meals = smart.meals

  const taskStateKey = (task: DailyTask) =>
    task.contextKey ?? `${task.type}|${task.title}|${task.mealKey ?? ''}`

  const oldState = new Map(
    oldTasks.map((task) => [
      taskStateKey(task),
      { completed: task.completed, response: task.response, timeMinutes: task.timeMinutes },
    ]),
  )

  tasks = tasks.map((task) => {
    const state = oldState.get(taskStateKey(task))
    return {
      ...task,
      completed: state?.completed ?? false,
      response: state?.response,
      timeMinutes: state?.response === 'snoozed' && !state.completed
        ? state.timeMinutes
        : task.timeMinutes,
    }
  })

  await Promise.all([
    dailyTaskRepo.replaceDay(userId, date, tasks),
    mealPlanRepo.replaceDay(userId, date, meals),
  ])

  return { ...plan, tasks, meals }
}
