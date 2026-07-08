import { useMemo, useState, type FocusEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Scale, Sparkles, TrendingUp } from 'lucide-react'
import { appSettings } from '../../data/db'
import { dayReviewRepo, dailyTaskRepo, goalRepo, profileRepo, weightRepo } from '../../data/repositories'
import { dateKey, goalLabels, normalizeGoal, recommendGoal } from '../../domain/dailyCoach'
import { regenerateDailyPlan } from '../../services/planService'
import { Button, Card, EmptyState, Page, ProgressBar, Stat } from '../../components/UI'

const selectAll = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export default function ProgressPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const weights = useLiveQuery(() => weightRepo.list(userId), [userId]) ?? []
  const tasks = useLiveQuery(() => dailyTaskRepo.list(userId, today), [userId, today]) ?? []
  const reviews = useLiveQuery(() => dayReviewRepo.list(userId), [userId]) ?? []
  const [weight, setWeight] = useState(weights[0]?.valueKg.toString() ?? '75')

  const goal = normalizeGoal(rawGoal, userId)
  const completed = tasks.filter((task) => task.completed).length
  const adherence = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const averageWeight = weights.length ? average(weights.slice(0, 7).map((item) => item.valueKg)) : null
  const recentReviews = reviews.slice(0, 7)
  const reviewScore = recentReviews.length
    ? Math.round(average(recentReviews.map((item) => (item.foodAdherence + item.waterAdherence + item.energy) / 3)) * 10)
    : null

  const weeklySummary = useMemo(() => {
    if (!recentReviews.length) return ['سجّل تقييم نهاية اليوم عدة مرات علشان تظهر مراجعة أسبوعية حقيقية.']
    const food = average(recentReviews.map((item) => item.foodAdherence))
    const water = average(recentReviews.map((item) => item.waterAdherence))
    const energy = average(recentReviews.map((item) => item.energy))
    const gymDays = recentReviews.filter((item) => item.wentGym).length
    const creatineDays = recentReviews.filter((item) => item.creatineTaken).length
    const notes: string[] = []
    notes.push(`متوسط التزام الأكل ${food.toFixed(1)}/10، والمياه ${water.toFixed(1)}/10.`)
    notes.push(`متوسط الطاقة ${energy.toFixed(1)}/10، وأيام الجيم المسجلة ${gymDays}.`)
    notes.push(`الكرياتين تم تسجيله ${creatineDays} من ${recentReviews.length} أيام مراجعة.`)
    const focus = food < water ? 'الأولوية للأسبوع القادم: ثبّت وجباتك وبروتينك قبل إضافة تفاصيل جديدة.' : water < 7 ? 'الأولوية للأسبوع القادم: ارفع انتظام المياه خلال اليوم.' : energy < 6 ? 'الأولوية للأسبوع القادم: راجع النوم وازدحام اليوم قبل زيادة الالتزامات.' : 'الأولوية للأسبوع القادم: حافظ على نفس النظام بدون تعقيد إضافي.'
    notes.push(focus)
    return notes
  }, [recentReviews])

  const calorieSuggestion = useMemo(() => {
    if (weights.length < 6 || recentReviews.length < 4) return 'نحتاج تسجيلات وزن وتقييمات أكثر قبل تعديل السعرات.'
    const newest = average(weights.slice(0, 3).map((item) => item.valueKg))
    const older = average(weights.slice(-3).map((item) => item.valueKg))
    const change = newest - older
    const food = average(recentReviews.map((item) => item.foodAdherence))
    if (food < 7) return 'لا نعدّل السعرات الآن؛ الأولوية لتحسين الالتزام بالخطة الحالية.'
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
    return 'هدفك الحالي لا يحتاج تعديل سعرات تلقائيًا من بيانات قليلة؛ نراقب الاتجاه أولًا.'
  }, [weights, recentReviews, goal.primary])

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
    <Page title="تقدمي" subtitle="نركز على الاتجاه والالتزام، وبعدها نقرر هل الخطة تحتاج تعديل">
      <div className="stats-grid">
        <Stat label="هدفك الحالي" value={goalLabels[goal.primary]} />
        <Stat label="التزام خطة اليوم" value={`${adherence}%`} hint={`${completed} من ${tasks.length} خطوات`} />
        <Stat label="متوسط آخر الأوزان" value={averageWeight ? `${averageWeight.toFixed(1)} كجم` : '—'} />
        <Stat label="مؤشر الأسبوع" value={reviewScore == null ? '—' : `${reviewScore}%`} />
      </div>

      <Card title="مراجعة أسبوعية ذكية">
        <div className="weekly-review-head"><Sparkles size={28} /><div><strong>ما الذي نركز عليه الآن؟</strong><span>ملخص مبني على آخر تقييماتك المسجلة</span></div></div>
        <ul className="reason-list">{weeklySummary.map((item) => <li key={item}>{item}</li>)}</ul>
      </Card>

      <Card title="هل نعدّل السعرات؟">
        <div className="recommendation-card compact">
          <TrendingUp size={26} />
          <p>{calorieSuggestion}</p>
        </div>
        <p className="safety-note">التعديل المقترح صغير ومبدئي، ويظهر فقط بعد وجود تسجيلات كافية والتزام جيد. لا يتم تغيير السعرات عشوائيًا.</p>
      </Card>

      <Card title="التزام اليوم">
        <div className="adherence-row"><CheckCircle2 size={28} /><div><strong>{adherence}%</strong><span>من خطوات اليوم تمت</span></div></div>
        <ProgressBar value={completed} max={tasks.length || 1} />
      </Card>

      <Card title="سجل وزنك">
        <div className="weight-input-row">
          <Scale size={24} />
          <input inputMode="decimal" value={weight} onFocus={selectAll} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} />
          <span>كجم</span>
          <Button onClick={saveWeight}>حفظ</Button>
        </div>
        {weights.length ? (
          <div className="weight-history">
            {weights.slice(0, 10).map((item) => <div key={item.id}><strong>{item.valueKg} كجم</strong><span>{new Date(item.date).toLocaleDateString('ar-EG')}</span></div>)}
          </div>
        ) : <EmptyState text="لم تسجل وزنك بعد." />}
      </Card>
    </Page>
  )
}
