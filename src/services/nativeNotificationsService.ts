import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { appSettings } from '../data/db'
import { dailyTaskRepo, mealLogRepo, mealPlanRepo, preferencesRepo } from '../data/repositories'
import { dateKey as makeDateKey, normalizePreferences } from '../domain/dailyCoach'
import type { DailyTask, UserPreferences } from '../domain/models'
import { regenerateDailyPlan } from './planService'

interface SleepAlarmOptions {
  triggerAt: number
  title: string
  body: string
  sound?: UserPreferences['sleepAlarmSound']
  vibration?: UserPreferences['sleepAlarmVibration']
  gradualVolume?: boolean
  snoozeMinutes?: number
  maxSnoozes?: number
}

interface SleepAlarmStatus {
  scheduled: boolean
  triggerAt?: number
  exactAllowed: boolean
  fullScreenAllowed: boolean
  batteryOptimized?: boolean
  manufacturer?: string
  snoozeCount?: number
  maxSnoozes?: number
}

interface SleepAlarmPluginApi {
  schedule(options: SleepAlarmOptions): Promise<{ scheduled: boolean; exact: boolean }>
  cancel(): Promise<void>
  status(): Promise<SleepAlarmStatus>
  openFullScreenSettings(): Promise<void>
  openAppSettings(): Promise<void>
  openBatterySettings(): Promise<void>
  test(options?: Partial<Omit<SleepAlarmOptions, 'triggerAt' | 'title' | 'body'>> & { seconds?: number }): Promise<void>
}

const SleepAlarm = registerPlugin<SleepAlarmPluginApi>('SleepAlarm')
const REMINDER_TAG = 'gym-life-day-reminder'
const CHANNEL_DAILY = 'daily_reminders_v1'
const CHANNEL_GYM = 'gym_reminders_v1'
const MEAL_ACTION_TYPE = 'meal_reminder_actions_v1'
const HISTORY_KEY = 'gym.notificationHistory.v1'

export interface NotificationHistoryItem {
  key: string
  notificationId: number
  title: string
  body: string
  type: string
  status: 'scheduled' | 'delivered' | 'opened' | 'done' | 'snoozed'
  at: string
}

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

function stableId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return 100_000 + (Math.abs(hash) % 1_900_000_000)
}

function dateAtMinutes(day: string, minutes: number): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, Math.floor(minutes / 60), minutes % 60, 0, 0)
}

function isTaskEnabled(task: DailyTask, preferences: UserPreferences): boolean {
  if (task.type === 'meal') return preferences.mealNotificationsEnabled !== false
  if (task.type === 'water') return preferences.waterNotificationsEnabled !== false
  if (task.type === 'creatine') return preferences.creatineNotificationsEnabled !== false
  if (task.type === 'prayer') return preferences.prayerNotificationsEnabled !== false
  if (task.type === 'gym') return preferences.gymNotificationsEnabled !== false
  return false
}

function reminderBody(task: DailyTask): string {
  if (task.type === 'gym') return `ميعاد الجيم قرب. ${task.details || 'جهّز نفسك ووجبتك قبل الجيم.'}`
  if (task.type === 'water') return task.details || 'اشرب المياه بهدوء وكمّل هدف اليوم.'
  if (task.type === 'creatine') return task.details || 'ميعاد جرعة الكرياتين المسجلة.'
  if (task.type === 'prayer') return task.details || 'حان موعد الصلاة.'
  return task.details || 'ميعاد الوجبة حسب خطة يومك.'
}

export function getNotificationHistory(): NotificationHistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as NotificationHistoryItem[]
    return Array.isArray(parsed) ? parsed.slice(0, 20) : []
  } catch { return [] }
}

export function clearNotificationHistory() { localStorage.removeItem(HISTORY_KEY) }

function logHistory(item: Omit<NotificationHistoryItem, 'key' | 'at'> & { at?: string }) {
  const value: NotificationHistoryItem = {
    ...item,
    key: `${item.notificationId}:${item.status}`,
    at: item.at ?? new Date().toISOString(),
  }
  const next = [value, ...getNotificationHistory().filter((row) => row.key !== value.key)].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('gym-notification-history'))
}

export async function initializeNativeNotifications(): Promise<void> {
  if (!isNativeAndroid()) return
  await LocalNotifications.createChannel({
    id: CHANNEL_DAILY,
    name: 'تذكيرات اليوم',
    description: 'الأكل والمياه والكرياتين والصلاة',
    importance: 4,
    visibility: 1,
    sound: 'coach_reminder.wav',
    vibration: true,
  })
  await LocalNotifications.createChannel({
    id: CHANNEL_GYM,
    name: 'ميعاد الجيم',
    description: 'تنبيه الاستعداد والذهاب للجيم',
    importance: 4,
    visibility: 1,
    sound: 'coach_reminder.wav',
    vibration: true,
  })
  await LocalNotifications.registerActionTypes({
    types: [{
      id: MEAL_ACTION_TYPE,
      actions: [
        { id: 'meal_done', title: 'أكلت الوجبة' },
        { id: 'meal_snooze', title: 'أجل 30 دقيقة' },
      ],
    }],
  })
}

