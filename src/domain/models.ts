export type GoalType = 'fat_loss' | 'lean_gain' | 'recomp' | 'maintain'
export type ActivityLevel = 'low' | 'moderate' | 'high'
export type TrainingExperience = 'new' | 'some' | 'experienced'
export type WeightTrend = 'losing' | 'stable' | 'gaining'
export type GymPeriod = 'auto' | 'afternoon' | 'evening'
export type DailyTaskType = 'water' | 'meal' | 'gym' | 'creatine' | 'checkin'
export type FoodCategory = 'protein' | 'carb' | 'dairy' | 'fruit' | 'fat' | 'vegetable'
export type TaskResponse = 'done' | 'snoozed' | 'unavailable'
export type DayEventType =
  | 'woke_now'
  | 'sleep_started'
  | 'sleep_failed'
  | 'gym_departed'
  | 'gym_started'
  | 'gym_finished'
  | 'day_messy'
  | 'outside_home'
  | 'inside_home'
  | 'masturbation_logged'

export interface User {
  id: string
  createdAt: string
}

export interface UserProfile {
  id?: number
  userId: string
  name: string
  birthYear: number
  heightCm: number
  currentWeightKg: number
  waistCm?: number
  activityLevel: ActivityLevel
  trainingExperience: TrainingExperience
  weightTrend: WeightTrend
  smoker: boolean
}

export interface Goal {
  id?: number
  userId: string
  primary: GoalType
  targetWeightKg?: number
}

export interface UserPreferences {
  id?: number
  userId: string
  gymPeriod: GymPeriod
  creatineEnabled: boolean
  creatineDoseG: number
}

export interface FoodCatalogItem {
  id: string
  nameAr: string
  category: FoodCategory
  servingLabel: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface AvailableFood {
  id?: number
  userId: string
  dateKey: string
  foodId: string
}

export interface DailyCheckIn {
  id?: number
  userId: string
  dateKey: string
  wakeTime: string
  sleepHours?: number
  goingGym: boolean
  customGymTime?: string
}

export interface DailyTask {
  id?: number
  userId: string
  dateKey: string
  timeMinutes: number
  type: DailyTaskType
  title: string
  details: string
  completed: boolean
  response?: TaskResponse
  waterAmountMl?: number
  mealKey?: string
}

export interface MealPlanItem {
  id?: number
  userId: string
  dateKey: string
  mealKey: string
  timeMinutes: number
  title: string
  foodIds: string[]
  ingredients: string[]
  calories: number
  protein: number
}

export interface WaterLog {
  id?: number
  userId: string
  amountMl: number
  date: string
  sourceTaskId?: number
}

export interface CreatineLog {
  id?: number
  userId: string
  dateKey: string
  doseG: number
  takenAt: string
}

export interface WeightLog {
  id?: number
  userId: string
  valueKg: number
  date: string
}

export interface DayEvent {
  id?: number
  userId: string
  dateKey: string
  type: DayEventType
  createdAt: string
  note?: string
}
