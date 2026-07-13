import { dailyTaskRepo } from '../data/repositories'
import { dateKey } from '../domain/dailyCoach'
import type { DailyTask } from '../domain/models'

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes()
}

function minGapAfter(task: DailyTask): number {
  if (task.type === 'meal') return 150
  if (task.type === 'gym') return 45
  if (task.type === 'creatine') return 30
  return 35
}

export function overdueMinutes(task: DailyTask, date = new Date()): number {
  return Math.max(0, nowMinutes(date) - task.timeMinutes)
}

export function taskClockLabel(task: DailyTask, date = new Date()): string | null {
  const late = overdueMinutes(task, date)
  if (late <= 5) return null
  if (late < 60) return `متأخر ${late} دقيقة`
  const hours = Math.floor(late / 60)
  const minutes = late % 60
  return minutes ? `متأخر ${hours} ساعة و${minutes} دقيقة` : `متأخر ${hours} ساعة`
}

/**
 * Keeps today's pending plan tied to the real device clock without recreating tasks.
 * The first overdue pending step moves to now + 5 minutes, then the remaining future
 * steps move forward while keeping sensible spacing.
 */
export async function syncDayWithDeviceClock(userId: string) {
  const day = dateKey()
  const tasks = await dailyTaskRepo.list(userId, day)
  const pending = tasks.filter((task) => !task.completed && task.id && task.type !== 'prayer').sort((a, b) => a.timeMinutes - b.timeMinutes)
  if (!pending.length) return false

  const now = nowMinutes()
  const overdueMeal = pending.find((task) => task.type === 'meal' && now - task.timeMinutes >= 20)
  // Keep a clearly overdue meal visible so the user can choose: ate something else,
  // postpone, or skip it. Other tasks will be rescheduled after that decision.
  if (overdueMeal) return false
  if (pending[0].timeMinutes >= now - 5) return false

  let cursor = now + 5
  const updates: Array<Promise<unknown>> = []

  pending.forEach((task, index) => {
    const nextTime = index === 0 ? cursor : Math.max(task.timeMinutes, cursor)
    if (nextTime !== task.timeMinutes) updates.push(dailyTaskRepo.update(task.id!, { timeMinutes: nextTime }))
    cursor = nextTime + minGapAfter(task)
  })

  await Promise.all(updates)
  return updates.length > 0
}
