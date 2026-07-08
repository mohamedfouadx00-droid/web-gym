import { foodCatalog } from '../data/foodCatalog'
import {
  availableFoodRepo,
  checkInRepo,
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  mealPlanRepo,
  preferencesRepo,
} from '../data/repositories'
import {
  dateKey,
  formatTimeAr,
  minutesToTimeInput,
  normalizePreferences,
} from '../domain/dailyCoach'
import type { DailyTask, DayEventType } from '../domain/models'
import { regenerateDailyPlan } from './planService'

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function hoursBetween(startIso: string, end: Date) {
  const hours = (end.getTime() - new Date(startIso).getTime()) / 3_600_000
  if (hours <= 0 || hours > 18) return undefined
  return Number(hours.toFixed(1))
}

async function addEvent(userId: string, type: DayEventType, note?: string) {
  await dayEventRepo.add({
    userId,
    dateKey: dateKey(),
    type,
    note,
    createdAt: new Date().toISOString(),
  })
}

function isPreGymTask(task: DailyTask) {
  return (
    task.type === 'gym' ||
    task.title.includes('قبل الجيم') ||
    task.title.includes('سناك خفيف قبل الجيم')
  )
}

export async function startDayNow(userId: string, goingGym = true) {
  const day = dateKey()
  const now = new Date()
  const wakeTime = minutesToTimeInput(nowMinutes())

  const [lastSleep, lastFailedSleep, lastWake] = await Promise.all([
    dayEventRepo.latestByType(userId, 'sleep_started'),
    dayEventRepo.latestByType(userId, 'sleep_failed'),
    dayEventRepo.latestByType(userId, 'woke_now'),
  ])

  const sleepStartedAt = lastSleep ? new Date(lastSleep.createdAt).getTime() : 0
  const failedAt = lastFailedSleep ? new Date(lastFailedSleep.createdAt).getTime() : 0
  const wokeAt = lastWake ? new Date(lastWake.createdAt).getTime() : 0

  const activeSleepAttempt = Boolean(
    lastSleep && sleepStartedAt > failedAt && sleepStartedAt > wokeAt,
  )

  const sleepHours =
    activeSleepAttempt && lastSleep
      ? hoursBetween(lastSleep.createdAt, now)
      : undefined

  await checkInRepo.save({
    userId,
    dateKey: day,
    wakeTime,
    sleepHours,
    goingGym,
  })

  await addEvent(
    userId,
    'woke_now',
    sleepHours ? `نوم تقريبي ${sleepHours} ساعة` : undefined,
  )

  return regenerateDailyPlan(userId, day)
}

export async function recordMissedSleepTime(
  userId: string,
  bedtime: string,
  goingGym: boolean,
) {
  const day = dateKey()
  const checkIn = await checkInRepo.get(userId, day)
  const wakeDate = new Date()

  if (checkIn) {
    const [hours, minutes] = checkIn.wakeTime.split(':').map(Number)
    wakeDate.setHours(hours, minutes, 0, 0)
  }

  const [bedHours, bedMinutes] = bedtime.split(':').map(Number)
  const sleepDate = new Date(wakeDate)
  sleepDate.setHours(bedHours, bedMinutes, 0, 0)
  if (sleepDate >= wakeDate) sleepDate.setDate(sleepDate.getDate() - 1)

  const duration = (wakeDate.getTime() - sleepDate.getTime()) / 3_600_000
  if (duration <= 0 || duration > 18) return undefined

  const sleepHours = Number(duration.toFixed(1))
  const wakeTime = checkIn?.wakeTime ?? minutesToTimeInput(nowMinutes())

  await checkInRepo.save({
    userId,
    dateKey: day,
    wakeTime,
    sleepHours,
    goingGym: checkIn?.goingGym ?? goingGym,
    customGymTime: checkIn?.customGymTime,
  })

  await regenerateDailyPlan(userId, day)
  return sleepHours
}

export async function startSleepNow(userId: string) {
  await addEvent(userId, 'sleep_started')
}

export async function failedToSleep(userId: string) {
  await addEvent(userId, 'sleep_failed')
}

export async function setCustomGymTime(userId: string, time: string) {
  const day = dateKey()
  const checkIn = await checkInRepo.get(userId, day)
  if (!checkIn) return

  await checkInRepo.save({
    ...checkIn,
    goingGym: true,
    customGymTime: time,
  })

  await regenerateDailyPlan(userId, day)
}

export async function departForGym(userId: string) {
  const day = dateKey()
  const checkIn = await checkInRepo.get(userId, day)

  if (!checkIn) {
    await startDayNow(userId, true)
  } else {
    await checkInRepo.save({
      ...checkIn,
      goingGym: true,
      customGymTime: minutesToTimeInput(nowMinutes() + 20),
    })
  }

  await addEvent(userId, 'gym_departed')
  await regenerateDailyPlan(userId, day)

  const tasks = await dailyTaskRepo.list(userId, day)
  const now = nowMinutes()

  const updated = tasks.map((task) => {
    if (task.completed) return task

    if (task.type === 'gym') {
      return {
        ...task,
        timeMinutes: now + 20,
        title: 'في الطريق للجيم',
        details: 'أول ما تدخل الجيم اضغط «أنا في الجيم».',
      }
    }

    return task
  })

  await dailyTaskRepo.replaceDay(userId, day, updated)
}

