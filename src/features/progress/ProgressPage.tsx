import { useMemo, useState, type FocusEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Scale, Sparkles, TrendingUp } from 'lucide-react'
import { appSettings, db } from '../../data/db'
import { goalRepo, profileRepo, weightRepo } from '../../data/repositories'
import { dateKey, goalLabels, normalizeGoal, recommendGoal } from '../../domain/dailyCoach'
import { regenerateDailyPlan } from '../../services/planService'
import { Button, Card, EmptyState, Page, ProgressBar, Stat } from '../../components/UI'

const selectAll = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function lastDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - index)
    return date.toISOString().slice(0, 10)
  })
}

export default function ProgressPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const weights = useLiveQuery(() => weightRepo.list(userId), [userId]) ?? []

  const last7 = useMemo(() => lastDateKeys(7), [])
  const allTasks = useLiveQuery(
    () => db.dailyTasks.where('userId').equals(userId).filter((task) => last7.includes(task.dateKey)).toArray(),
    [userId],
  ) ?? []
  const waterLogs = useLiveQuery(() => db.waterLogs.where('userId').equals(userId).toArray(), [userId]) ?? []
  const creatineLogs = useLiveQuery(
    () => db.creatineLogs.where('userId').equals(userId).filter((log) => last7.includes(log.dateKey)).toArray(),
    [userId],
  ) ?? []
  const events = useLiveQuery(
    () => db.dayEvents.where('userId').equals(userId).filter((event) => last7.includes(event.dateKey)).toArray(),
    [userId],
  ) ?? []

  const [weight, setWeight] = useState(weights[0]?.valueKg.toString() ?? '75')
  const goal = normalizeGoal(rawGoal, userId)

  const todayTasks = allTasks.filter((task) => task.dateKey === today)
  const dueTodayTasks = todayTasks.filter((task) => task.timeMinutes <= currentMinutes() + 15)
  const todayCompleted = dueTodayTasks.filter((task) => task.completed).length
  const todayScore = dueTodayTasks.length ? Math.round((todayCompleted / dueTodayTasks.length) * 100) : 100

  const dailyScores = useMemo(() => last7.map((day) => {
    const tasks = allTasks.filter((task) => task.dateKey === day)
    if (!tasks.length) return null
    const taskScore = tasks.filter((task) => task.completed).length / tasks.length
    const gymFinished = events.some((event) => event.dateKey === day && event.type === 'gym_finished')
    const creatineTaken = creatineLogs.some((log) => log.dateKey === day)
    const bonus = (gymFinished ? 0.05 : 0) + (creatineTaken ? 0.05 : 0)
    return Math.min(100, Math.round((taskScore + bonus) * 100))
  }).filter((value): value is number => value !== null), [allTasks, events, creatineLogs, last7])

  const weeklyScore = dailyScores.length ? Math.round(average(dailyScores)) : null
  const averageWeight = weights.length ? average(weights.slice(0, 7).map((item) => item.valueKg)) : null

  const weeklySummary = useMemo(() => {
    if (!dailyScores.length) return ['استخدم التطبيق عدة أيام وسجّل الخطوات، وبعدها هتظهر مراجعة أسبوعية تلقائية.']

    const completedRatio = allTasks.length
      ? allTasks.filter((task) => task.completed).length / allTasks.length
      : 0
    const gymDays = new Set(events.filter((event) => event.type === 'gym_finished').map((event) => event.dateKey)).size
    const creatineDays = new Set(creatineLogs.map((log) => log.dateKey)).size

    const notes: string[] = []
    notes.push(`متوسط تنفيذ الخطوات خلال الأيام المسجلة: ${Math.round(completedRatio * 100)}%.`)
    notes.push(`أيام الجيم المكتملة: ${gymDays}، وأيام الكرياتين المسجلة: ${creatineDays}.`)

    const focus = completedRatio < 0.6
      ? 'الأولوية للأسبوع القادم: نفّذ الخطوات الأساسية فقط بدل ما تزود مهام جديدة.'
      : creatineDays < Math.min(5, dailyScores.length)
        ? 'الأولوية للأسبوع القادم: ثبّت الكرياتين يوميًا لو هو مفعّل عندك.'
        : gymDays === 0 && events.some((event) => event.type === 'gym_departed' || event.type === 'gym_started')
          ? 'الأولوية للأسبوع القادم: اقفل رحلة الجيم بزر «خلصت الجيم» عشان الخطة تعرف تكمل ما بعد التمرين.'
          : 'الأولوية للأسبوع القادم: حافظ على نفس النظام من غير تعقيد إضافي.'

    notes.push(focus)
    return notes
  }, [dailyScores, allTasks, events, creatineLogs])

  const calorieSuggestion = useMemo(() => {
    if (weights.length < 6 || (weeklyScore ?? 0) < 70) {
      return 'لسه مش هنعدل السعرات. نحتاج وزن مسجل بانتظام والتزام أسبوعي جيد الأول.'
    }

    const newest = average(weights.slice(0, 3).map((item) => item.valueKg))
    const older = average(weights.slice(-3).map((item) => item.valueKg))
    const change = newest - older

    if (goal.primary === 'lean_gain') {
      if (change < 0.1) return 'الوزن شبه ثابت مع التزام جيد: اقتراح مبدئي بزيادة صغيرة حوالي 100 سعر يوميًا.'
      if (change > 0.7) return 'الزيادة سريعة نسبيًا: اقتراح مبدئي بتقليل حوالي 100 سعر يوميًا.'
      return 'اتجاه الوزن مناسب لهدف بناء العضلات. لا تعديل مقترح الآن.'
    }

    if (goal.primary === 'fat_loss') {
      if (change > -0.1) return 'الوزن لا ينخفض رغم الالتزام الجيد: اقتراح مبدئي بخفض حوالي 100 سعر يوميًا.'
      if (change < -1) return 'الانخفاض سريع نسبيًا: اقتراح مبدئي بزيادة حوالي 100 سعر يوميًا.'
      return 'اتجاه الوزن مناسب لهدف خسارة الدهون. لا تعديل مقترح الآن.'
    }

    return 'نراقب اتجاه الوزن أكثر قبل تعديل السعرات.'
  }, [weights, weeklyScore, goal.primary])

  async function saveWeight() {
    const value = Number(weight)
    if (!value) return

    await weightRepo.add({ userId, valueKg: value, date: new Date().toISOString() })

    if (profile) {
      const updatedProfile = { ...profile, currentWeightKg: value }
      await profileRepo.save(updatedProfile)
      const currentGoal = normalizeGoal(await goalRepo.get(userId), userId)
      const recommendation = recommendGoal(updatedProfile)
      await goalRepo.save({ ...currentGoal, primary: recommendation.goal })
      await regenerateDailyPlan(userId, today)
    }
  }

  return (
    <Page title="تقدمي" subtitle="التقييم بيطلع تلقائيًا من اللي سجلته وعملته، من غير زر «هخلص يومي»">
      <div className="stats-grid">
        <Stat label="هدفك الحالي" value={goalLabels[goal.primary]} />
        <Stat label="التزامك حتى الآن" value={`${todayScore}%`} hint={`${todayCompleted} من ${dueTodayTasks.length} خطوات مستحقة`} />
        <Stat label="متوسط آخر الأوزان" value={averageWeight ? `${averageWeight.toFixed(1)} كجم` : '—'} />
        <Stat label="مؤشر الأسبوع" value={weeklyScore == null ? '—' : `${weeklyScore}%`} />
      </div>

      <Card title="مراجعة أسبوعية تلقائية">
        <div className="weekly-review-head">
          <Sparkles size={28} />
          <div>
            <strong>ما الذي نركز عليه الآن؟</strong>
            <span>من الخطوات والجيم والكرياتين اللي سجلتهم فعلًا</span>
          </div>
        </div>
        <ul className="reason-list">{weeklySummary.map((item) => <li key={item}>{item}</li>)}</ul>
      </Card>

      <Card title="هل نعدّل السعرات؟">
        <div className="recommendation-card compact">
          <TrendingUp size={26} />
          <p>{calorieSuggestion}</p>
        </div>
        <p className="safety-note">التعديل لا يظهر إلا بعد وجود وزن كفاية والتزام أسبوعي واضح.</p>
      </Card>

      <Card title="تنفيذ خطوات اليوم">
        <div className="adherence-row">
          <CheckCircle2 size={28} />
          <div><strong>{todayScore}%</strong><span>محسوب من الخطوات اللي ميعادها جه فقط</span></div>
        </div>
        <ProgressBar value={todayCompleted} max={dueTodayTasks.length || 1} />
      </Card>

      <Card title="سجل وزنك">
        <div className="weight-input-row">
          <Scale size={24} />
          <input
            inputMode="decimal"
            value={weight}
            onFocus={selectAll}
            onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
          />
          <span>كجم</span>
          <Button onClick={saveWeight}>حفظ</Button>
        </div>

        {weights.length ? (
          <div className="weight-history">
            {weights.slice(0, 10).map((item) => (
              <div key={item.id}>
                <strong>{item.valueKg} كجم</strong>
                <span>{new Date(item.date).toLocaleDateString('ar-EG')}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState text="لم تسجل وزنك بعد." />}
      </Card>
    </Page>
  )
}
