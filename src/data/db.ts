import Dexie,{type Table} from 'dexie'
import type {User,UserProfile,Goal,UserPreferences,WeightLog,RecoveryLog,FavoriteExercise,WorkoutSession,WaterLog,MealLog,InventoryItem,SupplementLog,MeasurementLog,ScheduleEvent} from '../domain/models'
class GymDatabase extends Dexie{
 users!:Table<User,string>;profiles!:Table<UserProfile,number>;goals!:Table<Goal,number>;preferences!:Table<UserPreferences,number>;weightLogs!:Table<WeightLog,number>;recoveryLogs!:Table<RecoveryLog,number>;favoriteExercises!:Table<FavoriteExercise,number>;workoutSessions!:Table<WorkoutSession,string>;waterLogs!:Table<WaterLog,number>;mealLogs!:Table<MealLog,number>;inventory!:Table<InventoryItem,number>;supplementLogs!:Table<SupplementLog,number>;measurements!:Table<MeasurementLog,number>;schedule!:Table<ScheduleEvent,number>
 constructor(){super('gym-arabic-men');this.version(1).stores({users:'id,createdAt',profiles:'++id,&userId',goals:'++id,&userId',preferences:'++id,&userId',weightLogs:'++id,userId,date',recoveryLogs:'++id,userId,date',favoriteExercises:'++id,[userId+exerciseId],userId,exerciseId',workoutSessions:'id,userId,startedAt,endedAt',waterLogs:'++id,userId,date',mealLogs:'++id,userId,date,foodId',inventory:'++id,userId,name',supplementLogs:'++id,userId,date,name',measurements:'++id,userId,date',schedule:'++id,userId,dateTime,type'})}
}
export const db=new GymDatabase()
export const appSettings={
 get activeUserId(){return localStorage.getItem('gym.activeUserId')},
 set activeUserId(v:string|null){v?localStorage.setItem('gym.activeUserId',v):localStorage.removeItem('gym.activeUserId')},
 get onboardingCompleted(){return localStorage.getItem('gym.onboardingCompleted')==='true'},
 set onboardingCompleted(v:boolean){localStorage.setItem('gym.onboardingCompleted',String(v))}
}
