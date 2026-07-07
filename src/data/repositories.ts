import {db} from './db'
import type {UserProfile,Goal,UserPreferences,WeightLog,RecoveryLog,WorkoutSession,WaterLog,MealLog,InventoryItem,SupplementLog,MeasurementLog,ScheduleEvent} from '../domain/models'
export const profileRepo={get:(u:string)=>db.profiles.where('userId').equals(u).first(),save:async(v:UserProfile)=>{const c=await db.profiles.where('userId').equals(v.userId).first();return c?.id?db.profiles.put({...v,id:c.id}):db.profiles.add(v)}}
export const goalRepo={get:(u:string)=>db.goals.where('userId').equals(u).first(),save:async(v:Goal)=>{const c=await db.goals.where('userId').equals(v.userId).first();return c?.id?db.goals.put({...v,id:c.id}):db.goals.add(v)}}
export const preferencesRepo={get:(u:string)=>db.preferences.where('userId').equals(u).first(),save:async(v:UserPreferences)=>{const c=await db.preferences.where('userId').equals(v.userId).first();return c?.id?db.preferences.put({...v,id:c.id}):db.preferences.add(v)}}
export const weightRepo={list:(u:string)=>db.weightLogs.where('userId').equals(u).reverse().sortBy('date'),add:(v:WeightLog)=>db.weightLogs.add(v)}
export const recoveryRepo={list:(u:string)=>db.recoveryLogs.where('userId').equals(u).reverse().sortBy('date'),add:(v:RecoveryLog)=>db.recoveryLogs.add(v)}
export const favoriteRepo={list:(u:string)=>db.favoriteExercises.where('userId').equals(u).toArray(),toggle:async(u:string,e:string)=>{const c=await db.favoriteExercises.where('[userId+exerciseId]').equals([u,e]).first();return c?.id?db.favoriteExercises.delete(c.id):db.favoriteExercises.add({userId:u,exerciseId:e})}}
export const workoutRepo={list:(u:string)=>db.workoutSessions.where('userId').equals(u).reverse().sortBy('startedAt'),save:(v:WorkoutSession)=>db.workoutSessions.put(v)}
export const waterRepo={list:(u:string)=>db.waterLogs.where('userId').equals(u).toArray(),add:(v:WaterLog)=>db.waterLogs.add(v)}
export const mealRepo={list:(u:string)=>db.mealLogs.where('userId').equals(u).toArray(),add:(v:MealLog)=>db.mealLogs.add(v)}
export const inventoryRepo={list:(u:string)=>db.inventory.where('userId').equals(u).toArray(),add:(v:InventoryItem)=>db.inventory.add(v),remove:(id:number)=>db.inventory.delete(id)}
export const supplementRepo={list:(u:string)=>db.supplementLogs.where('userId').equals(u).toArray(),add:(v:SupplementLog)=>db.supplementLogs.add(v)}
export const measurementRepo={list:(u:string)=>db.measurements.where('userId').equals(u).toArray(),add:(v:MeasurementLog)=>db.measurements.add(v)}
export const scheduleRepo={list:(u:string)=>db.schedule.where('userId').equals(u).sortBy('dateTime'),add:(v:ScheduleEvent)=>db.schedule.add(v),remove:(id:number)=>db.schedule.delete(id)}
