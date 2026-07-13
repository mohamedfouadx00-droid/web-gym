import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlarmClock, Bell, Bot, CheckCircle2, CircleAlert, Clock3, Download, LoaderCircle, MapPin, Moon, Pill, RotateCcw, Save, ShieldCheck, Trash2, Upload, Volume2, Wifi, WifiOff } from 'lucide-react'
import { appSettings, db } from '../../data/db'
import {
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  goalRepo,
  preferencesRepo,
  profileRepo,
} from '../../data/repositories'
import {
  dateKey,
  goalLabels,
  normalizeGoal,
  normalizePreferences,
  recommendGoal,
} from '../../domain/dailyCoach'
import type {
  ActivityLevel,
  GymPeriod,
  TrainingExperience,
  UserProfile,
  WeightTrend,
} from '../../domain/models'
import { logMasturbation } from '../../services/dayManagerService'
import { regenerateDailyPlan } from '../../services/planService'
import {
  checkCoachAiStatus,
  DEFAULT_CLOUDFLARE_COACH_ENDPOINT,
  formatAiFailureReason,
  getCoachAiConfig,
  normalizeCoachEndpoint,
  saveCoachAiConfig,
  testCoachAiConnection,
} from '../../services/smartCoachService'
import { captureDayUndoSnapshot, restoreDayUndoSnapshot, type DayUndoSnapshot } from '../../services/dayUndoService'
import { createBackup, importBackup, parseBackup, type AppBackup, type BackupSummary } from '../../services/backupService'
import { getPrayerLocationPermissionStatus, getPrayerSettings, PRAYER_CITY_PRESETS, requestPrayerLocationPermission, savePrayerSettings, type PrayerLocationPermissionStatus, type PrayerSettings } from '../../services/prayerTimesService'
import { Button, Card, Page, Stat } from '../../components/UI'
import {
  clearNotificationHistory,
  getAndroidNotificationStatus,
  getNotificationHistory,
  isNativeAndroid,
  openAndroidAppSettings,
  openAndroidBatterySettings,
  openSleepAlarmFullScreenSettings,
  requestAndroidNotificationAccess,
  syncNativeRemindersForUser,
  testSleepAlarm,
} from '../../services/nativeNotificationsService'

const selectAll = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()

