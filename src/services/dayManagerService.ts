import {
  checkInRepo,
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  preferencesRepo,
} from '../data/repositories'
import { dateKey, formatTimeAr, minutesToTimeInput, normalizePreferences } from '../domain/dailyCoach'
import type { DailyTask, DayEventType } from '../domain/models'
import { regenerateDailyPlan } from './planService'

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

async function addEvent(userId: string, type: DayEventType, note?: string) {
  const day = dateKey()
  await dayEventRepo.add({ userId, dateKey: day, type, note, createdAt: new Date().toISOString() })
}

export async function startDayNow(userId: string, goingGym = true) {
  const day = dateKey()
  const now = new Date()
  const wakeTime = minutesToTimeInput(now.getHours() * 60 + now.getMinutes())
  await checkInRepo.save({ userId, dateKey: day, wakeTime, goingGym })
  await addEvent(userId, 'woke_now')
  return regenerateDailyPlan(userId, day)
}

export async function setGymNow(userId: string) {
  const day = dateKey()
  const checkIn = await checkInRepo.get(userId, day)
  if (!checkIn) await startDayNow(userId, true)
  else if (!checkIn.goingGym) await checkInRepo.save({ ...checkIn, goingGym: true })

  await addEvent(userId, 'gym_now')
  await regenerateDailyPlan(userId, day)

  const tasks = await dailyTaskRepo.list(userId, day)
  const now = nowMinutes()
  const updated = tasks.map((task) => {
    if (task.completed) return task
    if (task.type === 'gym') return { ...task, timeMinutes: now + 20, title: 'اتجه للجيم', details: 'جهّز نفسك واتجه للجيم خلال 20 دقيقة.' }
    if (task.type === 'water' && task.timeMinutes > now) return { ...task, timeMinutes: now + 5, details: 'اشرب 300–500 مل مياه قبل ما تتحرك للجيم.' }
    return task
  })
  await dailyTaskRepo.replaceDay(userId, day, updated)
}

export async function returnedFromGym(userId: string) {
  const day = dateKey()
  await addEvent(userId, 'returned_gym')
  const tasks = await dailyTaskRepo.list(userId, day)
  const preferences = normalizePreferences(await preferencesRepo.get(userId), userId)
  const creatineTaken = await creatineRepo.get(userId, day)
  const now = nowMinutes()

  const additions: DailyTask[] = [
    { userId, dateKey: day, timeMinutes: now + 5, type: 'water', title: 'اشرب مياه بعد الجيم', details: 'ابدأ بـ 400–600 مل مياه بهدوء.', completed: false },
    { userId, dateKey: day, timeMinutes: now + 30, type: 'meal', title: 'وجبة بعد الجيم', details: 'اختار وجبة فيها مصدر بروتين واضح مع نشويات من الأكل المتاح عندك.', completed: false },
  ]
  if (preferences.creatineEnabled && !creatineTaken) {
    additions.push({ userId, dateKey: day, timeMinutes: now + 35, type: 'creatine', title: 'خد الكرياتين', details: `سجّل جرعتك اليومية المعتادة: ${preferences.creatineDoseG} جم.`, completed: false })
  }

  const future = tasks.filter((task) => task.completed || task.timeMinutes > now + 45)
  await dailyTaskRepo.replaceDay(userId, day, [...future, ...additions].sort((a, b) => a.timeMinutes - b.timeMinutes))
}

export async function rescueMessyDay(userId: string, note?: string) {
  const day = dateKey()
  await addEvent(userId, 'day_messy', note)
  const tasks = await dailyTaskRepo.list(userId, day)
  const now = nowMinutes()
  let cursor = now + 10

  const updated = tasks.map((task) => {
    if (task.completed) return task
    if (task.type === 'sleep') return task.timeMinutes < now + 120 ? { ...task, timeMinutes: now + 180 } : task
    const next = { ...task, timeMinutes: cursor, details: `${task.details} — تم إعادة ترتيبها لأن يومك اتغيّر.` }
    cursor += task.type === 'meal' ? 90 : 45
    return next
  })

  await dailyTaskRepo.replaceDay(userId, day, updated.sort((a, b) => a.timeMinutes - b.timeMinutes))
}

export async function setOutsideHome(userId: string) {
  const day = dateKey()
  await addEvent(userId, 'outside_home')
  const now = nowMinutes()
  const tasks = await dailyTaskRepo.list(userId, day)
  const guidance: DailyTask = {
    userId,
    dateKey: day,
    timeMinutes: now + 10,
    type: 'meal',
    title: 'اختيار سريع وإنت بره',
    details: 'اختار وجبة فيها بروتين واضح أولًا، ثم نشويات بسيطة حسب قرب الجيم. تجنب تحويل اليوم لوجبة عشوائية بلا حدود.',
    completed: false,
  }
  await dailyTaskRepo.replaceDay(userId, day, [...tasks, guidance].sort((a, b) => a.timeMinutes - b.timeMinutes))
}

export async function snoozeTaskAndReplan(task: DailyTask, minutes = 30) {
  if (!task.id) return
  await dailyTaskRepo.snooze(task.id, minutes)
}

export async function unavailableTaskAndReplan(userId: string, task: DailyTask) {
  if (!task.id) return
  await dailyTaskRepo.markUnavailable(task.id)
  await rescueMessyDay(userId, `غير متاح: ${task.title}`)
}

export function actionExplanation(task: DailyTask | undefined) {
  if (!task) return 'لا توجد خطوة معلقة الآن.'
  return `الخطوة الأنسب الآن هي «${task.title}» في حوالي ${formatTimeAr(task.timeMinutes)} لأن خطة اليوم مرتبة حسب استيقاظك والجيم والأكل المتاح.`
}
