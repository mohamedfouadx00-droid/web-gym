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
  ShoppingBasket,
  Sparkles,
  Sunrise,
  Utensils,
  Waves,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { appSettings } from '../../data/db'
import { foodCatalog } from '../../data/foodCatalog'
import {
  availableFoodRepo,
  checkInRepo,
  creatineRepo,
  dailyTaskRepo,
  dayEventRepo,
  goalRepo,
  mealPlanRepo,
  preferencesRepo,
  profileRepo,
  waterRepo,
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
import type { DailyTask, MealPlanItem } from '../../domain/models'
import {
  actionExplanation,
  departForGym,
  enterGym,
  failedToSleep,
  finishGym,
  recordMissedSleepTime,
  replaceUnavailableMealIngredient,
  rescueMessyDay,
  setCustomGymTime,
  setInsideHome,
  setOutsideHome,
  snoozeTaskAndReplan,
  startDayNow,
  startSleepNow,
} from '../../services/dayManagerService'
import { regenerateDailyPlan } from '../../services/planService'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

const taskIcons = {
  water: Waves,
  meal: Utensils,
  gym: Dumbbell,
  creatine: Pill,
  checkin: Sunrise,
} as const

const supermarketSuggestions = [
  'زبادي عالي البروتين + موزة',
  'تونة + عيش أو توست',
  'لبن + موز',
  'جبنة قريش أو جبنة بيضاء + عيش',
  'زبادي عادي + أي فاكهة متاحة',
]

function currentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function selectSmartAction(tasks: DailyTask[], gymTask?: DailyTask) {
  const pending = tasks.filter((task) => !task.completed)
  if (!pending.length) return undefined

  const now = currentMinutes()
  const gymDelta = gymTask ? gymTask.timeMinutes - now : undefined

  if (gymTask && gymDelta !== undefined && gymDelta >= 0 && gymDelta <= 90) {
    const preGym = pending.find((task) =>
      (task.type === 'meal' && task.title.includes('سناك')) ||
      (task.type === 'water' && task.timeMinutes <= gymTask.timeMinutes)
    )
    if (preGym) return preGym
  }

  const due = pending.filter((task) => task.timeMinutes <= now + 30)
  if (due.length) {
    const priority = { water: 1, creatine: 2, meal: 3, gym: 4, checkin: 5 } as const
    return [...due].sort((a, b) => priority[a.type] - priority[b.type])[0]
  }

  return [...pending].sort((a, b) => a.timeMinutes - b.timeMinutes)[0]
}

function gymStageFromEvents(events: Awaited<ReturnType<typeof dayEventRepo.list>>) {
  const lastGym = [...events].reverse().find((event) =>
    event.type === 'gym_departed' ||
    event.type === 'gym_started' ||
    event.type === 'gym_finished'
  )

  return lastGym?.type === 'gym_started'
    ? 'in_gym'
    : lastGym?.type === 'gym_departed'
      ? 'on_the_way'
      : lastGym?.type === 'gym_finished'
        ? 'finished'
        : 'idle'
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
  const meals = useLiveQuery(() => mealPlanRepo.list(userId, today), [userId, today]) ?? []
  const creatineLog = useLiveQuery(() => creatineRepo.get(userId, today), [userId, today])
  const events = useLiveQuery(() => dayEventRepo.list(userId, today), [userId, today]) ?? []
  const allEvents = useLiveQuery(() => dayEventRepo.listAll(userId), [userId]) ?? []

  const [goingGym, setGoingGym] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [showGymTime, setShowGymTime] = useState(false)
  const [showMissedSleep, setShowMissedSleep] = useState(false)
  const [missedBedtime, setMissedBedtime] = useState('23:30')
  const [sleepMessage, setSleepMessage] = useState('')
  const [customGymTime, setCustomGymTimeValue] = useState('18:00')
  const [gymDrink, setGymDrink] = useState<'water' | 'juice'>('water')
  const [ingredientMeal, setIngredientMeal] = useState<MealPlanItem | null>(null)

  const goal = normalizeGoal(rawGoal, userId)
  const preferences = normalizePreferences(rawPreferences, userId)
  const targets = profile ? calculateTargets(profile, goal) : null

  const gymStage = gymStageFromEvents(events)
  const lastLocation = [...events].reverse().find((event) =>
    event.type === 'outside_home' || event.type === 'inside_home'
  )
  const isOutsideHome = lastLocation?.type === 'outside_home'

  const lastSleepEvent = [...allEvents].reverse().find((event) =>
    event.type === 'sleep_started' ||
    event.type === 'sleep_failed' ||
    event.type === 'woke_now'
  )
  const isTryingToSleep = lastSleepEvent?.type === 'sleep_started'
  const lastSleepFailed = lastSleepEvent?.type === 'sleep_failed'

  const gymTask = tasks.find((task) => task.type === 'gym' && !task.completed)
  const action = useMemo(
    () => selectSmartAction(tasks, gymTask),
    [tasks, gymTask],
  )

  const actionMeal = action?.mealKey
    ? meals.find((meal) => meal.mealKey === action.mealKey)
    : undefined

  const masturbationLoggedToday = events.some((event) => event.type === 'masturbation_logged')

  async function wakeNow() {
    setSaving(true)
    await startDayNow(userId, goingGym)
    setSaving(false)
  }

  async function saveMissedSleepTime() {
    setSaving(true)
    const hours = await recordMissedSleepTime(userId, missedBedtime, goingGym)
    setSaving(false)

    if (hours) {
      setSleepMessage(`تم تسجيل نومك تقريبًا ${hours} ساعة.`)
      setShowMissedSleep(false)
    } else {
      setSleepMessage('الوقت غير منطقي. اختار وقت نوم أقرب للصحيح.')
    }
  }

  async function sleepNow() {
    await startSleepNow(userId)
    setSleepMessage('بدأت محاولة النوم. لو النوم مجاش اضغط «مقدرتش أنام».')
  }

  async function couldNotSleep() {
    await failedToSleep(userId)
    setSleepMessage('ما حسبناش إنك نمت. خُد هدوء شوية وبعدها جرّب تاني.')
  }

  async function trySleepAgain() {
    await startSleepNow(userId)
    setSleepMessage('بدأت محاولة نوم جديدة من الوقت الحالي.')
  }

  async function completeTask(task: DailyTask) {
    if (!task.id || task.completed) return

    if (task.type === 'water' && task.waterAmountMl) {
      await waterRepo.addFromTaskOnce({
        userId,
        amountMl: task.waterAmountMl,
        date: new Date().toISOString(),
        sourceTaskId: task.id,
      })
    }

    if (task.type === 'creatine') {
      await creatineRepo.markTaken({
        userId,
        dateKey: today,
        doseG: preferences.creatineDoseG,
        takenAt: new Date().toISOString(),
      })
    }

    await dailyTaskRepo.setCompleted(task.id, true)
  }

  async function chooseUnavailableIngredient(foodId: string) {
    if (!ingredientMeal || !action) return
    await replaceUnavailableMealIngredient(userId, action, foodId)
    setIngredientMeal(null)
  }

  async function saveGymTime() {
    await setCustomGymTime(userId, customGymTime)
    setShowGymTime(false)
  }

  return (
    <Page title={`أهلاً ${profile?.name ?? ''}`} subtitle="كل زر بيغيّر الحالة، وباقي الموقع يتظبط عليها">
      {!isTryingToSleep && !checkIn && (
        <Card className="daily-checkin-card">
          <span className="eyebrow">بداية اليوم</span>
          <h2>أول ما تصحى ابدأ من هنا</h2>
          <p className="muted">الموقع ياخد الوقت الحالي تلقائيًا. مفيش سؤال عن ميعاد استيقاظ مستهدف.</p>

          <h3>النهارده غالبًا هتروح الجيم؟</h3>
          <div className="decision-grid">
            <button
              className={`decision-card ${goingGym ? 'selected' : ''}`}
              onClick={() => setGoingGym(true)}
            >
              <Dumbbell />
              <strong>آه، رايح الجيم</strong>
              <span>الموقع يقترح الوقت المناسب</span>
            </button>

            <button
              className={`decision-card ${!goingGym ? 'selected' : ''}`}
              onClick={() => setGoingGym(false)}
            >
              <Moon />
              <strong>لا، مفيش جيم</strong>
              <span>رتب لي الأكل والمياه</span>
            </button>
          </div>

          <div className="button-row">
            <Button disabled={saving} onClick={wakeNow}>
              <Sunrise size={18} />
              {saving ? 'ببدأ يومك...' : 'أنا صحيت الآن'}
            </Button>

            <Button variant="secondary" onClick={() => setShowMissedSleep(true)}>
              <Moon size={18} />
              صحيت ونسيت أسجل نومي
            </Button>
          </div>
        </Card>
      )}

      {!isTryingToSleep && checkIn && (
        <div className="day-summary-bar">
          <div><Sunrise size={18} /><span>صحيت {formatTimeAr(timeToMinutes(checkIn.wakeTime))}</span></div>
          {checkIn.sleepHours && <div><Moon size={18} /><span>نوم {checkIn.sleepHours} ساعة تقريبًا</span></div>}
          <div>{checkIn.goingGym ? <><Dumbbell size={18} /><span>يوم جيم</span></> : <><Moon size={18} /><span>بدون جيم</span></>}</div>
        </div>
      )}

      <Card className={`sleep-control-card ${isTryingToSleep ? 'sleep-active sleep-minimal' : ''}`}>
        <div className="sleep-control-head">
          <div>
            <span className="eyebrow">النوم</span>
            <h2>
              {isTryingToSleep
                ? 'وضع النوم شغال'
                : lastSleepFailed
                  ? 'النوم ماجاش آخر مرة'
                  : 'جاهز للنوم؟'}
            </h2>
            <p className="muted">
              {isTryingToSleep
                ? 'لما تصحى اضغط «أنا صحيت الآن». لو النوم مجاش اضغط «مقدرتش أنام».'
                : lastSleepFailed
                  ? 'لما تبقى جاهز ابدأ محاولة جديدة.'
                  : 'اضغط وقت ما تدخل تنام فعلًا.'}
            </p>
          </div>
          <Moon size={30} />
        </div>

        <div className="button-row">
          {!isTryingToSleep && !lastSleepFailed && (
            <Button onClick={sleepNow}><Moon size={18} /> أنا هنام الآن</Button>
          )}

          {isTryingToSleep && (
            <>
              <Button onClick={couldNotSleep}><AlarmClock size={18} /> مقدرتش أنام</Button>
              <Button variant="secondary" onClick={wakeNow}><Sunrise size={18} /> أنا صحيت الآن</Button>
            </>
          )}

          {lastSleepFailed && (
            <Button onClick={trySleepAgain}><Moon size={18} /> هحاول أنام تاني</Button>
          )}
        </div>
      </Card>

      {sleepMessage && (
        <Card className="success-card">
          <Check size={24} />
          <div><h2>تحديث النوم</h2><p>{sleepMessage}</p></div>
        </Card>
      )}

      {!isTryingToSleep && checkIn && gymStage !== 'in_gym' && (
        <section className="command-center command-center-pro">
          <div className="command-center-head">
            <div>
              <span className="eyebrow">مدير يومك</span>
              <h2>الخطوات المناسبة لحالتك بس</h2>
            </div>

            <button
              className="icon-action"
              onClick={() => regenerateDailyPlan(userId, today)}
              title="أعد ترتيب اليوم"
            >
              <RefreshCw size={19} />
            </button>
          </div>

          <button className="manager-now-button" onClick={() => setShowWhy(!showWhy)}>
            <span className="manager-now-icon"><Sparkles /></span>
            <span><strong>ماذا أفعل الآن؟</strong><small>أهم خطوة وسببها</small></span>
          </button>

          <div className="context-actions">
            {checkIn.goingGym && gymStage === 'idle' && (
              <button onClick={() => departForGym(userId)}>
                <Dumbbell />
                <span><strong>رايح الجيم</strong><small>ابدأ رحلة الجيم</small></span>
              </button>
            )}

            {checkIn.goingGym && gymStage === 'on_the_way' && (
              <button onClick={() => enterGym(userId)}>
                <Dumbbell />
                <span><strong>أنا في الجيم</strong><small>فعّل وضع الجيم</small></span>
              </button>
            )}

            <button
              className={isOutsideHome ? 'active-state' : ''}
              onClick={() => isOutsideHome ? setInsideHome(userId) : setOutsideHome(userId)}
            >
              <House />
              <span>
                <strong>{isOutsideHome ? 'رجعت البيت' : 'أنا بره البيت'}</strong>
                <small>{isOutsideHome ? 'ارجع لخطة البيت' : 'فعّل اقتراحات السوبر ماركت'}</small>
              </span>
            </button>

            <button onClick={() => rescueMessyDay(userId)}>
              <AlarmClock />
              <span><strong>يومي اتلخبط</strong><small>أعد ترتيب الباقي</small></span>
            </button>
          </div>

          {showWhy && (
            <div className="why-box">
              <strong>{action?.title ?? 'لا توجد خطوة معلقة'}</strong>
              <p>{actionExplanation(action)}</p>
            </div>
          )}
        </section>
      )}

      {!isTryingToSleep && isOutsideHome && (
        <Card title="اقتراحات من السوبر ماركت" className="supermarket-card">
          <div className="supermarket-head">
            <ShoppingBasket size={26} />
            <p>مش لازم تختار إن الحاجة موجودة عندك. دور على أول اقتراح تلاقيه.</p>
          </div>
          <ol className="supermarket-list">
            {supermarketSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          </ol>
        </Card>
      )}

      {!isTryingToSleep && gymStage === 'in_gym' && (
        <section className="gym-live-card">
          <div className="gym-live-head">
            <div><span className="live-dot" /><span>أنت في الجيم الآن</span></div>
            <Dumbbell size={26} />
          </div>

          <h2>وضع الجيم شغال — باقي الموقع اتظبط على الحالة دي</h2>

          <div className="gym-drink-choice">
            <span>معاك إيه؟</span>
            <div>
              <button className={gymDrink === 'water' ? 'active' : ''} onClick={() => setGymDrink('water')}>
                <Waves size={17} /> مياه
              </button>
              <button className={gymDrink === 'juice' ? 'active' : ''} onClick={() => setGymDrink('juice')}>
                <Utensils size={17} /> عصير
              </button>
            </div>
          </div>

          <div className="gym-live-tips">
            {gymDrink === 'water' ? (
              <div>
                <Waves />
                <span>
                  <strong>اشرب على رشفات</strong>
                  <small>خد رشفات بين المجموعات، وما تشربش كمية كبيرة مرة واحدة.</small>
                </span>
              </div>
            ) : (
              <>
                <div>
                  <Utensils />
                  <span>
                    <strong>اشرب العصير على مراحل</strong>
                    <small>كمية صغيرة على مراحل، مش الزجاجة كلها مرة واحدة.</small>
                  </span>
                </div>
                <div>
                  <Waves />
                  <span>
                    <strong>لو فيه مياه خُد منها برضه</strong>
                    <small>المياه تفضل الأساس أثناء التمرين.</small>
                  </span>
                </div>
              </>
            )}

            {profile?.smoker && (
              <div>
                <AlarmClock />
                <span>
                  <strong>بما إنك مسجل إنك مدخن</strong>
                  <small>ما تتجاهلش ضيق النفس أو الدوخة، وخد راحة لو احتجت.</small>
                </span>
              </div>
            )}
          </div>

          <Button onClick={() => finishGym(userId)}>
            <Check size={18} />
            خلصت الجيم
          </Button>
        </section>
      )}

      {!isTryingToSleep && checkIn && available.length === 0 && !isOutsideHome && (
        <Card className="attention-card">
          <Apple size={28} />
          <div>
            <h2>لسه محتاج أعرف الأكل المتاح</h2>
            <p>اختار الموجود فقط — من غير كميات.</p>
          </div>
          <Link to="/food"><Button>حدد الأكل المتاح</Button></Link>
        </Card>
      )}

      {!isTryingToSleep && gymStage !== 'in_gym' && checkIn && action && (
        <section className="next-action-card">
          <div className="next-action-top">
            <span className="live-dot" />
            الخطوة الأهم الآن
          </div>

          <div className="next-action-main">
            <div className={`task-icon ${action.type}`}>
              {(() => {
                const Icon = taskIcons[action.type]
                return <Icon />
              })()}
            </div>

            <div>
              <span className="time-label"><Clock3 size={15} /> {formatTimeAr(action.timeMinutes)}</span>
              <h2>{action.title}</h2>
              <p>{action.details}</p>
            </div>
          </div>

          <div className="task-actions">
            <Button onClick={() => completeTask(action)}><Check size={18} /> تم</Button>
            <Button variant="secondary" onClick={() => snoozeTaskAndReplan(action, 30)}>
              <AlarmClock size={18} /> أجّل 30 دقيقة
            </Button>

            {action.type === 'meal' && actionMeal && !isOutsideHome && (
              <Button variant="secondary" onClick={() => setIngredientMeal(actionMeal)}>
                مكون مش متاح
              </Button>
            )}
          </div>
        </section>
      )}

      {masturbationLoggedToday && !isTryingToSleep && (
        <Card className="habit-context-card">
          <p>
            تم تسجيل العادة اليوم. مفيش وجبة خاصة مطلوبة؛ كمل خطتك طبيعي،
            وخلي قرار الجيم حسب طاقتك الفعلية.
          </p>
        </Card>
      )}

      {targets && (
        <div className="stats-grid">
          <Stat label="هدفك الحالي" value={goalLabels[goal.primary]} />
          <Stat label="السعرات التقديرية" value={`${targets.calories} سعر`} />
          <Stat label="البروتين المستهدف" value={`${targets.proteinG} جم`} />
          <Stat label="المياه المستهدفة" value={`${targets.waterMl} مل`} />
          <Stat
            label="الكرياتين اليوم"
            value={preferences.creatineEnabled ? (creatineLog ? 'تم أخذه' : `${preferences.creatineDoseG} جم`) : 'غير مفعل'}
          />
        </div>
      )}

      {!isTryingToSleep && checkIn?.goingGym && gymStage === 'idle' && (
        <div className="compact-gym-time">
          <div><Dumbbell size={18} /><span>لو ناوي تروح في ساعة معينة</span></div>
          <button onClick={() => setShowGymTime(true)}>حدد الساعة</button>
        </div>
      )}

      {!isTryingToSleep && checkIn && tasks.length > 0 && gymStage !== 'in_gym' && (
        <Card title="خطة يومك بالترتيب">
          <div className="timeline">
            {tasks.map((task) => {
              const Icon = taskIcons[task.type]

              return (
                <div key={task.id} className={`timeline-row ${task.completed ? 'completed' : ''}`}>
                  <span className={`timeline-icon ${task.type}`}><Icon size={18} /></span>
                  <span className="timeline-time">{formatTimeAr(task.timeMinutes)}</span>
                  <span className="timeline-copy">
                    <strong>{task.title}</strong>
                    <small>{task.details}</small>
                  </span>

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
            <p className="muted">الموقع يعيد ترتيب الخطوات حوالين الوقت اللي تختاره.</p>
            <label>
              ميعاد الجيم
              <input
                type="time"
                value={customGymTime}
                onChange={(event) => setCustomGymTimeValue(event.target.value)}
              />
            </label>

            <div className="button-row">
              <Button onClick={saveGymTime}>ثبت الوقت</Button>
              <Button variant="secondary" onClick={() => setShowGymTime(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {showMissedSleep && (
        <div className="modal-backdrop" onClick={() => setShowMissedSleep(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">تصحيح النوم</span>
            <h2>نمت تقريبًا الساعة كام؟</h2>
            <p className="muted">الخيار ده موجود في الصحيان فقط.</p>

            <label>
              وقت النوم التقريبي
              <input
                type="time"
                value={missedBedtime}
                onChange={(event) => setMissedBedtime(event.target.value)}
              />
            </label>

            <div className="button-row">
              <Button disabled={saving} onClick={saveMissedSleepTime}>
                {saving ? 'بسجل...' : 'سجل وقت نومي'}
              </Button>
              <Button variant="secondary" onClick={() => setShowMissedSleep(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {ingredientMeal && (
        <div className="modal-backdrop" onClick={() => setIngredientMeal(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>إيه المكون اللي مش متاح دلوقتي؟</h2>
            <p className="muted">
              هنشيله من الوجبة، ونسيب باقي المكونات. ولو فيه بديل من نفس النوع هنبدله تلقائيًا.
            </p>

            <div className="ingredient-choice-list">
              {ingredientMeal.foodIds.map((foodId) => {
                const food = foodCatalog.find((item) => item.id === foodId)
                if (!food) return null

                return (
                  <button key={foodId} onClick={() => chooseUnavailableIngredient(foodId)}>
                    <strong>{food.nameAr}</strong>
                    <span>مش متاح عندي دلوقتي</span>
                  </button>
                )
              })}
            </div>

            <Button variant="secondary" onClick={() => setIngredientMeal(null)}>إلغاء</Button>
          </div>
        </div>
      )}

      {!action && checkIn && tasks.length > 0 && !isTryingToSleep && gymStage !== 'in_gym' && (
        <Card><EmptyState text="مفيش خطوة معلقة دلوقتي." /></Card>
      )}
    </Page>
  )
}
