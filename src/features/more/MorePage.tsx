import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Pill, Save, Trash2 } from 'lucide-react'
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
import { Button, Card, Page, Stat } from '../../components/UI'

const selectAll = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()

export default function MorePage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()

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
  const [saved, setSaved] = useState(false)
  const [habitSaved, setHabitSaved] = useState(false)
  const [resetText, setResetText] = useState('')
  const [resetting, setResetting] = useState(false)

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
  }, [preferences.gymPeriod, preferences.creatineEnabled, preferences.creatineDoseG])

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
  const habitLoggedToday = events.some((event) => event.type === 'masturbation_logged')

  async function saveSettings() {
    if (!profile) return

    await Promise.all([
      profileRepo.save(profileDraft),
      goalRepo.save({ ...goal, primary: recommendation.goal }),
      preferencesRepo.save({
        ...preferences,
        gymPeriod,
        creatineEnabled,
        creatineDoseG: Number(creatineDose),
      }),
    ])

    await regenerateDailyPlan(userId, today)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  async function markCreatine() {
    await creatineRepo.markTaken({
      userId,
      dateKey: today,
      doseG: Number(creatineDose),
      takenAt: new Date().toISOString(),
    })

    const tasks = await dailyTaskRepo.list(userId, today)
    const task = tasks.find((item) => item.type === 'creatine' && !item.completed)
    if (task?.id) await dailyTaskRepo.setCompleted(task.id, true)
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
    const data = {
      exportedAt: new Date().toISOString(),
      users: await db.users.toArray(),
      profiles: await db.profiles.toArray(),
      goals: await db.goals.toArray(),
      preferences: await db.preferences.toArray(),
      weightLogs: await db.weightLogs.toArray(),
      waterLogs: await db.waterLogs.toArray(),
      availableFoods: await db.availableFoods.toArray(),
      dailyCheckIns: await db.dailyCheckIns.toArray(),
      dailyTasks: await db.dailyTasks.toArray(),
      mealPlans: await db.mealPlans.toArray(),
      creatineLogs: await db.creatineLogs.toArray(),
      dayEvents: await db.dayEvents.toArray(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'gym-life-coach-backup.json'
    link.click()
    URL.revokeObjectURL(link.href)
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
      </Card>

      <Card title="ميعاد الجيم">
        <div className="chips">
          <button className={gymPeriod === 'auto' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('auto')}>هو يختار</button>
          <button className={gymPeriod === 'afternoon' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('afternoon')}>أفضل العصر</button>
          <button className={gymPeriod === 'evening' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('evening')}>أفضل المساء</button>
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

      <Button onClick={saveSettings}>
        <Save size={18} />
        {saved ? 'تم الحفظ وإعادة ترتيب اليوم' : 'احفظ التغييرات'}
      </Button>

      <Card title="نسخة احتياطية">
        <Button variant="secondary" onClick={exportData}>
          <Download size={18} />
          تصدير بياناتي
        </Button>
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
