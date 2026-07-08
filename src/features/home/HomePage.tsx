import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlarmClock,
  Apple,
  Check,
  Clock3,
  Dumbbell,
  House,
  Moon,
  Pill,
  RefreshCw,
  Sparkles,
  Sunrise,
  Utensils,
  Waves,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { appSettings } from '../../data/db'
import {
  availableFoodRepo,
  checkInRepo,
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  dayReviewRepo,
  goalRepo,
  preferencesRepo,
  profileRepo,
} from '../../data/repositories'
import {
  calculateTargets,
  dateKey,
  formatTimeAr,
  goalLabels,
  normalizeGoal,
  normalizePreferences,
  timeToMinutes,
} from '../../domain/dailyCoach'
import type { DailyTask } from '../../domain/models'
import {
  actionExplanation,
  failedToSleep,
  recordMissedSleepTime,
  rescueMessyDay,
  returnedFromGym,
  setCustomGymTime,
  setGymNow,
  setOutsideHome,
  snoozeTaskAndReplan,
  startDayNow,
  startSleepNow,
  unavailableTaskAndReplan,
} from '../../services/dayManagerService'
import { regenerateDailyPlan } from '../../services/planService'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

const taskIcons = {
  water: Waves,
  meal: Utensils,
  gym: Dumbbell,
  creatine: Pill,
  sleep: Moon,
  checkin: Sunrise,
} as const

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function nextAction(tasks: DailyTask[]): DailyTask | undefined {
  const pending = tasks.filter((task) => !task.completed)
  if (!pending.length) return undefined
  const current = currentMinutes()
  return pending.find((task) => task.timeMinutes >= current - 60) ?? pending[0]
}

