export type GoalType='muscle'|'fat_loss'|'recomp'|'strength'|'fitness'|'maintain'
export interface User{ id:string; createdAt:string }
export interface UserProfile{ id?:number; userId:string; name:string; birthYear:number; heightCm:number; currentWeightKg:number; bodyFatPercent?:number; experience:'beginner'|'intermediate'|'advanced'; activityLevel:'low'|'moderate'|'high' }
export interface Goal{ id?:number; userId:string; primary:GoalType; targetWeightKg?:number; pace:'slow'|'moderate'|'fast'; priority:number }
export interface UserPreferences{ id?:number; userId:string; workoutDays:string[]; restDays:string[]; equipment:string[]; trainingPlace:'gym'|'home'|'both'; workoutDurationMin:number; preferredWorkoutTime:string; supplementsEnabled:string[]; foodPreferences:string[]; dislikedFoods:string[]; cookingTimeMin:number; budgetLevel:'low'|'medium'|'high' }
export interface WeightLog{ id?:number; userId:string; valueKg:number; date:string }
export interface RecoveryLog{ id?:number; userId:string; date:string; sleepHours:number; sleepQuality:number; fatigue:number; soreness:number; pain:number; notes?:string }
export interface Exercise{ id:string; nameAr:string; muscle:string; secondaryMuscles:string[]; equipment:string; difficulty:'مبتدئ'|'متوسط'|'متقدم'; instructions:string[]; mistakes:string[]; alternatives:string[] }
export interface FavoriteExercise{ id?:number; userId:string; exerciseId:string }
export interface WorkoutSet{ id:string; reps:number; weightKg:number; rpe:number; notes?:string }
export interface WorkoutExerciseEntry{ exerciseId:string; sets:WorkoutSet[] }
export interface WorkoutSession{ id:string; userId:string; startedAt:string; endedAt?:string; title:string; exercises:WorkoutExerciseEntry[]; notes?:string; painNotes?:string }
export interface WaterLog{ id?:number; userId:string; amountMl:number; date:string }
export interface FoodItem{ id:string; nameAr:string; serving:string; calories:number; protein:number; carbs:number; fats:number }
export interface MealLog{ id?:number; userId:string; date:string; foodId:string; servings:number }
export interface InventoryItem{ id?:number; userId:string; name:string; quantity:number; unit:string; expiresAt?:string }
export interface SupplementLog{ id?:number; userId:string; name:string; dose:string; date:string; taken:boolean }
export interface MeasurementLog{ id?:number; userId:string; date:string; waist?:number; chest?:number; arms?:number; thighs?:number; shoulders?:number }
export interface ScheduleEvent{ id?:number; userId:string; title:string; type:'workout'|'meal'|'water'|'sleep'|'supplement'|'custom'; dateTime:string }