export async function requestAndroidNotificationAccess(options?: { exact?: boolean }): Promise<{
  notifications: boolean; exact: boolean; fullScreen: boolean
}> {
  if (!isNativeAndroid()) return { notifications: false, exact: false, fullScreen: false }
  const notificationPermission = await LocalNotifications.requestPermissions()
  let exactSetting = await LocalNotifications.checkExactNotificationSetting()
  if (options?.exact && exactSetting.exact_alarm !== 'granted') exactSetting = await LocalNotifications.changeExactNotificationSetting()
  const alarmStatus = await SleepAlarm.status()
  return {
    notifications: notificationPermission.display === 'granted',
    exact: exactSetting.exact_alarm === 'granted',
    fullScreen: alarmStatus.fullScreenAllowed,
  }
}

export async function getAndroidNotificationStatus(): Promise<{
  native: boolean; notifications: boolean; exact: boolean; fullScreen: boolean
  batteryOptimized: boolean; manufacturer?: string
  sleepAlarmScheduled: boolean; sleepAlarmAt?: number; snoozeCount: number; maxSnoozes: number
}> {
  if (!isNativeAndroid()) return {
    native: false, notifications: false, exact: false, fullScreen: false, batteryOptimized: false,
    sleepAlarmScheduled: false, snoozeCount: 0, maxSnoozes: 0,
  }
  const [permission, exact, alarm] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.checkExactNotificationSetting(),
    SleepAlarm.status(),
  ])
  return {
    native: true,
    notifications: permission.display === 'granted',
    exact: exact.exact_alarm === 'granted',
    fullScreen: alarm.fullScreenAllowed,
    batteryOptimized: alarm.batteryOptimized !== false,
    manufacturer: alarm.manufacturer,
    sleepAlarmScheduled: alarm.scheduled,
    sleepAlarmAt: alarm.triggerAt,
    snoozeCount: alarm.snoozeCount ?? 0,
    maxSnoozes: alarm.maxSnoozes ?? 0,
  }
}

export async function openSleepAlarmFullScreenSettings() { if (isNativeAndroid()) await SleepAlarm.openFullScreenSettings() }
export async function openAndroidAppSettings() { if (isNativeAndroid()) await SleepAlarm.openAppSettings() }
export async function openAndroidBatterySettings() { if (isNativeAndroid()) await SleepAlarm.openBatterySettings() }

function alarmOptions(preferences?: UserPreferences) {
  return {
    sound: preferences?.sleepAlarmSound ?? 'loud',
    vibration: preferences?.sleepAlarmVibration ?? 'strong',
    gradualVolume: preferences?.sleepAlarmGradualVolume ?? true,
    snoozeMinutes: preferences?.sleepAlarmSnoozeMinutes ?? 10,
    maxSnoozes: preferences?.sleepAlarmMaxSnoozes ?? 2,
  }
}

export async function testSleepAlarm(seconds = 5, preferences?: UserPreferences): Promise<void> {
  if (!isNativeAndroid()) return
  await SleepAlarm.test({ seconds, ...alarmOptions(preferences) })
}

export async function scheduleSleepWakeAlarm(
  hours: number,
  userName?: string,
  preferences?: UserPreferences,
): Promise<{ scheduled: boolean; exact: boolean } | null> {
  if (!isNativeAndroid()) return null
  const safeHours = Math.min(12, Math.max(4, Number(hours) || 8))
  return SleepAlarm.schedule({
    triggerAt: Date.now() + safeHours * 60 * 60 * 1000,
    title: userName ? `اصحى يا ${userName}` : 'ميعاد الاستيقاظ',
    body: `نمت ${safeHours} ساعات تقريبًا. قوم بهدوء، اشرب مياه وابدأ يومك.`,
    ...alarmOptions(preferences),
  })
}

export async function cancelSleepWakeAlarm() { if (isNativeAndroid()) await SleepAlarm.cancel() }

