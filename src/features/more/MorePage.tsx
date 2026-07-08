import { useEffect, useMemo, useState, type FocusEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Moon, Pill, Save, Trash2 } from 'lucide-react'
import { appSettings, db } from '../../data/db'
import { creatineRepo, dailyTaskRepo, goalRepo, preferencesRepo, profileRepo } from '../../data/repositories'
import { dateKey, goalLabels, normalizeGoal, normalizePreferences, recommendGoal } from '../../domain/dailyCoach'
import type { ActivityLevel, GymPeriod, TrainingExperience, UserProfile, WeightTrend } from '../../domain/models'
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
  const [gymPeriod, setGymPeriod] = useState<GymPeriod>('auto')
  const [creatineEnabled, setCreatineEnabled] = useState(true)
  const [creatineDose, setCreatineDose] = useState('5')
  const [saved, setSaved] = useState(false)
  const [resetText, setResetText] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setBirthYear(String(profile.birthYear))
      setHeight(String(profile.heightCm))
      setWeight(String(profile.currentWeightKg))
      setWaist(profile.waistCm ? String(profile.waistCm) : '')
      setActivity(profile.activityLevel)
      setTrainingExperience(profile.trainingExperience ?? 'new')
      setWeightTrend(profile.weightTrend ?? 'stable')
    }
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
    birthYear: Number(birthYear) || profile?.birthYear || 2000,
    heightCm: Number(height) || profile?.heightCm || 175,
    currentWeightKg: Number(weight) || profile?.currentWeightKg || 75,
    waistCm: Number(waist) || undefined,
    activityLevel: activity,
    trainingExperience,
    weightTrend,
  }), [profile?.id, profile?.birthYear, profile?.heightCm, profile?.currentWeightKg, userId, name, birthYear, height, weight, waist, activity, trainingExperience, weightTrend])

  const recommendation = useMemo(() => recommendGoal(profileDraft), [profileDraft])

  async function saveSettings() {
    if (!profile) return
    await Promise.all([
      profileRepo.save(profileDraft),
      goalRepo.save({ ...goal, primary: recommendation.goal }),
      preferencesRepo.save({ ...preferences, targetWakeTime: '08:00', desiredSleepHours: 8, gymPeriod, creatineEnabled, creatineDoseG: Number(creatineDose) }),
    ])
    await regenerateDailyPlan(userId, today)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  async function markCreatine() {
    await creatineRepo.markTaken({ userId, dateKey: today, doseG: Number(creatineDose), takenAt: new Date().toISOString() })
    const tasks = await dailyTaskRepo.list(userId, today)
    const creatineTask = tasks.find((task) => task.type === 'creatine')
    if (creatineTask?.id) await dailyTaskRepo.setCompleted(creatineTask.id, true)
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
      dayReviews: await db.dayReviews.toArray(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'gym-daily-coach-backup.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }


  return (
    <Page title="المزيد" subtitle="حدّث بياناتك، والتطبيق يعيد اختيار الهدف وترتيب اليوم تلقائيًا">
      <div className="stats-grid">
        <Stat label="هدفك الأنسب حاليًا" value={goalLabels[recommendation.goal]} />
        <Stat label="نصيحة النوم" value="قرّب من 8 ساعات" hint="مش شرط تلتزم بميعاد ثابت" />
        <Stat label="تسجيل النوم" value="تلقائي" hint="من هنام الآن / صحيت الآن" />
        <Stat label="الكرياتين اليوم" value={creatineEnabled ? (creatineLog ? 'تم أخذه' : 'لسه') : 'غير مفعل'} />
      </div>

      <Card title="بياناتي والتحليل التلقائي">
        <label>الاسم<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="form-grid">
          <label>سنة الميلاد<input inputMode="numeric" value={birthYear} onFocus={selectAll} onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
          <label>الطول (سم)<input inputMode="numeric" value={height} onFocus={selectAll} onChange={(event) => setHeight(event.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
          <label>الوزن (كجم)<input inputMode="decimal" value={weight} onFocus={selectAll} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} /></label>
          <label>محيط الخصر (سم) — اختياري<input inputMode="decimal" value={waist} onFocus={selectAll} onChange={(event) => setWaist(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} placeholder="اتركه فارغًا لو مش عارفه" /><small className="field-hint">إضافة الخصر لاحقًا تحسّن دقة التحليل، لكنها ليست مطلوبة.</small></label>
        </div>
        <label>نشاطك خارج الجيم<select value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}><option value="low">قليل</option><option value="moderate">متوسط</option><option value="high">عالي</option></select></label>
        <label>خبرتك في الجيم<select value={trainingExperience} onChange={(event) => setTrainingExperience(event.target.value as TrainingExperience)}><option value="new">جديد — لسه بادئ أو أقل من 6 شهور</option><option value="some">خبرة بسيطة</option><option value="experienced">منتظم من فترة طويلة</option></select></label>
        <label>اتجاه وزنك مؤخرًا<select value={weightTrend} onChange={(event) => setWeightTrend(event.target.value as WeightTrend)}><option value="losing">بينزل</option><option value="stable">ثابت تقريبًا</option><option value="gaining">بيزيد</option></select></label>
      </Card>

      <Card title="توصية التطبيق لهدفك">
        <div className="recommendation-card">
          <span className="eyebrow">الهدف يتحدد تلقائيًا</span>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.summary}</p>
          <div className="recommendation-metrics">
            <span>مؤشر الوزن بالنسبة للطول: {recommendation.bmi}</span>
            {recommendation.waistToHeight !== undefined && <span>نسبة الخصر للطول: {recommendation.waistToHeight}</span>}
          </div>
          <ul className="reason-list">{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
        <p className="safety-note">التوصية مبدئية لتنظيم الأكل وليست تشخيصًا طبيًا. أي حالة مرضية أو تعليمات علاجية لها الأولوية.</p>
      </Card>

      <Card title="نظام النوم">
        <div className="sleep-advice-card">
          <div className="sleep-advice-icon"><span>8h</span></div>
          <div>
            <span className="eyebrow">نصيحة فقط</span>
            <h3>الأفضل تقرّب من 8 ساعات لما تقدر</h3>
            <p>مفيش سؤال عن ميعاد الاستيقاظ المستهدف. التطبيق بيحسب نومك من وقت ما تضغط «أنا هنام الآن» لحد «أنا صحيت الآن». ولو نسيت، تقدر تضيف وقت النوم يدويًا.</p>
            <small>لو يومك مضغوط، 6 ساعات أفضل من نوم أقل — لكن ده مش هدف مفروض عليك.</small>
          </div>
        </div>
      </Card>

      <Card title="ميعاد الجيم">
        <p className="muted">إنت كل يوم تقول فقط هل رايح الجيم أم لا. التطبيق يحدد الوقت داخل يومك.</p>
        <div className="chips">
          <button className={gymPeriod === 'auto' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('auto')}>هو يختار</button>
          <button className={gymPeriod === 'afternoon' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('afternoon')}>أفضل العصر</button>
          <button className={gymPeriod === 'evening' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('evening')}>أفضل المساء</button>
        </div>
      </Card>

      <Card title="الكرياتين">
        <label className="toggle-row"><input type="checkbox" checked={creatineEnabled} onChange={(event) => setCreatineEnabled(event.target.checked)} /><span>فعّل تنظيم الكرياتين في يومي</span></label>
        {creatineEnabled && <><label>جرعتي اليومية المسجلة (جم)<input inputMode="decimal" value={creatineDose} onFocus={selectAll} onChange={(event) => setCreatineDose(event.target.value.replace(/[^0-9.]/g, '').slice(0, 4))} /></label><Button variant={creatineLog ? 'secondary' : 'primary'} onClick={markCreatine}><Pill size={18} /> {creatineLog ? 'تم تسجيله اليوم' : 'سجل أني أخذته الآن'}</Button></>}
        <p className="safety-note">الموقع ينظم الجرعة التي سجلتها أنت ولا يغيّرها طبيًا. لو عندك مرض كلوي أو تعليمات طبية خاصة، راجع طبيبك قبل استخدام المكمل.</p>
      </Card>

      <Button onClick={saveSettings}><Save size={18} /> {saved ? 'تم الحفظ وإعادة التحليل' : 'احفظ وأعد تحليل هدفي وترتيب اليوم'}</Button>

      <Card title="نسخة احتياطية">
        <p className="muted">نزّل بياناتك في ملف JSON للاحتفاظ بها.</p>
        <Button variant="secondary" onClick={exportData}><Download size={18} /> تصدير بياناتي</Button>
      </Card>

      <Card title="إعادة التطبيق من البداية" className="danger-card">
        <div className="danger-head"><Trash2 size={28} /><div><h2>حذف كل البيانات والبدء من جديد</h2><p>ده هيمسح الوزن والأكل والخطط والمياه والكرياتين وكل سجلاتك من الجهاز.</p></div></div>
        <label>للتأكيد اكتب كلمة <strong>delete</strong><input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder="delete" autoCapitalize="none" autoCorrect="off" /></label>
        <Button variant="secondary" disabled={resetText.trim() !== 'delete' || resetting} onClick={resetApp}><Trash2 size={18} /> {resetting ? 'جاري الحذف...' : 'امسح كل البيانات وابدأ من الأول'}</Button>
      </Card>
    </Page>
  )
}
