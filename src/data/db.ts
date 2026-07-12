import Dexie, { type Table } from 'dexie'
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
  User,
  UserPreferences,
  UserProfile,
  WaterLog,
  WeightLog,
  WaistLog,
  CoachMessage,
} from '../domain/models'

class GymDatabase extends Dexie {
  users!: Table<User, string>
  profiles!: Table<UserProfile, number>
  goals!: Table<Goal, number>
  preferences!: Table<UserPreferences, number>
  weightLogs!: Table<WeightLog, number>
  waistLogs!: Table<WaistLog, number>
  waterLogs!: Table<WaterLog, number>
  availableFoods!: Table<AvailableFood, number>
  dailyCheckIns!: Table<DailyCheckIn, number>
  dailyTasks!: Table<DailyTask, number>
  mealPlans!: Table<MealPlanItem, number>
  mealLogs!: Table<MealLog, number>
  creatineLogs!: Table<CreatineLog, number>
  dayEvents!: Table<DayEvent, number>
  customFoods!: Table<CustomFood, string>
  coachMessages!: Table<CoachMessage, number>

  constructor() {
    super('gym-arabic-men')

    this.version(14).stores({
      users: 'id,createdAt',
      profiles: '++id,&userId',
      goals: '++id,&userId',
      preferences: '++id,&userId',
      weightLogs: '++id,userId,date',
      waistLogs: '++id,userId,date',
      waterLogs: '++id,userId,date,sourceTaskId',
      availableFoods: '++id,[userId+dateKey+foodId],userId,dateKey,foodId',
      dailyCheckIns: '++id,[userId+dateKey],userId,dateKey',
      dailyTasks: '++id,userId,dateKey,timeMinutes,type,completed,response,mealKey',
      mealPlans: '++id,[userId+dateKey+mealKey],userId,dateKey,timeMinutes,mealKey',
      mealLogs: '++id,userId,dateKey,eatenAt,foodId,sourceTaskId',
      creatineLogs: '++id,[userId+dateKey],userId,dateKey',
      dayEvents: '++id,userId,dateKey,type,createdAt',
      customFoods: 'id,userId,category,createdAt',
      coachMessages: '++id,userId,dateKey,createdAt,role,source',
    }).upgrade(async (tx) => {
      const profiles = await tx.table('profiles').toArray()
      for (const profile of profiles) {
        if (typeof profile.smoker !== 'boolean') {
          await tx.table('profiles').update(profile.id, { smoker: false })
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