export async function syncDayNotifications(tasks: DailyTask[], preferences: UserPreferences, day: string): Promise<number> {
  if (!isNativeAndroid() || !preferences.browserNotificationsEnabled) return 0
  await initializeNativeNotifications()
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return 0

  const pending = await LocalNotifications.getPending()
  const owned = pending.notifications
    .filter((notification) => notification.extra?.appTag === REMINDER_TAG)
    .map((notification) => ({ id: notification.id }))
  if (owned.length) await LocalNotifications.cancel({ notifications: owned })

  const now = Date.now()
  const startMinutes = (preferences.notificationStartHour ?? 8) * 60
  const endMinutes = (preferences.notificationEndHour ?? 23) * 60 + 59
  const maxCount = Math.min(24, Math.max(1, preferences.maxNotificationsPerDay ?? 12))
  const candidates = tasks
    .filter((task) => !task.completed && isTaskEnabled(task, preferences))
    .map((task) => ({ task, at: dateAtMinutes(day, task.timeMinutes) }))
    .filter(({ task, at }) => at.getTime() > now + 30_000 && task.timeMinutes >= startMinutes && task.timeMinutes <= endMinutes)
    .sort((left, right) => left.at.getTime() - right.at.getTime())
    .slice(0, maxCount)

  const notifications: LocalNotificationSchema[] = candidates.map(({ task, at }) => {
    const id = stableId(`${day}:${task.id ?? task.contextKey ?? task.title}:${task.timeMinutes}`)
    const body = reminderBody(task)
    logHistory({ notificationId: id, title: task.type === 'gym' ? 'ميعاد الجيم' : task.title, body, type: task.type, status: 'scheduled', at: at.toISOString() })
    return {
      id,
      title: task.type === 'gym' ? 'ميعاد الجيم' : task.title,
      body,
      largeBody: body,
      schedule: { at, allowWhileIdle: true },
      channelId: task.type === 'gym' ? CHANNEL_GYM : CHANNEL_DAILY,
      actionTypeId: task.type === 'meal' ? MEAL_ACTION_TYPE : undefined,
      autoCancel: true,
      extra: { appTag: REMINDER_TAG, taskId: task.id, taskType: task.type, dateKey: day, userId: task.userId },
    }
  })
  if (notifications.length) await LocalNotifications.schedule({ notifications })
  return notifications.length
}

export async function syncNativeRemindersForUser(userId: string, day: string): Promise<number> {
  if (!isNativeAndroid()) return 0
  const [rawPreferences, tasks] = await Promise.all([preferencesRepo.get(userId), dailyTaskRepo.list(userId, day)])
  return syncDayNotifications(tasks, normalizePreferences(rawPreferences, userId), day)
}

async function completeMealFromNotification(taskId: number, userId: string, day: string) {
  const tasks = await dailyTaskRepo.list(userId, day)
  const task = tasks.find((row) => row.id === taskId)
  if (!task || task.completed) return
  if (task.mealKey && !(await mealLogRepo.existsForTask(userId, taskId))) {
    const meal = await mealPlanRepo.getByKey(userId, day, task.mealKey)
    if (meal) await mealLogRepo.add({
      userId, dateKey: day, foodId: `planned:${meal.mealKey}`,
      foodNameAr: meal.ingredients.join(' + ') || meal.title,
      mealLabel: meal.title, eatenAt: new Date().toISOString(), calories: meal.calories,
      protein: meal.protein, sourceTaskId: taskId, source: 'quick',
    })
  }
  await dailyTaskRepo.setCompleted(taskId, true)
  await regenerateDailyPlan(userId, day)
  await syncNativeRemindersForUser(userId, day)
}

let runtimeStarted = false
let midnightTimer: number | undefined

function scheduleMidnightRefresh() {
  if (midnightTimer) window.clearTimeout(midnightTimer)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0)
  midnightTimer = window.setTimeout(async () => {
    const userId = appSettings.activeUserId
    if (userId) {
      const today = makeDateKey()
      await regenerateDailyPlan(userId, today).catch(() => undefined)
      await syncNativeRemindersForUser(userId, today).catch(() => undefined)
    }
    scheduleMidnightRefresh()
  }, Math.max(1000, next.getTime() - now.getTime()))
}

export async function startNativeNotificationRuntime(): Promise<void> {
  if (!isNativeAndroid() || runtimeStarted) return
  runtimeStarted = true
  await initializeNativeNotifications()

  await LocalNotifications.addListener('localNotificationReceived', (notification) => {
    logHistory({
      notificationId: notification.id, title: notification.title ?? 'تنبيه', body: notification.body ?? '',
      type: String(notification.extra?.taskType ?? 'general'), status: 'delivered',
    })
  })

  await LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
    const notification = event.notification
    const taskId = Number(notification.extra?.taskId)
    const userId = String(notification.extra?.userId ?? appSettings.activeUserId ?? '')
    const day = String(notification.extra?.dateKey ?? makeDateKey())
    const base = {
      notificationId: notification.id,
      title: notification.title ?? 'تنبيه', body: notification.body ?? '',
      type: String(notification.extra?.taskType ?? 'general'),
    }
    if (event.actionId === 'meal_done' && taskId && userId) {
      await completeMealFromNotification(taskId, userId, day).catch(() => undefined)
      logHistory({ ...base, status: 'done' })
    } else if (event.actionId === 'meal_snooze' && taskId && userId) {
      await dailyTaskRepo.snooze(taskId, 30).catch(() => undefined)
      await syncNativeRemindersForUser(userId, day).catch(() => undefined)
      logHistory({ ...base, status: 'snoozed' })
    } else logHistory({ ...base, status: 'opened' })
  })

  await App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    const userId = appSettings.activeUserId
    if (userId) void syncNativeRemindersForUser(userId, makeDateKey()).catch(() => undefined)
  })
  scheduleMidnightRefresh()
}
