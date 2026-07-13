import { appSettings, db } from '../data/db'

export const BACKUP_VERSION = 21

const tableNames = [
  'users', 'profiles', 'goals', 'preferences', 'weightLogs', 'waistLogs', 'waterLogs',
  'availableFoods', 'dailyCheckIns', 'dailyTasks', 'mealPlans', 'mealLogs',
  'creatineLogs', 'dayEvents', 'customFoods', 'coachMessages',
] as const

type TableName = typeof tableNames[number]

export interface AppBackup {
  app: 'gym-life-coach'
  version: number
  exportedAt: string
  activeUserId: string | null
  localSettings: Record<string, string>
  data: Record<TableName, unknown[]>
}

export interface BackupSummary {
  exportedAt: string
  version: number
  users: number
  mealLogs: number
  waterLogs: number
  weightLogs: number
}

const localSettingKeys = [
  'gym.coachAiConfig',
  'gym.prayerSettings.v1',
]

export async function createBackup(): Promise<AppBackup> {
  const data = {} as Record<TableName, unknown[]>
  for (const name of tableNames) data[name] = await db.table(name).toArray()

  const localSettings: Record<string, string> = {}
  for (const key of localSettingKeys) {
    const value = localStorage.getItem(key)
    if (value !== null) localSettings[key] = value
  }

  return {
    app: 'gym-life-coach',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activeUserId: appSettings.activeUserId,
    localSettings,
    data,
  }
}

export function parseBackup(raw: string): { backup: AppBackup; summary: BackupSummary } {
  const parsed = JSON.parse(raw) as Partial<AppBackup> & Record<string, unknown>

  // Compatibility with the old flat V19 export.
  const rawData = parsed.data && typeof parsed.data === 'object'
    ? parsed.data as Partial<Record<TableName, unknown[]>>
    : parsed as Partial<Record<TableName, unknown[]>>

  const data = {} as Record<TableName, unknown[]>
  for (const name of tableNames) {
    const rows = rawData[name]
    data[name] = Array.isArray(rows) ? rows : []
  }

  if (!data.users.length || !data.profiles.length) {
    throw new Error('الملف لا يحتوي على مستخدم وبيانات أساسية صالحة.')
  }

  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString()
  const backup: AppBackup = {
    app: 'gym-life-coach',
    version: typeof parsed.version === 'number' ? parsed.version : 19,
    exportedAt,
    activeUserId: typeof parsed.activeUserId === 'string' ? parsed.activeUserId : null,
    localSettings: parsed.localSettings && typeof parsed.localSettings === 'object'
      ? parsed.localSettings as Record<string, string>
      : {},
    data,
  }

  return {
    backup,
    summary: {
      exportedAt,
      version: backup.version,
      users: data.users.length,
      mealLogs: data.mealLogs.length,
      waterLogs: data.waterLogs.length,
      weightLogs: data.weightLogs.length,
    },
  }
}

export async function importBackup(backup: AppBackup, mode: 'merge' | 'replace') {
  const tables = tableNames.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const table of tables) await table.clear()
    }

    for (const name of tableNames) {
      const rows = backup.data[name]
      if (rows.length) await db.table(name).bulkPut(rows)
    }
  })

  for (const [key, value] of Object.entries(backup.localSettings)) {
    if (localSettingKeys.includes(key)) localStorage.setItem(key, value)
  }

  const users = backup.data.users as Array<{ id?: string }>
  const preferredUser = backup.activeUserId && users.some((user) => user.id === backup.activeUserId)
    ? backup.activeUserId
    : users.find((user) => typeof user.id === 'string')?.id ?? null

  appSettings.activeUserId = preferredUser
  appSettings.onboardingCompleted = Boolean(preferredUser)
}
