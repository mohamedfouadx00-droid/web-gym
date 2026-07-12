import { db } from './db'
import type {
  AvailableFood,
  CreatineLog,
  CustomFood,
  DailyCheckIn,
  DailyTask,
  DayEvent,
  Goal,
  MealLog,
  MealPlanItem,
  UserPreferences,
  UserProfile,
  WaterLog,
  WeightLog,
  CoachMessage,
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
  get: (userId: string, dateKey: string) =>
    db.dailyCheckIns.where('[userId+dateKey]').equals([userId, dateKey]).first(),
  save: async (value: DailyCheckIn) => {
    const current = await db.dailyCheckIns
      .where('[userId+dateKey]')
      .equals([value.userId, value.dateKey])
      .first()

    return current?.id
      ? db.dailyCheckIns.put({ ...value, id: current.id })
      : db.dailyCheckIns.add(value)
  },
}

export const availableFoodRepo = {
  list: (userId: string, dateKey: string) =>
    db.availableFoods
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .toArray(),

  setFoodIds: async (userId: string, dateKey: string, foodIds: string[]) => {
    await db.transaction('rw', db.availableFoods, async () => {
      await db.availableFoods
        .where('userId')
        .equals(userId)
        .filter((row) => row.dateKey === dateKey)
        .delete()

      if (foodIds.length) {
        await db.availableFoods.bulkAdd(
          foodIds.map((foodId): AvailableFood => ({ userId, dateKey, foodId })),
        )
      }
    })
  },

  removeFood: async (userId: string, dateKey: string, foodId: string) => {
    await db.availableFoods
      .where('[userId+dateKey+foodId]')
      .equals([userId, dateKey, foodId])
      .delete()
  },
}

export const dailyTaskRepo = {
  list: (userId: string, dateKey: string) =>
    db.dailyTasks
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .sortBy('timeMinutes'),

  replaceDay: async (userId: string, dateKey: string, tasks: DailyTask[]) => {
    await db.transaction('rw', db.dailyTasks, async () => {
      await db.dailyTasks
        .where('userId')
        .equals(userId)
        .filter((row) => row.dateKey === dateKey)
        .delete()

      if (tasks.length) await db.dailyTasks.bulkAdd(tasks)
    })
  },

  update: (id: number, patch: Partial<DailyTask>) => db.dailyTasks.update(id, patch),

  setCompleted: (id: number, completed: boolean) =>
    db.dailyTasks.update(id, {
      completed,
      response: completed ? 'done' : undefined,
    }),

  snooze: async (id: number, minutes = 30) => {
    const task = await db.dailyTasks.get(id)
    if (!task) return

    await db.dailyTasks.update(id, {
      timeMinutes: task.timeMinutes + minutes,
      response: 'snoozed',
    })
  },

  markUnavailable: (id: number) =>
    db.dailyTasks.update(id, { completed: true, response: 'unavailable' }),
}

export const mealPlanRepo = {
  list: (userId: string, dateKey: string) =>
    db.mealPlans
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .sortBy('timeMinutes'),

  getByKey: (userId: string, dateKey: string, mealKey: string) =>
    db.mealPlans
      .where('[userId+dateKey+mealKey]')
      .equals([userId, dateKey, mealKey])
      .first(),

  replaceDay: async (userId: string, dateKey: string, meals: MealPlanItem[]) => {
    await db.transaction('rw', db.mealPlans, async () => {
      await db.mealPlans
        .where('userId')
        .equals(userId)
        .filter((row) => row.dateKey === dateKey)
        .delete()

      if (meals.length) await db.mealPlans.bulkAdd(meals)
    })
  },

  update: (id: number, patch: Partial<MealPlanItem>) => db.mealPlans.update(id, patch),
}

export const waterRepo = {
  list: (userId: string) => db.waterLogs.where('userId').equals(userId).toArray(),
  add: (value: WaterLog) => db.waterLogs.add(value),
  addFromTaskOnce: async (value: WaterLog & { sourceTaskId: number }) => {
    const existing = await db.waterLogs
      .where('userId')
      .equals(value.userId)
      .filter((row) => row.sourceTaskId === value.sourceTaskId)
      .first()

    if (existing) return existing.id
    return db.waterLogs.add(value)
  },
}

export const creatineRepo = {
  get: (userId: string, dateKey: string) =>
    db.creatineLogs.where('[userId+dateKey]').equals([userId, dateKey]).first(),

  markTaken: async (value: CreatineLog) => {
    const current = await db.creatineLogs
      .where('[userId+dateKey]')
      .equals([value.userId, value.dateKey])
      .first()

    return current?.id
      ? db.creatineLogs.put({ ...value, id: current.id })
      : db.creatineLogs.add(value)
  },
}

export const weightRepo = {
  list: (userId: string) => db.weightLogs.where('userId').equals(userId).reverse().sortBy('date'),
  add: (value: WeightLog) => db.weightLogs.add(value),
}

export const dayEventRepo = {
  list: (userId: string, dateKey: string) =>
    db.dayEvents
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .sortBy('createdAt'),

  listAll: (userId: string) =>
    db.dayEvents.where('userId').equals(userId).sortBy('createdAt'),

  latestByType: async (userId: string, type: DayEvent['type']) => {
    const rows = await db.dayEvents
      .where('userId')
      .equals(userId)
      .filter((row) => row.type === type)
      .sortBy('createdAt')

    return rows[rows.length - 1]
  },

  add: (value: DayEvent) => db.dayEvents.add(value),
}


export const customFoodRepo = {
  list: (userId: string) =>
    db.customFoods.where('userId').equals(userId).sortBy('createdAt'),

  add: (value: CustomFood) => db.customFoods.put(value),

  remove: (id: string) => db.customFoods.delete(id),
}


export const mealLogRepo = {
  listAll: (userId: string) => db.mealLogs.where('userId').equals(userId).sortBy('eatenAt'),

  list: (userId: string, dateKey: string) =>
    db.mealLogs
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .sortBy('eatenAt'),

  add: (value: MealLog) => db.mealLogs.add(value),

  existsForTask: async (userId: string, sourceTaskId: number) =>
    Boolean(
      await db.mealLogs
        .where('userId')
        .equals(userId)
        .filter((row) => row.sourceTaskId === sourceTaskId)
        .first()
    ),
}


export const coachMessageRepo = {
  list: (userId: string, dateKey: string) =>
    db.coachMessages
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .sortBy('createdAt'),

  add: (value: CoachMessage) => db.coachMessages.add(value),

  clearDay: async (userId: string, dateKey: string) =>
    db.coachMessages
      .where('userId')
      .equals(userId)
      .filter((row) => row.dateKey === dateKey)
      .delete(),
}
