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
  setCustomGymTime,
  setGymNow,
  setOutsideHome,
  setInsideHome,
  departForGym,
  enterGym,
  finishGym,
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
  const allEvents = useLiveQuery(() => dayEventRepo.listAll(userId), [userId]) ?? []

  const [goingGym, setGoingGym] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [showGymTime, setShowGymTime] = useState(false)
  const [showMissedSleep, setShowMissedSleep] = useState(false)
  const [missedBedtime, setMissedBedtime] = useState('23:30')
  const [sleepSaveMessage, setSleepSaveMessage] = useState('')
  const [sleepActionMessage, setSleepActionMessage] = useState('')
  const [customGymTime, setCustomGymTimeValue] = useState('18:00')

  const goal = normalizeGoal(rawGoal, userId)
  const preferences = normalizePreferences(rawPreferences, userId)
  const targets = profile ? calculateTargets(profile, goal) : null
  const action = useMemo(() => nextAction(tasks), [tasks])
  const gymTask = tasks.find((task) => task.type === 'gym' && !task.completed)
  const lastEvent = events[events.length - 1]
  const lastSleepEvent = [...allEvents].reverse().find((event) =>
    event.type === 'sleep_started' || event.type === 'sleep_failed' || event.type === 'woke_now'
  )
  const isTryingToSleep = lastSleepEvent?.type === 'sleep_started'
  const lastSleepFailed = lastSleepEvent?.type === 'sleep_failed'
  const lastGymEvent = [...events].reverse().find((event) =>
    event.type === 'gym_departed' || event.type === 'gym_started' || event.type === 'gym_finished'
  )
  const gymStage = lastGymEvent?.type === 'gym_started'
    ? 'in_gym'
    : lastGymEvent?.type === 'gym_departed'
      ? 'on_the_way'
      : lastGymEvent?.type === 'gym_finished'
        ? 'finished'
        : 'idle'
  const lastLocationEvent = [...events].reverse().find((event) =>
    event.type === 'outside_home' || event.type === 'inside_home'
  )
  const isOutsideHome = lastLocationEvent?.type === 'outside_home'
  const availableFoodIds = new Set(available.map((item) => item.foodId))
  const hasJuice = availableFoodIds.has('orange-juice') || availableFoodIds.has('fresh-juice')
  const hasQuickCarb = availableFoodIds.has('banana') || availableFoodIds.has('dates')

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

  async function sleepNow() {
    setSaving(true)
    await startSleepNow(userId)
    setSleepActionMessage('تم تسجيل إنك بدأت تحاول تنام الآن. لو النوم مجاش، اضغط «مقدرتش أنام».')
    setSaving(false)
  }

  async function couldNotSleep() {
    setSaving(true)
    await failedToSleep(userId)
    setSleepActionMessage('تمام، ما حسبناش إنك نمت. خُد 15–20 دقيقة هدوء وبعدين تقدر تضغط «هحاول أنام تاني».')
    setSaving(false)
  }

  async function trySleepAgain() {
    setSaving(true)
    await startSleepNow(userId)
    setSleepActionMessage('بدأنا محاولة نوم جديدة من الوقت الحالي.')
    setSaving(false)
  }

  async function completeTask(task: DailyTask) {
    if (!task.id) return
    await dailyTaskRepo.setCompleted(task.id, !task.completed)
    if (!task.completed && task.type === 'creatine') {
      await creatineRepo.markTaken({ userId, dateKey: today, doseG: preferences.creatineDoseG, takenAt: new Date().toISOString() })
    }
  }


  async function saveCustomGymTime() {
    await setCustomGymTime(userId, customGymTime)
    setShowGymTime(false)
  }

  return (
    <Page title={`أهلاً ${profile?.name ?? ''}`} subtitle="قول لي اللي حصل دلوقتي، وأنا أرتب لك الخطوة الجاية">
      {!isTryingToSleep && (!checkIn ? (
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
      ))}

      <Card className={`sleep-control-card ${isTryingToSleep ? 'sleep-active sleep-minimal' : ''}`}>
        <div className="sleep-control-head">
          <div>
            <span className="eyebrow">النوم</span>
            <h2>{isTryingToSleep ? 'وضع النوم شغال الآن' : lastSleepFailed ? 'النوم ماجاش آخر مرة' : 'جاهز للنوم؟'}</h2>
            <p className="muted">
              {isTryingToSleep
                ? 'أخفينا كل تفاصيل اليوم مؤقتًا. لما تصحى اضغط «أنا صحيت الآن»، ولو النوم مجاش اضغط «مقدرتش أنام».'
                : lastSleepFailed
                  ? 'لما تبقى جاهز جرّب محاولة جديدة، والوقت الجديد هو اللي هيتحسب.'
                  : 'اضغط وقت ما تدخل السرير فعلًا، مش قبلها بساعات.'}
            </p>
          </div>
          <Moon size={34} />
        </div>

        <div className="button-row">
          {!isTryingToSleep && !lastSleepFailed && (
            <Button disabled={saving} onClick={sleepNow}><Moon size={18} /> أنا هنام الآن</Button>
          )}
          {isTryingToSleep && (
            <>
              <Button disabled={saving} onClick={couldNotSleep}><AlarmClock size={18} /> مقدرتش أنام</Button>
              <Button variant="secondary" disabled={saving} onClick={wakeNow}><Sunrise size={18} /> أنا صحيت الآن</Button>
            </>
          )}
          {lastSleepFailed && (
            <>
              <Button disabled={saving} onClick={trySleepAgain}><Moon size={18} /> هحاول أنام تاني</Button>
              <Button variant="secondary" onClick={() => setShowMissedSleep(true)}><Clock3 size={18} /> سجل وقت نومي يدويًا</Button>
            </>
          )}
          {!isTryingToSleep && !lastSleepFailed && (
            <Button variant="secondary" onClick={() => setShowMissedSleep(true)}><Clock3 size={18} /> نسيت أسجل نوم امبارح</Button>
          )}
        </div>
      </Card>

      {sleepActionMessage && (
        <Card className="success-card"><Check size={24} /><div><h2>تحديث النوم</h2><p>{sleepActionMessage}</p></div></Card>
      )}

      {!isTryingToSleep && checkIn && (
        <section className="command-center command-center-pro">
          <div className="command-center-head">
            <div>
              <span className="eyebrow">مدير يومك</span>
              <h2>اعمل الخطوة المناسبة بس</h2>
              <p className="muted">الخيارات بتتغير حسب حالتك، عشان مفيش أزرار ملهاش لازمة أو حاجات مكررة.</p>
            </div>
            <button className="icon-action" onClick={async () => regenerateDailyPlan(userId, today)} title="أعد ترتيب اليوم"><RefreshCw size={19} /></button>
          </div>

          <button className="manager-now-button" onClick={() => setShowWhy(!showWhy)}>
            <span className="manager-now-icon"><Sparkles /></span>
            <span><strong>ماذا أفعل الآن؟</strong><small>أهم خطوة وسببها</small></span>
          </button>

          <div className="context-actions">
            {checkIn.goingGym && gymStage === 'idle' && (
              <button onClick={() => departForGym(userId)}><Dumbbell /><span><strong>رايح الجيم</strong><small>ابدأ رحلة الجيم</small></span></button>
            )}
            {checkIn.goingGym && gymStage === 'on_the_way' && (
              <button onClick={() => enterGym(userId)}><Dumbbell /><span><strong>أنا في الجيم</strong><small>فعّل وضع التمرين</small></span></button>
            )}
            <button
              className={isOutsideHome ? 'active-state' : ''}
              onClick={() => isOutsideHome ? setInsideHome(userId) : setOutsideHome(userId)}
            >
              <House />
              <span>
                <strong>{isOutsideHome ? 'رجعت البيت' : 'أنا بره البيت'}</strong>
                <small>{isOutsideHome ? 'اقفل وضع خارج البيت' : 'فعّل اختيارات مناسبة للخروج'}</small>
              </span>
            </button>
            <button onClick={async () => rescueMessyDay(userId)}><AlarmClock /><span><strong>يومي اتلخبط</strong><small>أعد ترتيب الباقي</small></span></button>
          </div>

          {showWhy && (
            <div className="why-box">
              <strong>{action?.title ?? 'لا توجد خطوة معلقة'}</strong>
              <p>{actionExplanation(action)}</p>
            </div>
          )}
        </section>
      )}

      {!isTryingToSleep && gymStage === 'in_gym' && (
        <section className="gym-live-card">
          <div className="gym-live-head">
            <div>
              <span className="live-dot" />
              <span>أنت في الجيم الآن</span>
            </div>
            <Dumbbell size={26} />
          </div>
          <h2>خليك مركز في التمرين، والموقع يهتم بالتفاصيل الصغيرة</h2>
          <div className="gym-live-tips">
            <div><Waves /><span><strong>المياه</strong><small>خد رشفات منتظمة أثناء التمرين، خصوصًا لو الجو حر أو عرقت كتير.</small></span></div>
            {hasJuice && <div><Utensils /><span><strong>عندك عصير ضمن المتاح</strong><small>لو محتاج طاقة سريعة، اشرب كمية صغيرة بهدوء بدل ما تشرب كمية كبيرة مرة واحدة.</small></span></div>}
            {hasQuickCarb && <div><Utensils /><span><strong>عندك موز أو تمر</strong><small>ممكن تستخدم كمية بسيطة عند الحاجة للطاقة، مش لازم تاكلهم لمجرد إنهم موجودين.</small></span></div>}
            <div><AlarmClock /><span><strong>علامات التوقف</strong><small>لو حسيت بدوخة أو ألم غير طبيعي، اقف وخد راحة وما تكملش بالعافية.</small></span></div>
          </div>
          <Button onClick={() => finishGym(userId)}><Check size={18} /> خلصت الجيم</Button>
        </section>
      )}

      {!isTryingToSleep && sleepSaveMessage && <Card className="success-card"><Check size={24} /><div><h2>تحديث النوم</h2><p>{sleepSaveMessage}</p></div></Card>}

      

      {!isTryingToSleep && checkIn && available.length === 0 && (
        <Card className="attention-card">
          <Apple size={28} /><div><h2>لسه محتاج أعرف الأكل المتاح عندك</h2><p>اختار الموجود في البيت والكميات التقريبية، وبعدها هقولك تاكل إيه وفي أي وقت.</p></div>
          <Link to="/food"><Button>حدد الأكل المتاح</Button></Link>
        </Card>
      )}

      {!isTryingToSleep && checkIn && action && (
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

      {!isTryingToSleep && checkIn && !action && tasks.length > 0 && <Card><EmptyState text="خلصت خطوات اليوم المسجلة. التقدم هيتحسب تلقائيًا من اللي سجلته." /></Card>}

      {targets && (
        <div className="stats-grid">
          <Stat label="هدفك الأنسب حاليًا" value={goalLabels[goal.primary]} hint="يتغير تلقائيًا عند تحديث بياناتك" />
          <Stat label="سعرات اليوم التقديرية" value={`${targets.calories} سعر`} hint="تقدير يتغير مع الوزن والهدف" />
          <Stat label="البروتين المستهدف" value={`${targets.proteinG} جم`} />
          <Stat label="المياه المستهدفة" value={`${targets.waterMl} مل`} />
          <Stat label="الكرياتين اليوم" value={preferences.creatineEnabled ? (creatineLog ? 'تم أخذه' : `${preferences.creatineDoseG} جم`) : 'غير مفعل'} />
        </div>
      )}

      {!isTryingToSleep && checkIn?.goingGym && (
        <div className="compact-gym-time">
          <div><Dumbbell size={18} /><span>لو ناوي تروح الجيم في ساعة معينة</span></div>
          <button onClick={() => setShowGymTime(true)}>حدد الساعة</button>
        </div>
      )}

      {!isTryingToSleep && checkIn && tasks.length > 0 && (
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

    </Page>
  )
}