export default function HomePage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const rawPreferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const checkIn = useLiveQuery(() => checkInRepo.get(userId, today), [userId, today])
  const tasks = useLiveQuery(() => dailyTaskRepo.list(userId, today), [userId, today]) ?? []
  const available = useLiveQuery(() => availableFoodRepo.list(userId, today), [userId, today]) ?? []
  const creatineLog = useLiveQuery(() => creatineRepo.get(userId, today), [userId, today])
  const events = useLiveQuery(() => dayEventRepo.list(userId, today), [userId, today]) ?? []
  const review = useLiveQuery(() => dayReviewRepo.get(userId, today), [userId, today])

  const [goingGym, setGoingGym] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showGymTime, setShowGymTime] = useState(false)
  const [showMissedSleep, setShowMissedSleep] = useState(false)
  const [missedBedtime, setMissedBedtime] = useState('23:30')
  const [sleepSaveMessage, setSleepSaveMessage] = useState('')
  const [customGymTime, setCustomGymTimeValue] = useState('18:00')
  const [foodAdherence, setFoodAdherence] = useState(7)
  const [waterAdherence, setWaterAdherence] = useState(7)
  const [energy, setEnergy] = useState(7)
  const [reviewGym, setReviewGym] = useState(checkIn?.goingGym ?? false)

  const goal = normalizeGoal(rawGoal, userId)
  const preferences = normalizePreferences(rawPreferences, userId)
  const targets = profile ? calculateTargets(profile, goal) : null
  const action = useMemo(() => nextAction(tasks), [tasks])
  const gymTask = tasks.find((task) => task.type === 'gym' && !task.completed)
  const lastEvent = events[events.length - 1]

  async function wakeNow() {
    setSaving(true)
    await startDayNow(userId, goingGym)
    setSaving(false)
  }

  async function saveMissedSleepTime() {
    setSaving(true)
    const sleepHours = await recordMissedSleepTime(userId, missedBedtime, goingGym)
    setSaving(false)
    if (sleepHours) {
      setSleepSaveMessage(`تم تسجيل نومك تقريبًا ${sleepHours} ساعة وإعادة ترتيب اليوم.`)
      setShowMissedSleep(false)
    } else {
      setSleepSaveMessage('الوقت غير منطقي بالنسبة لوقت الاستيقاظ. اختار وقت نوم أقرب للصحيح.')
    }
  }

  async function completeTask(task: DailyTask) {
    if (!task.id) return
    await dailyTaskRepo.setCompleted(task.id, !task.completed)
    if (!task.completed && task.type === 'creatine') {
      await creatineRepo.markTaken({ userId, dateKey: today, doseG: preferences.creatineDoseG, takenAt: new Date().toISOString() })
    }
  }

  async function saveReview() {
    await dayReviewRepo.save({
      userId,
      dateKey: today,
      foodAdherence,
      waterAdherence,
      energy,
      wentGym: reviewGym,
      creatineTaken: Boolean(creatineLog),
      createdAt: new Date().toISOString(),
    })
    setShowReview(false)
  }

  async function saveCustomGymTime() {
    await setCustomGymTime(userId, customGymTime)
    setShowGymTime(false)
  }

  return (
    <Page title={`أهلاً ${profile?.name ?? ''}`} subtitle="قول لي اللي حصل دلوقتي، وأنا أرتب لك الخطوة الجاية">
      {!checkIn ? (
        <Card className="daily-checkin-card">
          <span className="eyebrow">بداية اليوم</span>
          <h2>ما تكتبش ساعة الاستيقاظ</h2>
          <p className="muted">أول ما تصحى اضغط الزر، والموقع ياخد الوقت الحالي تلقائيًا ويبدأ اليوم.</p>
          <h3>النهارده غالبًا هتروح الجيم؟</h3>
          <div className="decision-grid">
            <button className={`decision-card ${goingGym ? 'selected' : ''}`} onClick={() => setGoingGym(true)}><Dumbbell /><strong>آه، رايح الجيم</strong><span>الموقع يقترح الوقت المناسب</span></button>
            <button className={`decision-card ${!goingGym ? 'selected' : ''}`} onClick={() => setGoingGym(false)}><Moon /><strong>لا، مفيش جيم</strong><span>رتب لي الأكل والمياه والنوم</span></button>
          </div>
          <div className="button-row">
            <Button disabled={saving} onClick={wakeNow}><Sunrise size={18} /> {saving ? 'ببدأ يومك...' : 'أنا صحيت الآن'}</Button>
            <Button variant="secondary" onClick={() => setShowMissedSleep(true)}><Moon size={18} /> صحيت ونسيت أسجل نومي</Button>
          </div>
        </Card>
      ) : (
        <div className="day-summary-bar">
          <div><Sunrise size={18} /><span>صحيت {formatTimeAr(timeToMinutes(checkIn.wakeTime))}</span></div>
          {checkIn.sleepHours && <div><Moon size={18} /><span>نوم تقريبي {checkIn.sleepHours} ساعة</span></div>}
          <div>{checkIn.goingGym ? <><Dumbbell size={18} /><span>يوم جيم</span></> : <><Moon size={18} /><span>يوم بدون جيم</span></>}</div>
        </div>
      )}

      {checkIn && (
        <section className="command-center">
          <div className="command-center-head">
            <div><span className="eyebrow">مدير يومك</span><h2>إيه اللي حصل دلوقتي؟</h2></div>
            <Button variant="secondary" onClick={async () => regenerateDailyPlan(userId, today)}><RefreshCw size={17} /> أعد ترتيب اليوم</Button>
          </div>
          <div className="quick-command-grid">
            <button onClick={() => setShowWhy(!showWhy)}><Sparkles /><strong>ماذا أفعل الآن؟</strong><span>اعرف أهم خطوة وسببها</span></button>
            <button onClick={async () => setGymNow(userId)}><Dumbbell /><strong>أنا رايح الجيم الآن</strong><span>عدّل اليوم حول الجيم</span></button>
            <button onClick={async () => returnedFromGym(userId)}><Check /><strong>رجعت من الجيم</strong><span>مياه + أكل + كرياتين</span></button>
            <button onClick={async () => rescueMessyDay(userId)}><AlarmClock /><strong>يومي اتلخبط</strong><span>أنقذ باقي اليوم</span></button>
            <button onClick={async () => setOutsideHome(userId)}><House /><strong>أنا بره البيت</strong><span>اختيار عملي من المتاح</span></button>
            <button onClick={async () => startSleepNow(userId)}><Moon /><strong>أنا هنام الآن</strong><span>سجّل بداية النوم</span></button>
            <button onClick={() => setShowMissedSleep(true)}><Clock3 /><strong>نسيت أسجل نوم امبارح</strong><span>أدخل وقت النوم يدويًا</span></button>
            <button onClick={async () => failedToSleep(userId)}><AlarmClock /><strong>مقدرتش أنام</strong><span>عدّل محاولة النوم من غير ضغط</span></button>
            <button onClick={() => setShowReview(true)}><Check /><strong>هخلص يومي</strong><span>تقييم سريع في 10 ثوانٍ</span></button>
          </div>
          {showWhy && <div className="why-box"><strong>{action?.title ?? 'لا توجد خطوة معلقة'}</strong><p>{actionExplanation(action)}</p></div>}
        </section>
      )}

      {sleepSaveMessage && <Card className="success-card"><Check size={24} /><div><h2>تحديث النوم</h2><p>{sleepSaveMessage}</p></div></Card>}

      {checkIn?.goingGym && gymTask && (
        <Card className="gym-time-card">
          <div className="gym-time-main"><Dumbbell size={30} /><div><span className="eyebrow">ميعاد الجيم المقترح</span><h2>{formatTimeAr(gymTask.timeMinutes)}</h2><p>الموقع اختاره حسب وقت صحوك وترتيب الوجبات.</p></div></div>
          <div className="button-row"><Button onClick={() => setGymNow(userId)}>هروح دلوقتي</Button><Button variant="secondary" onClick={() => setShowGymTime(true)}>مش هقدر، أحدد وقت</Button></div>
        </Card>
      )}

      {checkIn && available.length === 0 && (
        <Card className="attention-card">
          <Apple size={28} /><div><h2>لسه محتاج أعرف الأكل المتاح عندك</h2><p>اختار الموجود في البيت والكميات التقريبية، وبعدها هقولك تاكل إيه وفي أي وقت.</p></div>
          <Link to="/food"><Button>حدد الأكل المتاح</Button></Link>
        </Card>
      )}

      {checkIn && action && (
        <section className="next-action-card">
          <div className="next-action-top"><span className="live-dot" /> الخطوة الأهم الآن</div>
          <div className="next-action-main">
            <div className={`task-icon ${action.type}`}>{(() => { const Icon = taskIcons[action.type]; return <Icon /> })()}</div>
            <div><span className="time-label"><Clock3 size={15} /> {formatTimeAr(action.timeMinutes)}</span><h2>{action.title}</h2><p>{action.details}</p></div>
          </div>
          <div className="task-actions">
            <Button onClick={() => completeTask(action)}><Check size={18} /> تم</Button>
            <Button variant="secondary" onClick={() => snoozeTaskAndReplan(action, 30)}><AlarmClock size={18} /> أجّل 30 دقيقة</Button>
            <Button variant="secondary" onClick={() => unavailableTaskAndReplan(userId, action)}>غير متاح</Button>
          </div>
        </section>
      )}

      {checkIn && !action && tasks.length > 0 && <Card><EmptyState text="خلصت خطوات اليوم المسجلة. ممتاز — قيّم يومك قبل النوم." /></Card>}

      {targets && (
        <div className="stats-grid">
          <Stat label="هدفك الأنسب حاليًا" value={goalLabels[goal.primary]} hint="يتغير تلقائيًا عند تحديث بياناتك" />
          <Stat label="سعرات اليوم التقديرية" value={`${targets.calories} سعر`} hint="تقدير يتغير مع الوزن والهدف" />
          <Stat label="البروتين المستهدف" value={`${targets.proteinG} جم`} />
          <Stat label="المياه المستهدفة" value={`${targets.waterMl} مل`} />
          <Stat label="الكرياتين اليوم" value={preferences.creatineEnabled ? (creatineLog ? 'تم أخذه' : `${preferences.creatineDoseG} جم`) : 'غير مفعل'} />
        </div>
      )}

      {checkIn && tasks.length > 0 && (
        <Card title="خطة يومك بالترتيب">
          <div className="timeline">
            {tasks.map((task) => {
              const Icon = taskIcons[task.type]
              return (
                <div key={task.id} className={`timeline-row ${task.completed ? 'completed' : ''}`}>
                  <span className={`timeline-icon ${task.type}`}><Icon size={18} /></span>
                  <span className="timeline-time">{formatTimeAr(task.timeMinutes)}</span>
                  <span className="timeline-copy"><strong>{task.title}</strong><small>{task.details}</small></span>
                  <div className="timeline-mini-actions">
                    {!task.completed && <button onClick={() => completeTask(task)}>تم</button>}
                    {!task.completed && <button onClick={() => snoozeTaskAndReplan(task, 30)}>تأجيل</button>}
                    {task.completed && <span><Check size={16} /></span>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {lastEvent && (
        <Card title="آخر تحديث في يومك">
          <p className="muted">{lastEvent.type === 'woke_now' ? 'تم تسجيل إنك صحيت.' : lastEvent.type === 'sleep_started' ? 'تم تسجيل إنك بدأت تحاول تنام.' : lastEvent.type === 'sleep_failed' ? 'سجلنا إن النوم مجاش، وتمت إضافة محاولة أهدأ.' : lastEvent.type === 'gym_now' ? 'تم تعديل اليوم لأنك رايح الجيم الآن.' : lastEvent.type === 'returned_gym' ? 'تم ترتيب ما بعد الجيم.' : lastEvent.type === 'day_messy' ? 'تم إنقاذ باقي اليوم.' : 'تم تفعيل وضع خارج البيت.'}</p>
        </Card>
      )}

      {review && <Card className="success-card"><Check size={24} /><div><h2>تقييم اليوم محفوظ</h2><p>طاقة {review.energy}/10 · أكل {review.foodAdherence}/10 · مياه {review.waterAdherence}/10</p></div></Card>}

      {showGymTime && (
        <div className="modal-backdrop" onClick={() => setShowGymTime(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>هتقدر تروح الجيم إمتى؟</h2>
            <p className="muted">اكتب الوقت اللي يناسبك، والموقع يعيد ترتيب الأكل والمياه والكرياتين حواليه.</p>
            <label>ميعاد الجيم<input type="time" value={customGymTime} onChange={(event) => setCustomGymTimeValue(event.target.value)} /></label>
            <div className="button-row"><Button onClick={saveCustomGymTime}>ثبت الوقت وأعد الترتيب</Button><Button variant="secondary" onClick={() => setShowGymTime(false)}>إلغاء</Button></div>
          </div>
        </div>
      )}

      {showMissedSleep && (
        <div className="modal-backdrop" onClick={() => setShowMissedSleep(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">تصحيح النوم</span>
            <h2>نمت تقريبًا الساعة كام؟</h2>
            <p className="muted">مثال: لو صحيت الصبح ونمت الساعة 2 بعد منتصف الليل، اختار 02:00. ولو نمت 11 بالليل اختار 23:00.</p>
            <label>وقت النوم التقريبي<input type="time" value={missedBedtime} onChange={(event) => setMissedBedtime(event.target.value)} /></label>
            <p className="safety-note">الموقع هيحسب المدة لحد وقت «أنا صحيت الآن» المسجل، ويحسن ترتيب اليوم. تقدر تستخدمها كمان بعد ما بدأت يومك.</p>
            <div className="button-row">
              <Button disabled={saving} onClick={saveMissedSleepTime}>{saving ? 'بسجل النوم...' : 'سجل وقت نومي'}</Button>
              <Button variant="secondary" onClick={() => setShowMissedSleep(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {showReview && (
        <div className="modal-backdrop" onClick={() => setShowReview(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>تقييم سريع لليوم</h2>
            <label>التزام الأكل: {foodAdherence}/10<input type="range" min="1" max="10" value={foodAdherence} onChange={(event) => setFoodAdherence(Number(event.target.value))} /></label>
            <label>التزام المياه: {waterAdherence}/10<input type="range" min="1" max="10" value={waterAdherence} onChange={(event) => setWaterAdherence(Number(event.target.value))} /></label>
            <label>طاقتك اليوم: {energy}/10<input type="range" min="1" max="10" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /></label>
            <label className="toggle-row"><input type="checkbox" checked={reviewGym} onChange={(event) => setReviewGym(event.target.checked)} /><span>ذهبت للجيم اليوم</span></label>
            <div className="button-row"><Button onClick={saveReview}>حفظ التقييم</Button><Button variant="secondary" onClick={() => setShowReview(false)}>إلغاء</Button></div>
          </div>
        </div>
      )}
    </Page>
  )
}
