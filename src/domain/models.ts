export type GoalType = 'fat_loss' | 'lean_gain' | 'recomp' | 'maintain'
export type ActivityLevel = 'low' | 'moderate' | 'high'
export type TrainingExperience = 'new' | 'some' | 'experienced'
export type WeightTrend = 'losing' | 'stable' | 'gaining'
export type GymPeriod = 'auto' | 'afternoon' | 'evening'
export type DailyTaskType = 'water' | 'meal' | 'gym' | 'creatine' | 'checkin' | 'prayer'
export type FoodCategory = 'protein' | 'carb' | 'dairy' | 'fruit' | 'fat' | 'vegetable' | 'meal' | 'treat'
export type SeasonType = 'summer' | 'winter' | 'all'
export type FoodKind = 'component' | 'complete_meal' | 'treat'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_gym' | 'post_gym'
export type TaskResponse = 'done' | 'snoozed' | 'unavailable'
export type CoachRole = 'user' | 'assistant'
export type CoachSource = 'local' | 'ai'
export type EnergyLevel = 'low' | 'normal' | 'high'
export type IllnessType = 'cold_fever' | 'headache' | 'stomach' | 'fatigue' | 'injury'
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
  | 'energy_low'
  | 'energy_normal'
  | 'energy_high'
  | 'illness_set'
  | 'illness_cleared'
  | 'prayer_completed'
  | 'restaurant_meal'

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
  ramadanMode?: boolean
  proactiveCoachEnabled?: boolean
  browserNotificationsEnabled?: boolean
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
  season?: SeasonType
  kind?: FoodKind
  mealSlots?: MealSlot[]
}

export interface CustomFood extends FoodCatalogItem {
  userId: string
  createdAt: string
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
  contextKey?: string
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

export interface MealLog {
  id?: number
  userId: string
  dateKey: string
  foodId: string
  foodNameAr: string
  mealLabel: string
  eatenAt: string
  calories: number
  protein: number
  sourceTaskId?: number
  source?: 'home' | 'restaurant' | 'quick'
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


export interface CoachMessage {
  id?: number
  userId: string
  dateKey: string
  role: CoachRole
  text: string
  source: CoachSource
  createdAt: string
}
