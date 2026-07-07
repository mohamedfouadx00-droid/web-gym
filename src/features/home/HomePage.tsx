import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Droplets, Dumbbell, Home, MapPin, Utensils } from 'lucide-react'
import { appSettings } from '../../data/db'
import { goalRepo, mealRepo, preferencesRepo, profileRepo, recoveryRepo, waterRepo, workoutRepo } from '../../data/repositories'
import { exercises, foods } from '../../data/seeds'
import {
  buildBeginnerWorkoutPlan,
  calculateNutritionTargets,
  calculateReadiness,
  getMealNowSuggestion,
  getTodayAction,
  isSameLocalDay,
} from '../../domain/smartCoach'
import ExerciseVisual from '../../components/ExerciseVisual'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

const goalLabels: Record<string, string> = {
  muscle: 'بناء العضلات', fat_loss: 'خسارة الدهون', recomp: 'إعادة تكوين الجسم',
  strength: 'زيادة القوة', fitness: 'تحسين اللياقة', maintain: 'الحفاظ على الوزن',
}

export default function HomePage() {
  const userId = appSettings.activeUserId!
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const goal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const preferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const recovery = useLiveQuery(() => recoveryRepo.list(userId), [userId]) ?? []
  const workouts = useLiveQuery(() => workoutRepo.list(userId), [userId]) ?? []
  const meals = useLiveQuery(() => mealRepo.list(userId), [userId]) ?? []
  const waterLogs = useLiveQuery(() => waterRepo.list(userId), [userId]) ?? []
  const [todayPlace, setTodayPlace] = useState<'gym' | 'home' | null>(() => appSettings.todayTrainingPlace)

  function choosePlace(place: 'gym' | 'home') {
    appSettings.todayTrainingPlace = place
    setTodayPlace(place)
  }

  const todayRecovery = recovery.find((item) => isSameLocalDay(item.date))
  const readiness = calculateReadiness(todayRecovery)
  const action = getTodayAction(preferences, recovery, workouts)
  const plan = buildBeginnerWorkoutPlan(workouts, preferences, todayPlace ?? (preferences?.trainingPlace === 'home' ? 'home' : 'gym'))

  const todayMeals = meals.filter((item) => isSameLocalDay(item.date))
  const totals = todayMeals.reduce((sum, item) => {
    const food = foods.find((candidate) => candidate.id === item.foodId)
    return food ? { calories: sum.calories + food.calories * item.servings, protein: sum.protein + food.protein * item.servings } : sum
  }, { calories: 0, protein: 0 })
  const targets = profile && goal ? calculateNutritionTargets(profile, goal) : null
  const mealNow = getMealNowSuggestion(new Date().getHours(), Math.max(0, (targets?.calories ?? 0) - totals.calories), Math.max(0, (targets?.proteinG ?? 0) - totals.protein))
  const waterToday = waterLogs.filter((item) => isSameLocalDay(item.date)).reduce((sum, item) => sum + item.amountMl, 0)
  const completedToday = workouts.some((item) => item.endedAt && isSameLocalDay(item.endedAt))

  return (
    <Page title={`أهلاً ${profile?.name ?? ''}`} subtitle="مش محتاج تقرر لوحدك. أنا هقولك تعمل إيه خطوة بخطوة.">
      {profile?.healthFlags?.length ? <div className="safety-banner"><strong>تنبيه سلامة محفوظ في ملفك</strong><span>عندك عرض صحي مسجل. ما تتجاهلش ألم الصدر أو الدوخة أو الألم الحاد، واطلب تقييمًا متخصصًا قبل المجهود القوي.</span></div> : null}

      <section className="today-place-card">
        <div className="place-copy"><span className="eyebrow">أول سؤال لليوم</span><h2>هتتمرن فين النهارده؟</h2><p>اختيارك يغيّر الخطة بالكامل. لو اخترت الجيم هقولك تروح على أنهي أجهزة وشكلها. لو البيت هديك تمارين مناسبة للمكان.</p></div>
        <div className="place-options">
          <button className={`place-option ${todayPlace === 'gym' ? 'selected' : ''}`} onClick={() => choosePlace('gym')}><MapPin size={27}/><strong>هتمرن في الجيم</strong><span>أجهزة + صور تعريفية</span></button>
          <button className={`place-option ${todayPlace === 'home' ? 'selected' : ''}`} onClick={() => choosePlace('home')}><Home size={27}/><strong>هتمرن في البيت</strong><span>وزن الجسم + أدوات بسيطة</span></button>
        </div>
      </section>

      {!todayPlace && action.type === 'workout' ? (
        <section className="coach-command priority"><div className="coach-badge">قرار المدرب الآن</div><h2>اختار مكان تمرينك الأول</h2><p>بعدها هجهز لك التمرين المناسب للمكان، بالترتيب والصور وطريقة التنفيذ.</p></section>
      ) : (
        <section className={`coach-command ${action.priority === 'high' ? 'priority' : ''}`}><div className="coach-badge">قرار المدرب الآن</div><h2>{action.title}</h2><p>{action.message}</p><Link to={action.route}><Button>{action.cta} <ArrowLeft size={18}/></Button></Link></section>
      )}

      <div className="stats-grid">
        <Stat label="الجاهزية" value={readiness == null ? 'لسه ما اتحسبتش' : `${readiness}%`} hint={readiness == null ? 'سجّل حالتك أولًا' : readiness >= 75 ? 'جيدة للتمرين' : readiness >= 55 ? 'متوسطة' : 'منخفضة'} />
        <Stat label="مكان تمرين اليوم" value={todayPlace === 'gym' ? 'الجيم' : todayPlace === 'home' ? 'البيت' : 'لسه ما اخترتش'} />
        <Stat label="هدفك الحالي" value={goal ? goalLabels[goal.primary] : 'غير محدد'} />
      </div>

      <Card title="خطة يومك خطوة بخطوة" className="timeline-card">
        <div className="daily-step done"><span className="step-icon"><CheckCircle2 size={18}/></span><div><strong>1. بياناتك وهدفك</strong><p>محفوظة ومستخدمة في كل قرار.</p></div></div>
        <div className={`daily-step ${todayPlace ? 'done' : 'current'}`}><span className="step-icon">2</span><div><strong>2. مكان تمرين اليوم</strong><p>{todayPlace ? `اخترت ${todayPlace === 'gym' ? 'الجيم' : 'البيت'}` : 'اختاره من أول الصفحة.'}</p></div></div>
        <div className={`daily-step ${todayRecovery ? 'done' : 'current'}`}><span className="step-icon">3</span><div><strong>3. فحص الجاهزية</strong><p>{todayRecovery ? `اتحسبت: ${readiness}%` : 'مطلوب قبل قرار التمرين.'}</p></div>{!todayRecovery && <Link to="/recovery" className="text-link">ابدأ</Link>}</div>
        <div className={`daily-step ${completedToday ? 'done' : action.type === 'workout' ? 'current' : ''}`}><span className="step-icon"><Dumbbell size={18}/></span><div><strong>4. تمرين اليوم</strong><p>{completedToday ? 'تم وحُفظ.' : `${plan.title} · حوالي ${plan.estimatedMinutes} دقيقة`}</p></div>{todayPlace && !completedToday && <Link to="/workout" className="text-link">ابدأ الخطة</Link>}</div>
        <div className="daily-step"><span className="step-icon"><Utensils size={18}/></span><div><strong>5. كل إيه دلوقتي؟</strong><p>{mealNow.title}</p></div><Link to="/nutrition" className="text-link">التفاصيل</Link></div>
        <div className="daily-step"><span className="step-icon"><Droplets size={18}/></span><div><strong>6. المياه</strong><p>{waterToday} مل مسجلين اليوم.</p></div><Link to="/nutrition" className="text-link">سجّل</Link></div>
      </Card>

      {todayPlace ? <Card title={`تمرينك القادم في ${todayPlace === 'gym' ? 'الجيم' : 'البيت'}`}>
        <h3 className="big-card-title">{plan.title}</h3>
        <p className="muted">أنا اخترت التمارين والترتيب. افتح كل تمرين وهتشوف شكل الجهاز أو الحركة قبل ما تبدأ.</p>
        <div className="home-plan-preview">
          {plan.exercises.slice(0, 4).map((item, index) => {
            const exercise = exercises.find((candidate) => candidate.id === item.exerciseId)
            if (!exercise) return null
            return <div className="home-plan-item" key={item.exerciseId}><ExerciseVisual exerciseId={exercise.id} compact/><div><span>{index + 1}</span><strong>{exercise.nameAr}</strong><small>{exercise.equipment}</small></div></div>
          })}
        </div>
        <Link to="/workout"><Button variant="secondary">افتح التمرين الموجّه</Button></Link>
      </Card> : <EmptyState text="اختار الجيم أو البيت عشان أجهز لك تمرين اليوم."/>}

      <Card title="أكلك الآن"><h3 className="big-card-title">{mealNow.title}</h3><ul className="clean-list">{mealNow.items.map((item) => <li key={item}>{item}</li>)}</ul><p className="muted">{mealNow.reason}</p><Link to="/nutrition"><Button variant="secondary">شوف الكميات والهدف</Button></Link></Card>

      {!profile || !goal || !preferences ? <EmptyState text="بياناتك الأساسية غير مكتملة. افتح المزيد وراجع ملفك."/> : null}
    </Page>
  )
}
