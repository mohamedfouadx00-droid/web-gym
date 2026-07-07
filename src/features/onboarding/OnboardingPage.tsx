import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appSettings, db } from '../../data/db'
import { goalRepo, preferencesRepo, profileRepo } from '../../data/repositories'
import type { ActivityLevel, ExperienceLevel, GoalType, UserPreferences } from '../../domain/models'
import { Button, Card } from '../../components/UI'

const goalLabels: Record<GoalType, string> = {
  muscle: 'بناء العضلات',
  fat_loss: 'خسارة الدهون',
  recomp: 'إعادة تكوين الجسم',
  strength: 'زيادة القوة',
  fitness: 'تحسين اللياقة',
  maintain: 'الحفاظ على الوزن',
}
const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const healthOptions = [
  'ألم في الصدر مع المجهود',
  'دوخة شديدة أو إغماء',
  'ألم شديد أو إصابة بالمفاصل',
  'مشكلة قلبية مشخصة',
]

export default function OnboardingPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState(2000)
  const [height, setHeight] = useState(175)
  const [weight, setWeight] = useState(75)
  const [experience, setExperience] = useState<ExperienceLevel>('beginner')
  const [activity, setActivity] = useState<ActivityLevel>('moderate')
  const [goal, setGoal] = useState<GoalType>('muscle')
  const [workoutDays, setWorkoutDays] = useState<string[]>(['السبت', 'الاثنين', 'الأربعاء'])
  const [equipment, setEquipment] = useState<string[]>(['أجهزة', 'دمبل', 'كابل'])
  const [place, setPlace] = useState<UserPreferences['trainingPlace']>('gym')
  const [duration, setDuration] = useState(60)
  const [time, setTime] = useState('18:00')
  const [budget, setBudget] = useState<UserPreferences['budgetLevel']>('medium')
  const [cookingTime, setCookingTime] = useState(30)
  const [healthFlags, setHealthFlags] = useState<string[]>([])

  const toggle = (value: string, list: string[], setter: (value: string[]) => void) =>
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

  async function finish() {
    const userId = crypto.randomUUID()
    await db.users.add({ id: userId, createdAt: new Date().toISOString() })
    await profileRepo.save({
      userId,
      name: name.trim(),
      birthYear,
      heightCm: height,
      currentWeightKg: weight,
      experience,
      activityLevel: activity,
      healthFlags,
    })
    await goalRepo.save({ userId, primary: goal, pace: 'moderate', priority: 1, targetWeightKg: weight })
    await preferencesRepo.save({
      userId,
      workoutDays,
      restDays: days.filter((day) => !workoutDays.includes(day)),
      equipment,
      trainingPlace: place,
      workoutDurationMin: duration,
      preferredWorkoutTime: time,
      supplementsEnabled: [],
      foodPreferences: [],
      dislikedFoods: [],
      cookingTimeMin: cookingTime,
      budgetLevel: budget,
    })
    appSettings.activeUserId = userId
    appSettings.onboardingCompleted = true
    nav('/', { replace: true })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-panel">
        <div className="logo-mark">G</div>
        <div className="step-dots">{[0, 1, 2, 3, 4].map((item) => <span key={item} className={item <= step ? 'active' : ''} />)}</div>

        {step === 0 && (
          <>
            <span className="eyebrow">مش هتدخل الجيم لوحدك</span>
            <h1>أنا اللي هقولك تعمل إيه النهارده</h1>
            <p>هنبدأ من الصفر: تمرينك، ترتيب التمارين، اختيار الوزن، الراحة، وأكلك. أنت تسجّل اللي حصل وأنا أقرر الخطوة التالية.</p>
            <div className="coach-preview">
              <div><strong>1</strong><span>أفهم جسمك وهدفك</span></div>
              <div><strong>2</strong><span>أجهز خطة اليوم</span></div>
              <div><strong>3</strong><span>أضبط الوزن بعد كل مجموعة</span></div>
            </div>
            <Button onClick={() => setStep(1)}>ابدأ توجيهي خطوة بخطوة</Button>
          </>
        )}

        {step === 1 && (
          <Card title="أعرفك الأول">
            <label>اسمك<input value={name} onChange={(event) => setName(event.target.value)} placeholder="اكتب اسمك" /></label>
            <div className="form-grid">
              <label>سنة الميلاد<input type="number" onFocus={(event) => event.currentTarget.select()} value={birthYear} onChange={(event) => setBirthYear(Number(event.target.value))} /></label>
              <label>الطول (سم)<input type="number" onFocus={(event) => event.currentTarget.select()} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
              <label>الوزن الحالي (كجم)<input type="number" onFocus={(event) => event.currentTarget.select()} value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
            </div>
            <h3>خبرتك في الجيم</h3>
            <div className="option-grid three">
              <button className={`choice ${experience === 'beginner' ? 'selected' : ''}`} onClick={() => setExperience('beginner')}>جديد تمامًا</button>
              <button className={`choice ${experience === 'intermediate' ? 'selected' : ''}`} onClick={() => setExperience('intermediate')}>عندي خبرة بسيطة</button>
              <button className={`choice ${experience === 'advanced' ? 'selected' : ''}`} onClick={() => setExperience('advanced')}>متقدم</button>
            </div>
            <h3>نشاطك خارج الجيم</h3>
            <div className="option-grid three">
              <button className={`choice ${activity === 'low' ? 'selected' : ''}`} onClick={() => setActivity('low')}>قليل الحركة</button>
              <button className={`choice ${activity === 'moderate' ? 'selected' : ''}`} onClick={() => setActivity('moderate')}>متوسط</button>
              <button className={`choice ${activity === 'high' ? 'selected' : ''}`} onClick={() => setActivity('high')}>نشط</button>
            </div>
            <Button disabled={!name.trim()} onClick={() => setStep(2)}>التالي</Button>
          </Card>
        )}

        {step === 2 && (
          <Card title="أنا هبني الخطة على هدفك">
            <div className="option-grid">{Object.entries(goalLabels).map(([key, label]) => <button key={key} className={`choice ${goal === key ? 'selected' : ''}`} onClick={() => setGoal(key as GoalType)}>{label}</button>)}</div>
            <Button onClick={() => setStep(3)}>التالي</Button>
          </Card>
        )}

        {step === 3 && (
          <Card title="إمتى وفين هتتمرن؟">
            <h3>الأيام المتاحة فعلًا</h3>
            <div className="chips">{days.map((day) => <button key={day} className={workoutDays.includes(day) ? 'chip active' : 'chip'} onClick={() => toggle(day, workoutDays, setWorkoutDays)}>{day}</button>)}</div>
            <h3>مكان التدريب</h3>
            <div className="chips">
              <button className={place === 'gym' ? 'chip active' : 'chip'} onClick={() => setPlace('gym')}>الجيم</button>
              <button className={place === 'home' ? 'chip active' : 'chip'} onClick={() => setPlace('home')}>البيت</button>
              <button className={place === 'both' ? 'chip active' : 'chip'} onClick={() => setPlace('both')}>الاثنان</button>
            </div>
            <h3>المعدات المتاحة</h3>
            <div className="chips">{['أجهزة', 'دمبل', 'بار', 'كابل', 'وزن الجسم'].map((item) => <button key={item} className={equipment.includes(item) ? 'chip active' : 'chip'} onClick={() => toggle(item, equipment, setEquipment)}>{item}</button>)}</div>
            <div className="form-grid">
              <label>مدة التمرين<input type="number" onFocus={(event) => event.currentTarget.select()} min="30" max="120" step="10" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
              <label>وقت التمرين المفضل<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            </div>
            <Button disabled={!workoutDays.length} onClick={() => setStep(4)}>التالي</Button>
          </Card>
        )}

        {step === 4 && (
          <Card title="آخر حاجتين عشان أوجهك صح">
            <h3>الأكل والوقت</h3>
            <div className="form-grid">
              <label>وقت الطبخ المتاح بالدقائق<input type="number" onFocus={(event) => event.currentTarget.select()} min="0" max="120" value={cookingTime} onChange={(event) => setCookingTime(Number(event.target.value))} /></label>
              <label>ميزانية الأكل<select value={budget} onChange={(event) => setBudget(event.target.value as UserPreferences['budgetLevel'])}><option value="low">اقتصادية</option><option value="medium">متوسطة</option><option value="high">مرنة</option></select></label>
            </div>
            <h3>هل عندك أي من التالي؟</h3>
            <p className="muted">الإجابة هنا للسلامة فقط، مش للتشخيص.</p>
            <div className="health-list">{healthOptions.map((item) => <label className="health-option" key={item}><input type="checkbox" checked={healthFlags.includes(item)} onChange={() => toggle(item, healthFlags, setHealthFlags)} /><span>{item}</span></label>)}</div>
            {healthFlags.length > 0 && <div className="safety-note">بما إنك اخترت عرضًا صحيًا مهمًا، التطبيق هيفضل محافظ في التوجيه. قبل برنامج جديد أو مجهود قوي، الأفضل مراجعة طبيب أو متخصص مؤهل.</div>}
            <Button onClick={finish}>جهّز أول يوم لي</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
