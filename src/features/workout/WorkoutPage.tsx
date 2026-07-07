import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, ChevronDown, Dumbbell, Home, MapPin, TimerReset } from 'lucide-react'
import { appSettings } from '../../data/db'
import { preferencesRepo, profileRepo, recoveryRepo, workoutRepo } from '../../data/repositories'
import { exercises } from '../../data/seeds'
import { analyzeSet, buildBeginnerWorkoutPlan, calculateReadiness, getWeightRecommendation, isSameLocalDay } from '../../domain/smartCoach'
import type { FormQuality, WorkoutSession } from '../../domain/models'
import ExerciseVisual from '../../components/ExerciseVisual'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

export default function WorkoutPage() {
  const userId = appSettings.activeUserId!
  const history = useLiveQuery(() => workoutRepo.list(userId), [userId]) ?? []
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const preferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const recovery = useLiveQuery(() => recoveryRepo.list(userId), [userId]) ?? []
  const [todayPlace, setTodayPlace] = useState<'gym' | 'home' | null>(() => appSettings.todayTrainingPlace)
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [nextSuggestions, setNextSuggestions] = useState<Record<string, number>>({})
  const [rest, setRest] = useState(90)
  const [running, setRunning] = useState(false)

  const chosenPlace = todayPlace ?? (preferences?.trainingPlace === 'home' ? 'home' : 'gym')
  const plan = buildBeginnerWorkoutPlan(history, preferences, chosenPlace)
  const todayRecovery = recovery.find((item) => isSameLocalDay(item.date))
  const readiness = calculateReadiness(todayRecovery)
  const displayRest = useMemo(() => `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`, [rest])

  React.useEffect(() => {
    if (!running || rest <= 0) return
    const timer = window.setInterval(() => setRest((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, rest])

  function choosePlace(place: 'gym' | 'home') {
    appSettings.todayTrainingPlace = place
    setTodayPlace(place)
  }

  function startTodayWorkout() {
    if (!todayPlace) return
    setSession({ id: crypto.randomUUID(), userId, startedAt: new Date().toISOString(), title: plan.title, planId: plan.id, readinessScore: readiness ?? undefined, exercises: plan.exercises.map((item) => ({ exerciseId: item.exerciseId, sets: [] })) })
  }

  function updateSet(exerciseId: string, setId: string, key: 'reps' | 'weightKg' | 'rpe' | 'formQuality', value: number | FormQuality) {
    if (!session) return
    setSession({ ...session, exercises: session.exercises.map((entry) => entry.exerciseId === exerciseId ? { ...entry, sets: entry.sets.map((set) => set.id === setId ? { ...set, [key]: value } : set) } : entry) })
  }

  function addSet(exerciseId: string) {
    if (!session) return
    const prescribed = plan.exercises.find((item) => item.exerciseId === exerciseId)
    const exercise = exercises.find((item) => item.id === exerciseId)
    if (!prescribed || !exercise) return
    const recommendation = getWeightRecommendation(exerciseId, history, { min: prescribed.minReps, max: prescribed.maxReps }, exercise.incrementKg ?? 2.5, exercise.startingWeightGuide)
    const suggested = nextSuggestions[exerciseId] ?? recommendation.suggestedKg ?? 0
    setSession({ ...session, exercises: session.exercises.map((entry) => entry.exerciseId === exerciseId ? { ...entry, sets: [...entry.sets, { id: crypto.randomUUID(), reps: prescribed.minReps, weightKg: suggested, rpe: 7, formQuality: 'good' }] } : entry) })
  }

  function analyze(exerciseId: string, setId: string) {
    if (!session) return
    const entry = session.exercises.find((item) => item.exerciseId === exerciseId)
    const set = entry?.sets.find((item) => item.id === setId)
    const prescribed = plan.exercises.find((item) => item.exerciseId === exerciseId)
    const exercise = exercises.find((item) => item.id === exerciseId)
    if (!set || !prescribed || !exercise || set.weightKg < 0 || set.reps <= 0) return
    const result = analyzeSet(set.weightKg, set.reps, set.rpe, set.formQuality === 'good', prescribed.minReps, prescribed.maxReps, exercise.incrementKg ?? 2.5)
    setNextSuggestions((current) => ({ ...current, [exerciseId]: result.nextWeightKg }))
    const loadText = (exercise.incrementKg ?? 0) > 0 ? ` الوزن المقترح للمجموعة القادمة: ${result.nextWeightKg} كجم.` : ''
    setSession({ ...session, exercises: session.exercises.map((currentEntry) => currentEntry.exerciseId === exerciseId ? { ...currentEntry, sets: currentEntry.sets.map((currentSet) => currentSet.id === setId ? { ...currentSet, coachFeedback: `${result.message}${loadText}` } : currentSet) } : currentEntry) })
  }

  async function finish() {
    if (!session || !session.exercises.some((entry) => entry.sets.length > 0)) return
    await workoutRepo.save({ ...session, endedAt: new Date().toISOString() })
    setSession(null); setNextSuggestions({}); setRunning(false); setRest(90)
  }

  if (!todayPlace && !session) {
    return <Page title="التمرين" subtitle="قبل الخطة: هتتمرن فين النهارده؟">
      <section className="workout-place-gate"><span className="eyebrow">اختيار اليوم فقط</span><h2>أنا هغيّر الخطة حسب المكان</h2><p>اختار المكان، وبعدها هتشوف تمارين مناسبة له وصور توضيحية للجهاز أو الحركة.</p><div className="place-options"><button className="place-option" onClick={() => choosePlace('gym')}><MapPin size={30}/><strong>هتمرن في الجيم</strong><span>أحدد لك الأجهزة وشكلها</span></button><button className="place-option" onClick={() => choosePlace('home')}><Home size={30}/><strong>هتمرن في البيت</strong><span>تمارين بدون أجهزة كبيرة</span></button></div></section>
    </Page>
  }

  if (!session) {
    return <Page title="التمرين" subtitle="مش هتختار تمارين ولا ترتيب. الخطة جاهزة.">
      {profile?.healthFlags?.length ? <div className="safety-banner"><AlertTriangle size={20}/><span>عندك عرض صحي مسجل. لا تبدأ مجهودًا قويًا إذا عندك ألم صدر أو دوخة أو ألم حاد، وخد تقييمًا متخصصًا قبل الاستمرار.</span></div> : null}
      <div className="location-strip"><div><span>مكان تمرين اليوم</span><strong>{todayPlace === 'gym' ? 'الجيم' : 'البيت'}</strong></div><button className="text-link" onClick={() => { appSettings.todayTrainingPlace = null; setTodayPlace(null) }}>تغيير المكان</button></div>

      <section className="workout-brief"><span className="eyebrow">خطة اليوم</span><h2>{plan.title}</h2><p>حوالي {plan.estimatedMinutes} دقيقة · {plan.exercises.length} تمارين · {readiness == null ? 'الجاهزية لم تُسجل' : `جاهزية ${readiness}%`}</p>
        <div className="plan-sequence visual-plan">{plan.exercises.map((item, index) => { const exercise = exercises.find((candidate) => candidate.id === item.exerciseId); if (!exercise) return null; return <div className="plan-row visual" key={item.exerciseId}><ExerciseVisual exerciseId={exercise.id} compact/><span>{index + 1}</span><div><strong>{exercise.nameAr}</strong><small>{exercise.equipment}</small><small>{item.sets} مجموعات · {item.minReps}-{item.maxReps} عدة</small></div></div> })}</div>
        <Button onClick={startTodayWorkout}>ابدأ التمرين الموجّه</Button>
      </section>

      <Card title={todayPlace === 'gym' ? 'مش هتضيع بين الأجهزة' : 'مش محتاج معدات معقدة'}><div className="how-it-works"><div><strong>شوف الصورة</strong><p>{todayPlace === 'gym' ? 'كل تمرين فيه شكل توضيحي للجهاز وعلامات تعرفه بها.' : 'هتشوف وضع البداية والنهاية للحركة.'}</p></div><div><strong>اقرأ 3 خطوات</strong><p>قبل أول مجموعة راجع التنفيذ والأخطاء الشائعة.</p></div><div><strong>بعد المجموعة</strong><p>سجّل النتيجة وأنا أقرر تثبت أو تغيّر الحمل.</p></div></div></Card>
      <Card title="آخر التمارين">{history.length ? <div className="list">{history.slice(0, 6).map((item) => <div className="list-row" key={item.id}><strong>{item.title}</strong><span>{new Date(item.startedAt).toLocaleDateString('ar-EG')}</span><span>{item.exercises.reduce((sum, entry) => sum + entry.sets.length, 0)} مجموعة</span></div>)}</div> : <EmptyState text="أول جلسة هتكون بداية سجل الأوزان والتقدم."/>}</Card>
    </Page>
  }

  return <Page title={session.title} subtitle="نفّذ بالترتيب. شوف الصورة والشرح قبل أول مجموعة.">
    <div className="stats-grid"><Stat label="الجاهزية عند البداية" value={session.readinessScore == null ? 'غير مسجلة' : `${session.readinessScore}%`}/><Stat label="المكان" value={todayPlace === 'gym' ? 'الجيم' : 'البيت'}/><Stat label="المجموعات المسجلة" value={`${session.exercises.reduce((sum, entry) => sum + entry.sets.length, 0)}`}/></div>

    {session.exercises.map((entry, exerciseIndex) => {
      const exercise = exercises.find((candidate) => candidate.id === entry.exerciseId)
      const prescribed = plan.exercises.find((candidate) => candidate.exerciseId === entry.exerciseId)
      if (!exercise || !prescribed) return null
      const recommendation = getWeightRecommendation(exercise.id, history, { min: prescribed.minReps, max: prescribed.maxReps }, exercise.incrementKg ?? 2.5, exercise.startingWeightGuide)
      const targetComplete = entry.sets.length >= prescribed.sets
      const usesWeight = (exercise.incrementKg ?? 0) > 0
      return <Card key={entry.exerciseId} className={`guided-exercise ${targetComplete ? 'completed' : ''}`}>
        <div className="exercise-heading"><span className="exercise-number">{exerciseIndex + 1}</span><div><h2>{exercise.nameAr}</h2><p>{prescribed.sets} مجموعات · {prescribed.minReps}-{prescribed.maxReps} عدة · راحة {prescribed.restSeconds} ثانية</p></div>{targetComplete && <CheckCircle2 className="complete-icon"/>}</div>

        <div className="exercise-visual-grid"><div><span className="visual-label">{todayPlace === 'gym' ? 'شكل الجهاز أو الأداة' : 'شكل التمرين'}</span><ExerciseVisual exerciseId={exercise.id} mode="equipment"/></div><div><span className="visual-label">وضع البداية والنهاية</span><ExerciseVisual exerciseId={exercise.id} mode="movement"/></div></div>

        {exercise.recognitionTips?.length ? <div className="recognition-box"><strong>إزاي تعرف الجهاز؟</strong><ul>{exercise.recognitionTips.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}

        <div className="coach-weight-box"><span>{usesWeight ? 'الوزن الذي أريدك تبدأ به' : 'طريقة البداية'}</span><strong>{recommendation.title}</strong><p>{recommendation.message}</p></div>

        <details className="technique-guide" open={exerciseIndex === 0}><summary>الطريقة الصحيحة بالتفصيل <ChevronDown size={18}/></summary><div className="technique-columns"><div><h3>نفّذ كده</h3><ol>{exercise.instructions.map((item) => <li key={item}>{item}</li>)}</ol></div><div><h3>ركز على</h3><ul>{exercise.formCues.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>تجنب</h3><ul>{exercise.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div></div><div className="stop-box"><AlertTriangle size={18}/><span>أوقف التمرين إذا ظهر: {exercise.stopSignals.join('، ')}.</span></div></details>
        <p className="exercise-reason"><strong>ليه التمرين ده؟</strong> {prescribed.reason}</p>

        <div className="guided-sets">{entry.sets.map((set, setIndex) => <div className="guided-set" key={set.id}><div className="set-title"><strong>المجموعة {setIndex + 1}</strong><span>الهدف {prescribed.minReps}-{prescribed.maxReps} عدة</span></div><div className={`set-inputs ${usesWeight ? '' : 'bodyweight'}`}>{usesWeight && <label>الوزن كجم<input type="number" min="0" step="0.5" value={set.weightKg} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.id, set.id, 'weightKg', Number(event.target.value))}/></label>}<label>العدات<input type="number" min="1" max="50" value={set.reps} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.id, set.id, 'reps', Number(event.target.value))}/></label><label>الصعوبة 1-10<input type="number" min="1" max="10" value={set.rpe} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.id, set.id, 'rpe', Number(event.target.value))}/></label><label>التكنيك<select value={set.formQuality ?? 'good'} onChange={(event) => updateSet(exercise.id, set.id, 'formQuality', event.target.value as FormQuality)}><option value="good">سليم</option><option value="uncertain">مش متأكد</option><option value="poor">اتلخبط</option></select></label></div><Button variant="secondary" onClick={() => analyze(exercise.id, set.id)}>حلل المجموعة وقلّي أعمل إيه</Button>{set.coachFeedback && <div className="coach-feedback">{set.coachFeedback}</div>}</div>)}</div>
        {entry.sets.length < prescribed.sets ? <Button onClick={() => addSet(exercise.id)}>{entry.sets.length === 0 ? 'ابدأ المجموعة الأولى' : 'أضف المجموعة التالية بالتوجيه الجديد'}</Button> : <div className="exercise-done"><CheckCircle2 size={18}/> خلصت العدد المطلوب لهذا التمرين</div>}
      </Card>
    })}

    <Card title="مؤقت الراحة"><div className="timer">{displayRest}</div><div className="button-row"><Button onClick={() => setRunning(!running)}>{running ? 'إيقاف' : 'بدء'}</Button><Button variant="secondary" onClick={() => { setRest(90); setRunning(false) }}><TimerReset size={18}/> 90 ثانية</Button><Button variant="secondary" onClick={() => { setRest(120); setRunning(false) }}>دقيقتان</Button></div></Card>
    <div className="finish-workout-bar"><Dumbbell size={22}/><div><strong>بعد ما تخلص</strong><span>هحفظ الأداء وأستخدمه عشان أحدد أوزان أو نسخة التمرين في المرة القادمة.</span></div><Button onClick={finish}>إنهاء وحفظ التمرين</Button></div>
  </Page>
}