export async function enterGym(userId: string) {
  const day = dateKey()
  await addEvent(userId, 'gym_started')

  const tasks = await dailyTaskRepo.list(userId, day)
  const now = nowMinutes()

  const cleaned = tasks.map((task) => {
    if (task.completed) return task

    if (isPreGymTask(task)) {
      return {
        ...task,
        completed: true,
        response: task.type === 'gym' ? 'done' as const : 'unavailable' as const,
        timeMinutes: Math.min(task.timeMinutes, now),
      }
    }

    return task
  })

  await dailyTaskRepo.replaceDay(userId, day, cleaned)
}

export async function finishGym(userId: string) {
  const day = dateKey()
  await addEvent(userId, 'gym_finished')

  const [tasks, rawPreferences, creatineTaken] = await Promise.all([
    dailyTaskRepo.list(userId, day),
    preferencesRepo.get(userId),
    creatineRepo.get(userId, day),
  ])

  const preferences = normalizePreferences(rawPreferences, userId)
  const now = nowMinutes()

  const kept = tasks
    .filter((task) => task.completed || !isPreGymTask(task))
    .map((task) => {
      if (!task.completed && task.type === 'meal' && task.title.includes('بعد الجيم')) {
        return {
          ...task,
          timeMinutes: now + 30,
          details: 'اختار من الأكل المتاح. لو مكون مش متاح، شيله وخلي باقي الوجبة.',
        }
      }
      return task
    })

  const additions: DailyTask[] = [
    {
      userId,
      dateKey: day,
      timeMinutes: now + 5,
      type: 'water',
      title: 'مياه بعد الجيم',
      details: 'اشرب 500 مل مياه بهدوء.',
      waterAmountMl: 500,
      completed: false,
    },
  ]

  if (preferences.creatineEnabled && !creatineTaken) {
    additions.push({
      userId,
      dateKey: day,
      timeMinutes: now + 35,
      type: 'creatine',
      title: 'الكرياتين',
      details: `لو لسه ماخدتوش، سجل جرعتك المعتادة: ${preferences.creatineDoseG} جم.`,
      completed: false,
    })
  }

  await dailyTaskRepo.replaceDay(
    userId,
    day,
    [...kept, ...additions].sort((a, b) => a.timeMinutes - b.timeMinutes),
  )
}

export async function rescueMessyDay(userId: string) {
  const day = dateKey()
  await addEvent(userId, 'day_messy')

  const tasks = await dailyTaskRepo.list(userId, day)
  const now = nowMinutes()
  let cursor = now + 10

  const updated = tasks.map((task) => {
    if (task.completed) return task

    const next = {
      ...task,
      timeMinutes: cursor,
      details: `${task.details} — تم إعادة ترتيبها لأن يومك اتغير.`,
    }

    cursor += task.type === 'meal' ? 90 : 45
    return next
  })

  await dailyTaskRepo.replaceDay(
    userId,
    day,
    updated.sort((a, b) => a.timeMinutes - b.timeMinutes),
  )
}

export async function setOutsideHome(userId: string) {
  await addEvent(userId, 'outside_home')
  await regenerateDailyPlan(userId, dateKey())
}

export async function setInsideHome(userId: string) {
  await addEvent(userId, 'inside_home')
  await regenerateDailyPlan(userId, dateKey())
}

export async function logMasturbation(userId: string) {
  await addEvent(userId, 'masturbation_logged')
}

export async function replaceUnavailableMealIngredient(
  userId: string,
  task: DailyTask,
  unavailableFoodId: string,
) {
  if (!task.id || !task.mealKey) return

  const day = dateKey()
  const meal = await mealPlanRepo.getByKey(userId, day, task.mealKey)
  if (!meal?.id) return

  await availableFoodRepo.removeFood(userId, day, unavailableFoodId)

  const availableRows = await availableFoodRepo.list(userId, day)
  const availableIds = new Set(availableRows.map((row) => row.foodId))
  const currentIds = meal.foodIds.filter((id) => id !== unavailableFoodId)
  const removedFood = foodCatalog.find((food) => food.id === unavailableFoodId)

  const replacement = foodCatalog.find((food) =>
    availableIds.has(food.id) &&
    !currentIds.includes(food.id) &&
    food.category === removedFood?.category
  )

  const nextIds = replacement ? [...currentIds, replacement.id] : currentIds
  const nextFoods = nextIds
    .map((id) => foodCatalog.find((food) => food.id === id))
    .filter((food): food is NonNullable<typeof food> => Boolean(food))

  const ingredients = nextFoods.map((food) => `${food.nameAr} — ${food.servingLabel}`)
  const details = ingredients.length
    ? ingredients.join(' + ')
    : 'اختار أي مصدر بروتين أو نشويات بسيط متاح عندك الآن.'

  await Promise.all([
    mealPlanRepo.update(meal.id, {
      foodIds: nextIds,
      ingredients,
      calories: nextFoods.reduce((sum, food) => sum + food.calories, 0),
      protein: Math.round(nextFoods.reduce((sum, food) => sum + food.protein, 0)),
    }),
    dailyTaskRepo.update(task.id, { details }),
  ])
}

export async function snoozeTaskAndReplan(task: DailyTask, minutes = 30) {
  if (!task.id) return
  await dailyTaskRepo.snooze(task.id, minutes)
}

export function actionExplanation(task: DailyTask | undefined) {
  if (!task) return 'لا توجد خطوة معلقة الآن.'

  return `الخطوة الأنسب الآن هي «${task.title}» في حوالي ${formatTimeAr(task.timeMinutes)} لأن الخطة مربوطة بحالتك الحالية والجيم ومكانك والأكل المتاح.`
}