export default function MorePage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const nativeAndroid = isNativeAndroid()

  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const rawPreferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const creatineLog = useLiveQuery(() => creatineRepo.get(userId, today), [userId, today])
  const events = useLiveQuery(() => dayEventRepo.list(userId, today), [userId, today]) ?? []

  const goal = normalizeGoal(rawGoal, userId)
  const preferences = normalizePreferences(rawPreferences, userId)

  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('2000')
  const [height, setHeight] = useState('175')
  const [weight, setWeight] = useState('75')
  const [waist, setWaist] = useState('')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [trainingExperience, setTrainingExperience] = useState<TrainingExperience>('new')
  const [weightTrend, setWeightTrend] = useState<WeightTrend>('stable')
  const [smoker, setSmoker] = useState(false)
  const [gymPeriod, setGymPeriod] = useState<GymPeriod>('auto')
  const [creatineEnabled, setCreatineEnabled] = useState(true)
  const [creatineDose, setCreatineDose] = useState('5')
  const [ramadanMode, setRamadanMode] = useState(false)
  const [proactiveCoachEnabled, setProactiveCoachEnabled] = useState(true)
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false)
  const [notificationStartHour, setNotificationStartHour] = useState(8)
  const [notificationEndHour, setNotificationEndHour] = useState(23)
  const [maxNotificationsPerDay, setMaxNotificationsPerDay] = useState(12)
  const [mealNotificationsEnabled, setMealNotificationsEnabled] = useState(true)
  const [waterNotificationsEnabled, setWaterNotificationsEnabled] = useState(true)
  const [creatineNotificationsEnabled, setCreatineNotificationsEnabled] = useState(true)
  const [prayerNotificationsEnabled, setPrayerNotificationsEnabled] = useState(true)
  const [gymNotificationsEnabled, setGymNotificationsEnabled] = useState(true)
  const [sleepAlarmEnabled, setSleepAlarmEnabled] = useState(true)
  const [sleepAlarmAfterHours, setSleepAlarmAfterHours] = useState(8)
  const [sleepAlarmSound, setSleepAlarmSound] = useState<'loud' | 'classic' | 'bell' | 'soft'>('loud')
  const [sleepAlarmVibration, setSleepAlarmVibration] = useState<'off' | 'normal' | 'strong'>('strong')
  const [sleepAlarmGradualVolume, setSleepAlarmGradualVolume] = useState(true)
  const [sleepAlarmSnoozeMinutes, setSleepAlarmSnoozeMinutes] = useState(10)
  const [sleepAlarmMaxSnoozes, setSleepAlarmMaxSnoozes] = useState(2)
  const [androidStatus, setAndroidStatus] = useState<Awaited<ReturnType<typeof getAndroidNotificationStatus>> | null>(null)
  const [testingAlarm, setTestingAlarm] = useState(false)
  const [prayerSettings, setPrayerSettings] = useState<PrayerSettings>(() => getPrayerSettings())
  const [locationPermission, setLocationPermission] = useState<PrayerLocationPermissionStatus>('unavailable')
  const [requestingLocation, setRequestingLocation] = useState(false)
  const [notificationHistory, setNotificationHistory] = useState(() => getNotificationHistory())
  const initialAiConfig = useMemo(() => getCoachAiConfig(), [])
  const [aiEnabled, setAiEnabled] = useState(initialAiConfig.enabled)
  const [aiEndpoint, setAiEndpoint] = useState(initialAiConfig.endpoint)
  const [aiConnectionState, setAiConnectionState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [aiConnectionMessage, setAiConnectionMessage] = useState('')
  const aiModel = 'cloudflare-workers-ai'
  const [notificationMessage, setNotificationMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [habitSaved, setHabitSaved] = useState(false)
  const [resetText, setResetText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [backupFile, setBackupFile] = useState<AppBackup | null>(null)
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [importingBackup, setImportingBackup] = useState(false)
  const [creatineUndo, setCreatineUndo] = useState<DayUndoSnapshot | null>(null)
  const [creatineUndoTimer, setCreatineUndoTimer] = useState<number | null>(null)

  useEffect(() => {
    if (!profile) return
    setName(profile.name)
    setBirthYear(String(profile.birthYear))
    setHeight(String(profile.heightCm))
    setWeight(String(profile.currentWeightKg))
    setWaist(profile.waistCm ? String(profile.waistCm) : '')
    setActivity(profile.activityLevel)
    setTrainingExperience(profile.trainingExperience)
    setWeightTrend(profile.weightTrend)
    setSmoker(profile.smoker)
  }, [profile])

  useEffect(() => {
    setGymPeriod(preferences.gymPeriod)
    setCreatineEnabled(preferences.creatineEnabled)
    setCreatineDose(String(preferences.creatineDoseG))
    setRamadanMode(Boolean(preferences.ramadanMode))
    setProactiveCoachEnabled(preferences.proactiveCoachEnabled !== false)
    setBrowserNotificationsEnabled(Boolean(preferences.browserNotificationsEnabled))
    setNotificationStartHour(preferences.notificationStartHour ?? 8)
    setNotificationEndHour(preferences.notificationEndHour ?? 23)
    setMaxNotificationsPerDay(preferences.maxNotificationsPerDay ?? 12)
    setMealNotificationsEnabled(preferences.mealNotificationsEnabled !== false)
    setWaterNotificationsEnabled(preferences.waterNotificationsEnabled !== false)
    setCreatineNotificationsEnabled(preferences.creatineNotificationsEnabled !== false)
    setPrayerNotificationsEnabled(preferences.prayerNotificationsEnabled !== false)
    setGymNotificationsEnabled(preferences.gymNotificationsEnabled !== false)
    setSleepAlarmEnabled(preferences.sleepAlarmEnabled !== false)
    setSleepAlarmAfterHours(preferences.sleepAlarmAfterHours ?? 8)
    setSleepAlarmSound(preferences.sleepAlarmSound ?? 'loud')
    setSleepAlarmVibration(preferences.sleepAlarmVibration ?? 'strong')
    setSleepAlarmGradualVolume(preferences.sleepAlarmGradualVolume ?? true)
    setSleepAlarmSnoozeMinutes(preferences.sleepAlarmSnoozeMinutes ?? 10)
    setSleepAlarmMaxSnoozes(preferences.sleepAlarmMaxSnoozes ?? 2)
  }, [preferences.gymPeriod, preferences.creatineEnabled, preferences.creatineDoseG, preferences.ramadanMode, preferences.proactiveCoachEnabled, preferences.browserNotificationsEnabled, preferences.notificationStartHour, preferences.notificationEndHour, preferences.maxNotificationsPerDay, preferences.mealNotificationsEnabled, preferences.waterNotificationsEnabled, preferences.creatineNotificationsEnabled, preferences.prayerNotificationsEnabled, preferences.gymNotificationsEnabled, preferences.sleepAlarmEnabled, preferences.sleepAlarmAfterHours, preferences.sleepAlarmSound, preferences.sleepAlarmVibration, preferences.sleepAlarmGradualVolume, preferences.sleepAlarmSnoozeMinutes, preferences.sleepAlarmMaxSnoozes])

  useEffect(() => {
    if (!nativeAndroid) return
    void getAndroidNotificationStatus().then(setAndroidStatus).catch(() => undefined)
    void getPrayerLocationPermissionStatus().then(setLocationPermission).catch(() => undefined)
  }, [nativeAndroid])


  useEffect(() => {
    if (!aiEnabled) {
      setAiConnectionState('idle')
      setAiConnectionMessage('')
      return
    }
    let cancelled = false
    void checkCoachAiStatus(aiEndpoint)
      .then((status) => {
        if (cancelled) return
        if (status.ready) {
          setAiConnectionState('ok')
          setAiConnectionMessage('Cloudflare متصل. اضغط «اختبر الموديل» للتأكد من الرد الفعلي.')
        } else {
          setAiConnectionState('error')
          setAiConnectionMessage('Cloudflare يعمل لكن Workers AI Binding غير جاهز.')
        }
      })
      .catch((error) => {
        if (cancelled) return
        setAiConnectionState('error')
        setAiConnectionMessage(formatAiFailureReason(error))
      })
    return () => { cancelled = true }
  }, [aiEnabled])

  useEffect(() => {
    const refresh = () => setNotificationHistory(getNotificationHistory())
    window.addEventListener('gym-notification-history', refresh)
    return () => window.removeEventListener('gym-notification-history', refresh)
  }, [])

  const profileDraft = useMemo<UserProfile>(() => ({
    id: profile?.id,
    userId,
    name: name.trim(),
    birthYear: Number(birthYear) || 2000,
    heightCm: Number(height) || 175,
    currentWeightKg: Number(weight) || 75,
    waistCm: Number(waist) || undefined,
    activityLevel: activity,
    trainingExperience,
    weightTrend,
    smoker,
  }), [
    profile?.id,
    userId,
    name,
    birthYear,
    height,
    weight,
    waist,
    activity,
    trainingExperience,
    weightTrend,
    smoker,
  ])

  const recommendation = useMemo(() => recommendGoal(profileDraft), [profileDraft])

  const currentYear = new Date().getFullYear()
  const profileValid = Boolean(
    name.trim().length >= 2
    && Number(birthYear) >= currentYear - 80
    && Number(birthYear) <= currentYear - 16
    && Number(height) >= 120
    && Number(height) <= 230
    && Number(weight) >= 35
    && Number(weight) <= 300
    && (!waist || (Number(waist) >= 40 && Number(waist) <= 220))
  )
  const creatineDoseValid = !creatineEnabled || (Number(creatineDose) >= 1 && Number(creatineDose) <= 10)
  const normalizedAiEndpoint = useMemo(() => normalizeCoachEndpoint(aiEndpoint), [aiEndpoint])
  const aiConfigValid = !aiEnabled || !nativeAndroid || /^https:\/\/[^\s]+\/api\/coach\/?$/i.test(normalizedAiEndpoint)
  const habitLoggedToday = events.some((event) => event.type === 'masturbation_logged')

  async function saveSettings() {
    if (!profile || saving) return
    if (!profileValid || !creatineDoseValid || !aiConfigValid) {
      setSettingsError(aiEnabled && nativeAndroid && !aiConfigValid
        ? 'اكتب رابط Cloudflare الصحيح وينتهي بـ /api/coach لتشغيل الذكاء الاصطناعي داخل تطبيق Android.'
        : 'راجع البيانات: العمر والطول والوزن وجرعة الكرياتين.')
      return
    }
    setSaving(true)
    setSettingsError('')

    try {
      await Promise.all([
      profileRepo.save(profileDraft),
      goalRepo.save({ ...goal, primary: recommendation.goal }),
      preferencesRepo.save({
        ...preferences,
        gymPeriod,
        creatineEnabled,
        creatineDoseG: Number(creatineDose),
        ramadanMode,
        proactiveCoachEnabled,
        browserNotificationsEnabled,
        notificationStartHour,
        notificationEndHour,
        maxNotificationsPerDay,
        mealNotificationsEnabled,
        waterNotificationsEnabled,
        creatineNotificationsEnabled,
        prayerNotificationsEnabled,
        gymNotificationsEnabled,
        sleepAlarmEnabled,
        sleepAlarmAfterHours,
        sleepAlarmSound,
        sleepAlarmVibration,
        sleepAlarmGradualVolume,
        sleepAlarmSnoozeMinutes,
        sleepAlarmMaxSnoozes,
      }),
      ])

      const endpointToSave = normalizeCoachEndpoint(aiEndpoint)
      setAiEndpoint(endpointToSave)
      saveCoachAiConfig({
        enabled: aiEnabled,
        endpoint: endpointToSave,
        model: aiModel,
      })
      savePrayerSettings(prayerSettings)

      await regenerateDailyPlan(userId, today)
      if (nativeAndroid && browserNotificationsEnabled) {
        await syncNativeRemindersForUser(userId, today)
        setAndroidStatus(await getAndroidNotificationStatus())
      }
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch {
      setSettingsError('حصل خطأ أثناء الحفظ. بياناتك القديمة لم تُحذف؛ جرّب مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  async function runAiConnectionTest() {
    if (aiConnectionState === 'checking') return
    const endpoint = normalizeCoachEndpoint(aiEndpoint)
    setAiEndpoint(endpoint)
    setAiConnectionState('checking')
    setAiConnectionMessage('جاري اختبار Cloudflare والموديل الفعلي...')
    try {
      const result = await testCoachAiConnection(endpoint)
      saveCoachAiConfig({ enabled: true, endpoint: result.endpoint, model: aiModel })
      setAiEnabled(true)
      setAiConnectionState('ok')
      setAiConnectionMessage(`الاتصال ناجح — ${result.model}. الذكاء الاصطناعي جاهز داخل التطبيق.`)
    } catch (error) {
      setAiConnectionState('error')
      setAiConnectionMessage(formatAiFailureReason(error))
    }
  }

  async function requestNotifications() {
    if (nativeAndroid) {
      try {
        const result = await requestAndroidNotificationAccess({ exact: true })
        setBrowserNotificationsEnabled(result.notifications)
        await preferencesRepo.save({ ...preferences, browserNotificationsEnabled: result.notifications })
        setAndroidStatus(await getAndroidNotificationStatus())
        setNotificationMessage(result.notifications
          ? result.exact
            ? 'تم تفعيل إشعارات Android والمواعيد الدقيقة.'
            : 'تم تفعيل الإشعارات. فعّل «المنبهات والتذكيرات» من إعدادات الهاتف لدقة أعلى.'
          : 'لم يتم منح إذن الإشعارات، لذلك لن تصل التنبيهات خارج التطبيق.')
      } catch {
        setNotificationMessage('تعذر تفعيل تنبيهات Android. افتح أذونات التطبيق من إعدادات الهاتف.')
      }
      return
    }

    if (typeof Notification === 'undefined' || !window.isSecureContext) {
      setNotificationMessage('تنبيهات الجهاز تحتاج متصفحًا داعمًا واتصال HTTPS.')
      setBrowserNotificationsEnabled(false)
      return
    }

    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      setBrowserNotificationsEnabled(granted)
      await preferencesRepo.save({ ...preferences, browserNotificationsEnabled: granted })
      setNotificationMessage(granted
        ? 'تم السماح بالتنبيهات وحفظ الإعداد تلقائيًا.'
        : 'الإذن لم يُمنح. التنبيهات ستظل تظهر داخل التطبيق فقط.')
    } catch {
      setBrowserNotificationsEnabled(false)
      setNotificationMessage('تعذر طلب إذن التنبيهات من المتصفح.')
    }
  }

  async function enableFullScreenAlarm() {
    try {
      await openSleepAlarmFullScreenSettings()
      setNotificationMessage('فعّل السماح بظهور منبّه النوم فوق شاشة القفل، ثم ارجع للتطبيق.')
      window.setTimeout(() => void getAndroidNotificationStatus().then(setAndroidStatus), 800)
    } catch {
      setNotificationMessage('تعذر فتح إعداد منبّه شاشة القفل على هذا الجهاز.')
    }
  }

  async function requestPrayerLocation() {
    if (requestingLocation) return
    setRequestingLocation(true)
    try {
      const status = await requestPrayerLocationPermission()
      setLocationPermission(status)
      if (status === 'granted') {
        setPrayerSettings((current) => ({ ...current, locationMode: 'device' }))
        setNotificationMessage('تم السماح بالموقع التقريبي. احفظ التغييرات لتحديث مواقيت الصلاة.')
      } else {
        setNotificationMessage('لم يتم منح إذن الموقع. يمكنك اختيار المدينة يدويًا أو فتح إعدادات التطبيق.')
      }
    } finally { setRequestingLocation(false) }
  }

  async function openLocationAppSettings() {
    await openAndroidAppSettings().catch(() => undefined)
    setNotificationMessage('فعّل إذن الموقع للتطبيق، ثم ارجع واضغط «موقع الجهاز».')
  }

  async function openBatteryOptimizationSettings() {
    await openAndroidBatterySettings().catch(() => undefined)
    setNotificationMessage('اختر التطبيق واجعله بدون قيود بطارية حتى تصل المنبهات في موعدها.')
  }

  async function runAlarmTest() {
    if (testingAlarm) return
    setTestingAlarm(true)
    try {
      await requestAndroidNotificationAccess({ exact: true })
      await testSleepAlarm(5, { ...preferences, sleepAlarmSound, sleepAlarmVibration, sleepAlarmGradualVolume, sleepAlarmSnoozeMinutes, sleepAlarmMaxSnoozes })
      setNotificationMessage(`اختبار المنبّه سيبدأ بعد 5 ثوانٍ بالصوت المختار. استخدم «إيقاف» أو «غفوة ${sleepAlarmSnoozeMinutes} دقيقة».`)
      setAndroidStatus(await getAndroidNotificationStatus())
    } catch {
      setNotificationMessage('تعذر اختبار المنبّه. راجع إذن الإشعارات والمنبهات الدقيقة.')
    } finally {
      window.setTimeout(() => setTestingAlarm(false), 5000)
    }
  }

  async function markCreatine() {
    const snapshot = await captureDayUndoSnapshot(userId, today)
    await creatineRepo.markTaken({
      userId,
      dateKey: today,
      doseG: Number(creatineDose),
      takenAt: new Date().toISOString(),
    })

    const tasks = await dailyTaskRepo.list(userId, today)
    const task = tasks.find((item) => item.type === 'creatine' && !item.completed)
    if (task?.id) await dailyTaskRepo.setCompleted(task.id, true)
    if (creatineUndoTimer) window.clearTimeout(creatineUndoTimer)
    setCreatineUndo(snapshot)
    setCreatineUndoTimer(window.setTimeout(() => setCreatineUndo(null), 12_000))
  }

  async function undoCreatine() {
    if (!creatineUndo) return
    await restoreDayUndoSnapshot(creatineUndo)
    setCreatineUndo(null)
    if (creatineUndoTimer) window.clearTimeout(creatineUndoTimer)
  }

  async function logHabitNow() {
    await logMasturbation(userId)
    setHabitSaved(true)
    window.setTimeout(() => setHabitSaved(false), 2200)
  }

  async function resetApp() {
    if (resetText.trim() !== 'delete') return
    setResetting(true)
    await db.delete()
    localStorage.clear()
    window.location.href = '/onboarding'
  }

  async function exportData() {
    const data = await createBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `gym-life-coach-v20-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setBackupMessage('تم إنشاء نسخة احتياطية كاملة تشمل البيانات والإعدادات.')
  }

  async function chooseBackupFile(file: File | undefined) {
    setBackupMessage('')
    setBackupFile(null)
    setBackupSummary(null)
    if (!file) return
    try {
      const parsed = parseBackup(await file.text())
      setBackupFile(parsed.backup)
      setBackupSummary(parsed.summary)
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'ملف النسخة الاحتياطية غير صالح.')
    }
  }

  async function restoreBackup(mode: 'merge' | 'replace') {
    if (!backupFile || importingBackup) return
    setImportingBackup(true)
    setBackupMessage('')
    try {
      await importBackup(backupFile, mode)
      setBackupMessage(mode === 'replace' ? 'تم استبدال البيانات بالنسخة الاحتياطية.' : 'تم دمج النسخة الاحتياطية مع البيانات الحالية.')
      window.setTimeout(() => window.location.reload(), 700)
    } catch {
      setBackupMessage('تعذر استيراد النسخة. لم يتم حذف ملف النسخة من جهازك.')
    } finally {
      setImportingBackup(false)
    }
  }


  return (
    <Page title="المزيد" subtitle="إعدادات قليلة ومتصلة بباقي يومك">
      <div className="stats-grid">
        <Stat label="هدفك الحالي" value={goalLabels[recommendation.goal]} />
        <Stat label="نصيحة النوم" value="قرّب من 8 ساعات" hint="مش شرط تلتزم بميعاد ثابت" />
        <Stat label="التدخين" value={smoker ? 'مسجل: مدخن' : 'مسجل: غير مدخن'} />
        <Stat
          label="الكرياتين اليوم"
          value={creatineEnabled ? (creatineLog ? 'تم أخذه' : 'لسه') : 'غير مفعل'}
        />
      </div>

      <div className="settings-save-bar">
        <div>
          <strong>{saved ? 'تم حفظ الإعدادات' : 'أي تعديل يحتاج حفظ'}</strong>
          <small>{saved ? 'تمت إعادة ترتيب اليوم بالقيم الجديدة.' : 'زر الحفظ يظل ظاهرًا أثناء تصفح الإعدادات.'}</small>
        </div>
        <Button disabled={saving || !profileValid || !creatineDoseValid || !aiConfigValid} onClick={saveSettings}>
          <Save size={18} />
          {saving ? 'بحفظ...' : saved ? 'تم' : 'احفظ'}
        </Button>
      </div>

      {(!profileValid || !creatineDoseValid || !aiConfigValid) && (
        <p className="field-error">راجع البيانات غير الصحيحة قبل الحفظ.</p>
      )}
      {settingsError && <p className="field-error">{settingsError}</p>}

      <Card title="بياناتي">
        <label>الاسم<input value={name} onChange={(event) => setName(event.target.value)} /></label>

        <div className="form-grid">
          <label>
            سنة الميلاد
            <input
              inputMode="numeric"
              value={birthYear}
              onFocus={selectAll}
              onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>

          <label>
            الطول (سم)
            <input
              inputMode="numeric"
              value={height}
              onFocus={selectAll}
              onChange={(event) => setHeight(event.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </label>

          <label>
            الوزن (كجم)
            <input
              inputMode="decimal"
              value={weight}
              onFocus={selectAll}
              onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
            />
          </label>

          <label>
            محيط الخصر — اختياري
            <input
              inputMode="decimal"
              value={waist}
              onFocus={selectAll}
              onChange={(event) => setWaist(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
            />
          </label>
        </div>

        <label>
          نشاطك خارج الجيم
          <select value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}>
            <option value="low">قليل</option>
            <option value="moderate">متوسط</option>
            <option value="high">عالي</option>
          </select>
        </label>

        <label>
          خبرتك في الجيم
          <select
            value={trainingExperience}
            onChange={(event) => setTrainingExperience(event.target.value as TrainingExperience)}
          >
            <option value="new">جديد</option>
            <option value="some">خبرة بسيطة</option>
            <option value="experienced">منتظم من فترة طويلة</option>
          </select>
        </label>

        <label>
          اتجاه وزنك مؤخرًا
          <select value={weightTrend} onChange={(event) => setWeightTrend(event.target.value as WeightTrend)}>
            <option value="losing">بينزل</option>
            <option value="stable">ثابت</option>
            <option value="gaining">بيزيد</option>
          </select>
        </label>

        <div>
          <h3>التدخين</h3>
          <div className="chips">
            <button className={smoker ? 'chip active' : 'chip'} onClick={() => setSmoker(true)}>مدخن</button>
            <button className={!smoker ? 'chip active' : 'chip'} onClick={() => setSmoker(false)}>غير مدخن</button>
          </div>
        </div>
      </Card>

      <Card title="نظام النوم">
        <div className="sleep-advice-card">
          <div className="sleep-advice-icon"><span>8h</span></div>
          <div>
            <span className="eyebrow">نصيحة فقط</span>
            <h3>الأفضل تقرّب من 8 ساعات لما تقدر</h3>
            <p>مفيش ميعاد استيقاظ مستهدف. التسجيل الحقيقي من «أنا هنام الآن» و«أنا صحيت الآن».</p>
            <small>لو يومك مضغوط، 6 ساعات أفضل من أقل.</small>
          </div>
        </div>

        <label className="toggle-row">
          <input type="checkbox" checked={sleepAlarmEnabled} onChange={(event) => setSleepAlarmEnabled(event.target.checked)} />
          <span>شغّل منبّه قوي لو نمت مدة طويلة</span>
        </label>

        {sleepAlarmEnabled && (
          <>
            <div className="form-grid">
              <label>
                رنّ بعد كام ساعة نوم؟
                <select value={sleepAlarmAfterHours} onChange={(event) => setSleepAlarmAfterHours(Number(event.target.value))}>
                  {[6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12].map((hours) => (
                    <option key={hours} value={hours}>{hours} ساعة</option>
                  ))}
                </select>
              </label>
              <label>
                صوت المنبّه
                <select value={sleepAlarmSound} onChange={(event) => setSleepAlarmSound(event.target.value as typeof sleepAlarmSound)}>
                  <option value="loud">قوي جدًا</option>
                  <option value="classic">منبّه كلاسيكي</option>
                  <option value="bell">جرس واضح</option>
                  <option value="soft">هادئ تدريجي</option>
                </select>
              </label>
              <label>
                الاهتزاز
                <select value={sleepAlarmVibration} onChange={(event) => setSleepAlarmVibration(event.target.value as typeof sleepAlarmVibration)}>
                  <option value="strong">قوي</option>
                  <option value="normal">عادي</option>
                  <option value="off">بدون اهتزاز</option>
                </select>
              </label>
              <label>
                مدة الغفوة
                <select value={sleepAlarmSnoozeMinutes} onChange={(event) => setSleepAlarmSnoozeMinutes(Number(event.target.value))}>
                  {[5, 10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} دقيقة</option>)}
                </select>
              </label>
              <label>
                أقصى عدد للغفوات
                <select value={sleepAlarmMaxSnoozes} onChange={(event) => setSleepAlarmMaxSnoozes(Number(event.target.value))}>
                  {[0, 1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count === 0 ? 'بدون غفوة' : `${count} مرة`}</option>)}
                </select>
              </label>
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={sleepAlarmGradualVolume} onChange={(event) => setSleepAlarmGradualVolume(event.target.checked)} />
              <span>ابدأ بصوت منخفض وارفعه تدريجيًا خلال 30 ثانية</span>
            </label>
          </>
        )}
        <p className="field-hint">عند ضغط «أنا هنام الآن» يبدأ العدّ. عند الاستيقاظ أو «مقدرتش أنام» يُلغى المنبّه تلقائيًا. استخدم «اختبر الصوت» بعد الحفظ.</p>
      </Card>

      <Card title="ميعاد الجيم">
        <div className="chips">
          <button className={gymPeriod === 'auto' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('auto')}>هو يختار</button>
          <button className={gymPeriod === 'afternoon' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('afternoon')}>أفضل العصر</button>
          <button className={gymPeriod === 'evening' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('evening')}>أفضل المساء</button>
        </div>
      </Card>

      <Card title="وضع رمضان">
        <div className="ramadan-settings-card">
          <Moon size={28} />
          <div>
            <h3>خطة صيام متكاملة</h3>
            <p>يرتب الإفطار والمغرب والعشاء والتراويح والسحور والمياه، وينقل الجيم لما بعد الإفطار.</p>
          </div>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={ramadanMode}
            onChange={(event) => setRamadanMode(event.target.checked)}
          />
          <span>{ramadanMode ? 'وضع رمضان مفعل' : 'فعّل وضع رمضان'}</span>
        </label>
        <p className="field-hint">فعّله في رمضان فقط، ثم اضغط «احفظ التغييرات» لإعادة ترتيب اليوم.</p>
      </Card>


      <Card title="تنبيهات اليوم">
        <div className="smart-coach-settings-head">
          <Clock3 size={28} />
          <div>
            <h3>تنبيهات أقل وفي الوقت المناسب</h3>
            <p>حدد فترة التنبيهات والحد الأقصى، واختر الأنواع التي تهمك.</p>
          </div>
        </div>

        {nativeAndroid && (
          <div className="android-notification-panel">
            <div className="status-chip-row">
              <span className={androidStatus?.notifications ? 'status-chip ok' : 'status-chip'}>الإشعارات: {androidStatus?.notifications ? 'مفعلة' : 'مغلقة'}</span>
              <span className={androidStatus?.exact ? 'status-chip ok' : 'status-chip'}>الدقة: {androidStatus?.exact ? 'مفعلة' : 'تحتاج إذن'}</span>
              <span className={androidStatus?.fullScreen ? 'status-chip ok' : 'status-chip'}>شاشة القفل: {androidStatus?.fullScreen ? 'مفعلة' : 'اختيارية'}</span>
              <span className={!androidStatus?.batteryOptimized ? 'status-chip ok' : 'status-chip'}>البطارية: {androidStatus?.batteryOptimized ? 'مقيّدة' : 'بدون قيود'}</span>
            </div>
            <div className="button-row">
              <Button onClick={() => void requestNotifications()}><ShieldCheck size={18} /> تفعيل تنبيهات Android</Button>
              {!androidStatus?.fullScreen && <Button variant="secondary" onClick={() => void enableFullScreenAlarm()}><AlarmClock size={18} /> منبّه شاشة القفل</Button>}
              {androidStatus?.batteryOptimized && <Button variant="secondary" onClick={() => void openBatteryOptimizationSettings()}><ShieldCheck size={18} /> إعدادات البطارية</Button>}
              <Button variant="secondary" disabled={testingAlarm} onClick={() => void runAlarmTest()}><Volume2 size={18} /> {testingAlarm ? 'انتظر...' : 'اختبر الصوت'}</Button>
            </div>
            <p className="field-hint">التنبيهات تعمل بعد قفل التطبيق. على Realme وOPPO وXiaomi اختر «بدون قيود» أو اسمح بالنشاط في الخلفية، ثم اختبر المنبّه والشاشة مقفولة.</p>
          </div>
        )}

        <div className="form-grid">
          <label>
            بداية التنبيهات
            <input type="time" value={`${String(notificationStartHour).padStart(2, '0')}:00`} onChange={(event) => setNotificationStartHour(Number(event.target.value.split(':')[0]))} />
          </label>
          <label>
            نهاية التنبيهات
            <input type="time" value={`${String(notificationEndHour).padStart(2, '0')}:00`} onChange={(event) => setNotificationEndHour(Number(event.target.value.split(':')[0]))} />
          </label>
          <label>
            أقصى عدد يوميًا
            <input type="number" min="1" max="24" value={maxNotificationsPerDay} onChange={(event) => setMaxNotificationsPerDay(Math.min(24, Math.max(1, Number(event.target.value) || 1)))} />
          </label>
        </div>

        <div className="notification-category-grid">
          <label className="toggle-row"><input type="checkbox" checked={mealNotificationsEnabled} onChange={(event) => setMealNotificationsEnabled(event.target.checked)} /><span>الأكل</span></label>
          <label className="toggle-row"><input type="checkbox" checked={waterNotificationsEnabled} onChange={(event) => setWaterNotificationsEnabled(event.target.checked)} /><span>المياه</span></label>
          <label className="toggle-row"><input type="checkbox" checked={creatineNotificationsEnabled} onChange={(event) => setCreatineNotificationsEnabled(event.target.checked)} /><span>الكرياتين</span></label>
          <label className="toggle-row"><input type="checkbox" checked={prayerNotificationsEnabled} onChange={(event) => setPrayerNotificationsEnabled(event.target.checked)} /><span>الصلاة</span></label>
          <label className="toggle-row"><input type="checkbox" checked={gymNotificationsEnabled} onChange={(event) => setGymNotificationsEnabled(event.target.checked)} /><span>الجيم</span></label>
        </div>
        <p className="field-hint">إشعار الوجبة يحتوي على «أكلت الوجبة» و«أجل 30 دقيقة» حتى تسجلها من غير فتح التطبيق.</p>
        {notificationHistory.length > 0 && (
          <div className="notification-history">
            <div className="notification-history-head">
              <strong>آخر التنبيهات</strong>
              <button className="text-button" onClick={() => { clearNotificationHistory(); setNotificationHistory([]) }}>مسح السجل</button>
            </div>
            {notificationHistory.slice(0, 8).map((item) => (
              <div className="notification-history-row" key={item.key}>
                <div><strong>{item.title}</strong><small>{new Date(item.at).toLocaleString('ar-EG')}</small></div>
                <span className={`history-status ${item.status}`}>{({ scheduled: 'مجدول', delivered: 'وصل', opened: 'فُتح', done: 'تم', snoozed: 'مؤجل' } as const)[item.status]}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="إعدادات مواقيت الصلاة">
        <div className="smart-coach-settings-head">
          <MapPin size={28} />
          <div>
            <h3>الموقع أو المدينة يدويًا</h3>
            <p>اختر المدينة لو إذن الموقع مرفوض، وعدّل أي صلاة بدقائق بسيطة عند الحاجة.</p>
          </div>
        </div>

        <div className="chips">
          <button className={prayerSettings.locationMode === 'device' ? 'chip active' : 'chip'} onClick={() => setPrayerSettings((current) => ({ ...current, locationMode: 'device' }))}>موقع الجهاز</button>
          <button className={prayerSettings.locationMode === 'manual' ? 'chip active' : 'chip'} onClick={() => setPrayerSettings((current) => ({ ...current, locationMode: 'manual' }))}>مدينة يدويًا</button>
        </div>

        {prayerSettings.locationMode === 'device' && (
          <div className="location-permission-panel">
            <span className={locationPermission === 'granted' ? 'status-chip ok' : 'status-chip'}>
              إذن الموقع: {({ granted: 'مفعّل', prompt: 'لم يُطلب بعد', denied: 'مرفوض', disabled: 'خدمة الموقع مغلقة', unsupported: 'غير مدعوم', unavailable: 'غير معروف' } as const)[locationPermission]}
            </span>
            <div className="button-row">
              <Button variant="secondary" disabled={requestingLocation} onClick={() => void requestPrayerLocation()}>
                <MapPin size={18} /> {requestingLocation ? 'جارٍ الطلب...' : 'السماح بالموقع'}
              </Button>
              {nativeAndroid && locationPermission === 'denied' && (
                <Button variant="secondary" onClick={() => void openLocationAppSettings()}>فتح إعدادات التطبيق</Button>
              )}
            </div>
            <p className="field-hint">الموقع التقريبي كافٍ لمواقيت الصلاة، ولا يتم إرساله للذكاء الاصطناعي. لو رفضت الإذن استخدم المدينة اليدوية.</p>
          </div>
        )}

        {prayerSettings.locationMode === 'manual' && (
          <label>
            المدينة
            <select value={prayerSettings.cityId} onChange={(event) => setPrayerSettings((current) => ({ ...current, cityId: event.target.value }))}>
              {PRAYER_CITY_PRESETS.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
            </select>
          </label>
        )}

        <label>
          مصدر المواقيت
          <select value={prayerSettings.sourceMode} onChange={(event) => setPrayerSettings((current) => ({ ...current, sourceMode: event.target.value as PrayerSettings['sourceMode'] }))}>
            <option value="auto">الإنترنت عند توفره ثم الحساب المحلي</option>
            <option value="offline">الحساب المحلي فقط</option>
          </select>
        </label>

        <div className="prayer-adjustments-grid">
          {([
            ['Fajr', 'الفجر'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء'],
          ] as const).map(([key, label]) => (
            <label key={key}>
              {label} ± دقيقة
              <input
                type="number"
                min="-30"
                max="30"
                value={prayerSettings.adjustments[key]}
                onChange={(event) => setPrayerSettings((current) => ({
                  ...current,
                  adjustments: { ...current.adjustments, [key]: String(Math.min(30, Math.max(-30, Number(event.target.value) || 0))) },
                }))}
              />
            </label>
          ))}
        </div>
        <p className="field-hint">المصدر المختار والتعديلات يظهران في صفحة اليوم بعد الحفظ والتحديث.</p>
      </Card>

      <Card title="المدرب الذكي">
        <div className="smart-coach-settings-head">
          <Bot size={30} />
          <div>
            <h3>المحرك المحلي مجاني ويعمل بدون إنترنت</h3>
            <p>يفهم الوقت والموسم والجمعة والمكان والنوم والأكل والهدف، ويغيّر خطة اليوم بقواعد داخلية.</p>
          </div>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={proactiveCoachEnabled}
            onChange={(event) => setProactiveCoachEnabled(event.target.checked)}
          />
          <span>خلّي المدرب يبدأ الكلام عند وجود ملاحظة مهمة</span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={browserNotificationsEnabled}
            onChange={(event) => {
              if (event.target.checked) void requestNotifications()
              else {
                setBrowserNotificationsEnabled(false)
                void preferencesRepo.save({ ...preferences, browserNotificationsEnabled: false })
              }
            }}
          />
          <span><Bell size={17} /> تنبيهات Android والمتصفح عند السماح بها</span>
        </label>
        {notificationMessage && <p className="field-hint">{notificationMessage}</p>}

        <div className="ai-optional-box">
          <div className="ai-optional-title">
            {aiEnabled ? <Wifi size={20} /> : <WifiOff size={20} />}
            <div>
              <strong>العقل الذكي للتطبيق</strong>
              <small>Cloudflare Workers AI يفهم بيانات يومك ويقدّر الوجبات ويجاوب حسب حالتك الفعلية.</small>
            </div>
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} />
            <span>{aiEnabled ? 'الذكاء الاصطناعي مفعّل — والمحرك المحلي احتياطي تلقائي' : 'الذكاء الاصطناعي متوقف — المحرك المحلي فقط'}</span>
          </label>

          {aiEnabled && (
            <div className="ai-config-grid">
              {nativeAndroid && (
                <div className="ai-endpoint-block">
                  <label htmlFor="cloudflare-ai-endpoint">رابط خدمة Cloudflare AI</label>
                  <input
                    id="cloudflare-ai-endpoint"
                    className="ai-endpoint-input"
                    dir="ltr"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={DEFAULT_CLOUDFLARE_COACH_ENDPOINT}
                    value={aiEndpoint}
                    onChange={(event) => {
                      setAiEndpoint(event.target.value)
                      setAiConnectionState('idle')
                      setAiConnectionMessage('')
                    }}
                    onBlur={() => setAiEndpoint(normalizeCoachEndpoint(aiEndpoint))}
                  />
                  <code className="ai-endpoint-preview" dir="ltr">{normalizedAiEndpoint}</code>
                  <small className={aiConfigValid ? 'field-hint' : 'field-error'}>
                    الرابط مضبوط تلقائيًا على مشروعك. لا تضع API Key داخل التطبيق.
                  </small>
                  <div className="ai-connection-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setAiEndpoint(DEFAULT_CLOUDFLARE_COACH_ENDPOINT)
                        setAiConnectionState('idle')
                        setAiConnectionMessage('تم وضع الرابط الصحيح. اضغط اختبار الموديل.')
                      }}
                    >
                      استخدم الرابط الصحيح
                    </Button>
                    <Button type="button" onClick={() => void runAiConnectionTest()} disabled={aiConnectionState === 'checking'}>
                      {aiConnectionState === 'checking' ? <><LoaderCircle className="spin" size={17} /> جاري الاختبار</> : <><Wifi size={17} /> اختبر الموديل</>}
                    </Button>
                  </div>
                  {aiConnectionMessage && (
                    <div className={`ai-connection-status ${aiConnectionState}`}>
                      {aiConnectionState === 'checking'
                        ? <LoaderCircle className="spin" size={18} />
                        : aiConnectionState === 'ok'
                          ? <CheckCircle2 size={18} />
                          : <CircleAlert size={18} />}
                      <span>{aiConnectionMessage}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="safety-note">لا تحتاج إلى وضع API Key داخل التطبيق. الاتصال يتم من خلال AI Binding آمن في Cloudflare، لذلك المفتاح لا يظهر للمستخدم ولا داخل ملفات الموقع.</p>
              <p className="field-hint">الذكاء الاصطناعي يقرأ الملف الشخصي وبيانات اليوم المسجلة، لكنه لا يشخّص أمراضًا ولا يصف أدوية، ولا يقدم أسماء تمارين أو جداول أو مجموعات وتكرارات.</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="الكرياتين">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={creatineEnabled}
            onChange={(event) => setCreatineEnabled(event.target.checked)}
          />
          <span>فعّل تنظيم الكرياتين في يومي</span>
        </label>

        {creatineEnabled && (
          <>
            <label>
              الجرعة اللي إنت مسجلها (جم)
              <input
                inputMode="decimal"
                value={creatineDose}
                onFocus={selectAll}
                onChange={(event) => setCreatineDose(event.target.value.replace(/[^0-9.]/g, '').slice(0, 4))}
              />
            </label>

            <Button variant={creatineLog ? 'secondary' : 'primary'} onClick={markCreatine}>
              <Pill size={18} />
              {creatineLog ? 'تم تسجيله اليوم' : 'سجل أني أخذته الآن'}
            </Button>
            {creatineUndo && (
              <button className="undo-inline" onClick={() => void undoCreatine()}><RotateCcw size={16} /> تراجع عن تسجيل الكرياتين</button>
            )}
          </>
        )}
      </Card>

      <Card title="تسجيل اختياري">
        <p className="muted">
          التطبيق مش هيسألك كل يوم. لو عملت العادة السرية وعايز اليوم ياخدها في الاعتبار، اضغط وقتها فقط.
        </p>

        <Button variant="secondary" onClick={logHabitNow}>
          {habitLoggedToday ? 'سجلت العادة اليوم' : 'سجل أني عملت العادة السرية الآن'}
        </Button>

        {(habitSaved || habitLoggedToday) && (
          <p className="safety-note">
            تم التسجيل. كمل يومك طبيعي، واشرب مياه لو عطشان، وخلي قرار الجيم حسب طاقتك الفعلية.
          </p>
        )}
      </Card>

      <Card title="النسخة الاحتياطية والاستعادة">
        <p className="muted">الملف يشمل الوجبات والمياه والأوزان والخصر والإعدادات وسجل الجيم والكرياتين.</p>
        <div className="button-row">
          <Button variant="secondary" onClick={exportData}>
            <Download size={18} />
            تصدير بياناتي
          </Button>
          <label className="backup-upload-button">
            <Upload size={18} /> اختر ملف استعادة
            <input type="file" accept="application/json,.json" onChange={(event) => void chooseBackupFile(event.target.files?.[0])} />
          </label>
        </div>

        {backupSummary && (
          <div className="backup-summary">
            <strong>الملف صالح — إصدار {backupSummary.version}</strong>
            <span>{backupSummary.users} مستخدم • {backupSummary.mealLogs} وجبة • {backupSummary.waterLogs} تسجيل مياه • {backupSummary.weightLogs} وزن</span>
            <small>{new Date(backupSummary.exportedAt).toLocaleString('ar-EG')}</small>
            <div className="button-row">
              <Button disabled={importingBackup} onClick={() => void restoreBackup('merge')}>دمج مع الحالي</Button>
              <Button disabled={importingBackup} variant="secondary" onClick={() => void restoreBackup('replace')}>استبدال كل البيانات</Button>
            </div>
          </div>
        )}
        {backupMessage && <p className="safety-note">{backupMessage}</p>}
      </Card>

      <Card title="إعادة التطبيق من البداية" className="danger-card">
        <div className="danger-head">
          <Trash2 size={28} />
          <div>
            <h2>حذف كل البيانات والبدء من جديد</h2>
            <p>ده هيمسح كل بيانات التطبيق من الجهاز.</p>
          </div>
        </div>

        <label>
          للتأكيد اكتب كلمة <strong>delete</strong>
          <input
            value={resetText}
            onChange={(event) => setResetText(event.target.value)}
            placeholder="delete"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <Button
          variant="secondary"
          disabled={resetText.trim() !== 'delete' || resetting}
          onClick={resetApp}
        >
          <Trash2 size={18} />
          {resetting ? 'جاري الحذف...' : 'امسح كل البيانات وابدأ من الأول'}
        </Button>
      </Card>
    </Page>
  )
}
