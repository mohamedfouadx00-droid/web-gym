import Dexie, { type Table } from 'dexie'
import type {
  AvailableFood,
  CreatineLog,
  DailyCheckIn,
  DailyTask,
  DayEvent,
  DayReview,
  Goal,
  MealPlanItem,
  User,
  UserPreferences,
  UserProfile,
  WaterLog,
  WeightLog,
} from '../domain/models'

class GymDatabase extends Dexie {
  users!: Table<User, string>
  profiles!: Table<UserProfile, number>
  goals!: Table<Goal, number>
  preferences!: Table<UserPreferences, number>
  weightLogs!: Table<WeightLog, number>
  waterLogs!: Table<WaterLog, number>
  availableFoods!: Table<AvailableFood, number>
  dailyCheckIns!: Table<DailyCheckIn, number>
  dailyTasks!: Table<DailyTask, number>
  mealPlans!: Table<MealPlanItem, number>
  creatineLogs!: Table<CreatineLog, number>
  dayEvents!: Table<DayEvent, number>
  dayReviews!: Table<DayReview, number>

  constructor() {
    super('gym-arabic-men')

    this.version(1).stores({
      users: 'id,createdAt',
      profiles: '++id,&userId',
      goals: '++id,&userId',
      preferences: '++id,&userId',
      weightLogs: '++id,userId,date',
      recoveryLogs: '++id,userId,date',
      favoriteExercises: '++id,[userId+exerciseId],userId,exerciseId',
      workoutSessions: 'id,userId,startedAt,endedAt',
      waterLogs: '++id,userId,date',
      mealLogs: '++id,userId,date,foodId',
      inventory: '++id,userId,name',
      supplementLogs: '++id,userId,date,name',
      measurements: '++id,userId,date',
      schedule: '++id,userId,dateTime,type',
    })

    this.version(2).stores({
      users: 'id,createdAt',
      profiles: '++id,&userId',
      goals: '++id,&userId',
      preferences: '++id,&userId',
      weightLogs: '++id,userId,date',
      waterLogs: '++id,userId,date',
      availableFoods: '++id,[userId+dateKey+foodId],userId,dateKey,foodId',
      dailyCheckIns: '++id,[userId+dateKey],userId,dateKey',
      dailyTasks: '++id,userId,dateKey,timeMinutes,type,completed',
      mealPlans: '++id,userId,dateKey,timeMinutes',
      creatineLogs: '++id,[userId+dateKey],userId,dateKey',
    })

    this.version(3).stores({
      users: 'id,createdAt',
      profiles: '++id,&userId',
      goals: '++id,&userId',
      preferences: '++id,&userId',
      weightLogs: '++id,userId,date',
      waterLogs: '++id,userId,date',
      availableFoods: '++id,[userId+dateKey+foodId],userId,dateKey,foodId',
      dailyCheckIns: '++id,[userId+dateKey],userId,dateKey',
      dailyTasks: '++id,userId,dateKey,timeMinutes,type,completed,response',
      mealPlans: '++id,userId,dateKey,timeMinutes',
      creatineLogs: '++id,[userId+dateKey],userId,dateKey',
      dayEvents: '++id,userId,dateKey,type,createdAt',
      dayReviews: '++id,[userId+dateKey],userId,dateKey,createdAt',
    }).upgrade(async (tx) => {
      const rows = await tx.table('availableFoods').toArray()
      for (const row of rows) {
        if (row.quantity == null) {
          await tx.table('availableFoods').update(row.id, { quantity: 1, unit: 'حصة' })
        }
      }
    })
  }
}

export const db = new GymDatabase()

export const appSettings = {
  get activeUserId(): string | null {
    return localStorage.getItem('gym.activeUserId')
  },
  set activeUserId(value: string | null) {
    if (value) localStorage.setItem('gym.activeUserId', value)
    else localStorage.removeItem('gym.activeUserId')
  },
  get onboardingCompleted(): boolean {
    return localStorage.getItem('gym.onboardingCompleted') === 'true'
  },
  set onboardingCompleted(value: boolean) {
    localStorage.setItem('gym.onboardingCompleted', String(value))
  },
}
