import { db } from './db'
import type {
  AvailableFood,
  CreatineLog,
  DailyCheckIn,
  DailyTask,
  DayEvent,
  DayReview,
  Goal,
  MealPlanItem,
  UserPreferences,
  UserProfile,
  WaterLog,
  WeightLog,
} from '../domain/models'

export const profileRepo = {
  get: (userId: string) => db.profiles.where('userId').equals(userId).first(),
  save: async (value: UserProfile) => {
    const current = await db.profiles.where('userId').equals(value.userId).first()
    return current?.id ? db.profiles.put({ ...value, id: current.id }) : db.profiles.add(value)
  },
}

export const goalRepo = {
  get: (userId: string) => db.goals.where('userId').equals(userId).first(),
  save: async (value: Goal) => {
    const current = await db.goals.where('userId').equals(value.userId).first()
    return current?.id ? db.goals.put({ ...value, id: current.id }) : db.goals.add(value)
  },
}

export const preferencesRepo = {
  get: (userId: string) => db.preferences.where('userId').equals(userId).first(),
  save: async (value: UserPreferences) => {
    const current = await db.preferences.where('userId').equals(value.userId).first()
    return current?.id ? db.preferences.put({ ...value, id: current.id }) : db.preferences.add(value)
  },
}

export const checkInRepo = {
  get: (userId: string, dateKey: string) => db.dailyCheckIns.where('[userId+dateKey]').equals([userId, dateKey]).first(),
  save: async (value: DailyCheckIn) => {
    const current = await db.dailyCheckIns.where('[userId+dateKey]').equals([value.userId, value.dateKey]).first()
    return current?.id ? db.dailyCheckIns.put({ ...value, id: current.id }) : db.dailyCheckIns.add(value)
  },
}

export const availableFoodRepo = {
  list: (userId: string, dateKey: string) => db.availableFoods.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).toArray(),
  setItems: async (userId: string, dateKey: string, items: Array<Pick<AvailableFood, 'foodId' | 'quantity' | 'unit'>>) => {
    await db.transaction('rw', db.availableFoods, async () => {
      await db.availableFoods.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).delete()
      if (items.length) await db.availableFoods.bulkAdd(items.map((item) => ({ userId, dateKey, ...item })))
    })
  },
}

export const dailyTaskRepo = {
  list: (userId: string, dateKey: string) => db.dailyTasks.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).sortBy('timeMinutes'),
  replaceDay: async (userId: string, dateKey: string, tasks: DailyTask[]) => {
    await db.transaction('rw', db.dailyTasks, async () => {
      await db.dailyTasks.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).delete()
      if (tasks.length) await db.dailyTasks.bulkAdd(tasks)
    })
  },
  setCompleted: async (id: number, completed: boolean) => db.dailyTasks.update(id, { completed, response: completed ? 'done' : undefined }),
  snooze: async (id: number, minutes = 30) => {
    const task = await db.dailyTasks.get(id)
    if (!task) return
    await db.dailyTasks.update(id, { timeMinutes: task.timeMinutes + minutes, response: 'snoozed' })
  },
  markUnavailable: async (id: number) => db.dailyTasks.update(id, { completed: true, response: 'unavailable' }),
}

export const mealPlanRepo = {
  list: (userId: string, dateKey: string) => db.mealPlans.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).sortBy('timeMinutes'),
  replaceDay: async (userId: string, dateKey: string, meals: MealPlanItem[]) => {
    await db.transaction('rw', db.mealPlans, async () => {
      await db.mealPlans.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).delete()
      if (meals.length) await db.mealPlans.bulkAdd(meals)
    })
  },
}

export const waterRepo = {
  list: (userId: string) => db.waterLogs.where('userId').equals(userId).toArray(),
  add: (value: WaterLog) => db.waterLogs.add(value),
}

export const creatineRepo = {
  get: (userId: string, dateKey: string) => db.creatineLogs.where('[userId+dateKey]').equals([userId, dateKey]).first(),
  markTaken: async (value: CreatineLog) => {
    const current = await db.creatineLogs.where('[userId+dateKey]').equals([value.userId, value.dateKey]).first()
    return current?.id ? db.creatineLogs.put({ ...value, id: current.id }) : db.creatineLogs.add(value)
  },
}

export const weightRepo = {
  list: (userId: string) => db.weightLogs.where('userId').equals(userId).reverse().sortBy('date'),
  add: (value: WeightLog) => db.weightLogs.add(value),
}

export const dayEventRepo = {
  list: (userId: string, dateKey: string) => db.dayEvents.where('userId').equals(userId).filter((row) => row.dateKey === dateKey).sortBy('createdAt'),
  listAll: (userId: string) => db.dayEvents.where('userId').equals(userId).sortBy('createdAt'),
  latestByType: async (userId: string, type: DayEvent['type']) => {
    const rows = await db.dayEvents.where('userId').equals(userId).filter((row) => row.type === type).sortBy('createdAt')
    return rows[rows.length - 1]
  },
  add: (value: DayEvent) => db.dayEvents.add(value),
}

export const dayReviewRepo = {
  get: (userId: string, dateKey: string) => db.dayReviews.where('[userId+dateKey]').equals([userId, dateKey]).first(),
  list: (userId: string) => db.dayReviews.where('userId').equals(userId).reverse().sortBy('createdAt'),
  save: async (value: DayReview) => {
    const current = await db.dayReviews.where('[userId+dateKey]').equals([value.userId, value.dateKey]).first()
    return current?.id ? db.dayReviews.put({ ...value, id: current.id }) : db.dayReviews.add(value)
  },
}
