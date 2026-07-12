import { db } from '../data/db'
import { dateKey } from '../domain/dailyCoach'
import type { CreatineLog, DailyTask, DayEvent, MealLog, MealPlanItem, WaterLog } from '../domain/models'

export interface DayUndoSnapshot {
  userId: string
  day: string
  dailyTasks: DailyTask[]
  mealPlans: MealPlanItem[]
  mealLogs: MealLog[]
  waterLogs: WaterLog[]
  creatineLogs: CreatineLog[]
  dayEvents: DayEvent[]
}

function isSameLocalDay(iso: string, day: string) {
  const value = new Date(iso)
  return Number.isFinite(value.getTime()) && dateKey(value) === day
}

export async function captureDayUndoSnapshot(userId: string, day = dateKey()): Promise<DayUndoSnapshot> {
  const [dailyTasks, mealPlans, mealLogs, allWater, creatineLogs, dayEvents] = await Promise.all([
    db.dailyTasks.where('userId').equals(userId).filter((row) => row.dateKey === day).toArray(),
    db.mealPlans.where('userId').equals(userId).filter((row) => row.dateKey === day).toArray(),
    db.mealLogs.where('userId').equals(userId).filter((row) => row.dateKey === day).toArray(),
    db.waterLogs.where('userId').equals(userId).toArray(),
    db.creatineLogs.where('userId').equals(userId).filter((row) => row.dateKey === day).toArray(),
    db.dayEvents.where('userId').equals(userId).filter((row) => row.dateKey === day).toArray(),
  ])

  return {
    userId,
    day,
    dailyTasks,
    mealPlans,
    mealLogs,
    waterLogs: allWater.filter((row) => isSameLocalDay(row.date, day)),
    creatineLogs,
    dayEvents,
  }
}

export async function restoreDayUndoSnapshot(snapshot: DayUndoSnapshot) {
  const { userId, day } = snapshot
  await db.transaction(
    'rw',
    [db.dailyTasks, db.mealPlans, db.mealLogs, db.waterLogs, db.creatineLogs, db.dayEvents],
    async () => {
      await Promise.all([
        db.dailyTasks.where('userId').equals(userId).filter((row) => row.dateKey === day).delete(),
        db.mealPlans.where('userId').equals(userId).filter((row) => row.dateKey === day).delete(),
        db.mealLogs.where('userId').equals(userId).filter((row) => row.dateKey === day).delete(),
        db.creatineLogs.where('userId').equals(userId).filter((row) => row.dateKey === day).delete(),
        db.dayEvents.where('userId').equals(userId).filter((row) => row.dateKey === day).delete(),
      ])

      const waterIds = (await db.waterLogs.where('userId').equals(userId).toArray())
        .filter((row) => isSameLocalDay(row.date, day))
        .map((row) => row.id)
        .filter((id): id is number => Boolean(id))
      if (waterIds.length) await db.waterLogs.bulkDelete(waterIds)

      if (snapshot.dailyTasks.length) await db.dailyTasks.bulkPut(snapshot.dailyTasks)
      if (snapshot.mealPlans.length) await db.mealPlans.bulkPut(snapshot.mealPlans)
      if (snapshot.mealLogs.length) await db.mealLogs.bulkPut(snapshot.mealLogs)
      if (snapshot.waterLogs.length) await db.waterLogs.bulkPut(snapshot.waterLogs)
      if (snapshot.creatineLogs.length) await db.creatineLogs.bulkPut(snapshot.creatineLogs)
      if (snapshot.dayEvents.length) await db.dayEvents.bulkPut(snapshot.dayEvents)
    },
  )
}
