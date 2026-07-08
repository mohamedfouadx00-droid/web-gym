import { useMemo, useState, type FocusEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { appSettings, db } from '../../data/db'
import { goalRepo, preferencesRepo, profileRepo } from '../../data/repositories'
import { recommendGoal } from '../../domain/dailyCoach'
import type { ActivityLevel, GymPeriod, TrainingExperience, UserProfile, WeightTrend } from '../../domain/models'
import { Button, Card } from '../../components/UI'

const selectAll = (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
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

  const profileDraft = useMemo<UserProfile>(() => ({
    userId: 'preview',
    name: name.trim(),
    birthYear: Number(birthYear) || 2000,
    heightCm: Number(height) || 175,
    currentWeightKg: Number(weight) || 75,
    waistCm: Number(waist) || undefined,
    activityLevel: activity,
    trainingExperience,
    weightTrend,
  }), [name, birthYear, height, weight, waist, activity, trainingExperience, weightTrend])

  const recommendation = useMemo(() => recommendGoal(profileDraft), [profileDraft])

  async function finish() {
    const userId = crypto.randomUUID()
    const finalProfile: UserProfile = { ...profileDraft, userId }
    const finalRecommendation = recommendGoal(finalProfile)
    await db.users.add({ id: userId, createdAt: new Date().toISOString() })
    await profileRepo.save(finalProfile)
    await goalRepo.save({ userId, primary: finalRecommendation.goal, targetWeightKg: Number(weight) })
    await preferencesRepo.save({
      userId,
      targetWakeTime: '08:00',
      desiredSleepHours: 8,
      gymPeriod,
      creatineEnabled,
      creatineDoseG: Number(creatineDose),
    })
    appSettings.activeUserId = userId
    appSettings.onboardingCompleted = true
    navigate('/', { replace: true })
  }

  return (
    <div className="onboarding">
      <div className="onboarding-panel">
        <div className="logo-mark">G</div>
        <div className="step-dots">{[0, 1, 2, 3].map((index) => <span key={index} className={index <= step ? 'active' : ''} />)}</div>

        {step === 0 && (
          <div className="welcome-block">
            <span className="eyebrow">مساعد يومك</span>
            <h1>إنت تقول صحيت إمتى وإيه الأكل المتاح، وهو يرتّب لك باقي اليوم.</h1>
            <p>مياه، أكل، ميعاد الجيم، الكرياتين، وميعاد النوم — وكمان يختار لك الهدف الأنسب بدل ما تحتار بين تضخيم أو تنشيف.</p>
            <Button onClick={() => setStep(1)}>ابدأ الإعداد</Button>
          </div>
        )}

        {step === 1 && (
          <Card title="خلّيني أفهم جسمك الأول">
            <label>اسمك<input value={name} onChange={(event) => setName(event.target.value)} placeholder="اكتب اسمك" /></label>
            <div className="form-grid">
              <label>سنة الميلاد<input inputMode="numeric" value={birthYear} onFocus={selectAll} onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
              <label>الطول (سم)<input inputMode="numeric" value={height} onFocus={selectAll} onChange={(event) => setHeight(event.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
              <label>الوزن الحالي (كجم)<input inputMode="decimal" value={weight} onFocus={selectAll} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} /></label>
              <label>محيط الخصر (سم) — اختياري<input inputMode="decimal" value={waist} onFocus={selectAll} onChange={(event) => setWaist(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} placeholder="اتركه فارغًا لو مش عارفه" /><small className="field-hint">الموقع هيختار هدفًا مبدئيًا من طولك ووزنك وسنك ونشاطك وخبرتك. تقدر تضيف الخصر لاحقًا لتحسين الدقة.</small></label>
            </div>
            <label>نشاطك خارج الجيم
              <select value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}>
                <option value="low">قليل — أغلب اليوم قاعد</option>
                <option value="moderate">متوسط — حركة يومية عادية</option>
                <option value="high">عالي — شغل أو حركة كثيرة</option>
              </select>
            </label>
            <label>خبرتك في الجيم
              <select value={trainingExperience} onChange={(event) => setTrainingExperience(event.target.value as TrainingExperience)}>
                <option value="new">جديد — لسه بادئ أو أقل من 6 شهور</option>
                <option value="some">عندي خبرة بسيطة</option>
                <option value="experienced">منتظم من فترة طويلة</option>
              </select>
            </label>
            <label>وزنك في آخر شهرين غالبًا
              <select value={weightTrend} onChange={(event) => setWeightTrend(event.target.value as WeightTrend)}>
                <option value="losing">بينزل</option>
                <option value="stable">ثابت تقريبًا</option>
                <option value="gaining">بيزيد</option>
              </select>
            </label>
            <Button disabled={!name.trim() || !weight || !height || !birthYear} onClick={() => setStep(2)}>حلل بياناتي</Button>
          </Card>
        )}

        {step === 2 && (
          <Card title="الهدف الأنسب لك مبدئيًا">
            <div className="recommendation-card">
              <span className="eyebrow">اختيار التطبيق</span>
              <h2>{recommendation.title}</h2>
              <p>{recommendation.summary}</p>
              <div className="recommendation-metrics">
                <span>مؤشر الوزن بالنسبة للطول: {recommendation.bmi}</span>
                {recommendation.waistToHeight !== undefined && <span>نسبة الخصر للطول: {recommendation.waistToHeight}</span>}
              </div>
              <ul className="reason-list">{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
            <p className="safety-note">دي توصية تنظيمية مبدئية وليست تشخيصًا طبيًا. لو عندك مرض مزمن أو تعليمات علاجية خاصة، اتبع طبيبك.</p>
            <Button onClick={() => setStep(3)}>تمام، رتّب يومي على الهدف ده</Button>
          </Card>
        )}

        {step === 3 && (
          <Card title="خلّي التطبيق يرتّب يومك">
            <div className="sleep-advice-card">
              <div className="sleep-advice-icon"><span>8h</span></div>
              <div>
                <span className="eyebrow">نصيحة نوم — مش التزام</span>
                <h3>حاول تقرّب من 8 ساعات لما تقدر</h3>
                <p>إنت مش محتاج تحدد هتصحى إمتى. التطبيق هيحسب نومك من زر «أنا هنام الآن» و«أنا صحيت الآن». لو يومك مضغوط، 6 ساعات أفضل من نوم أقل، لكن التطبيق مش هيفرض عليك رقم.</p>
              </div>
            </div>
            <h3>التطبيق يفضّل يحدد الجيم إمتى؟</h3>
            <div className="chips">
              <button className={gymPeriod === 'auto' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('auto')}>هو يختار</button>
              <button className={gymPeriod === 'afternoon' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('afternoon')}>العصر</button>
              <button className={gymPeriod === 'evening' ? 'chip active' : 'chip'} onClick={() => setGymPeriod('evening')}>المساء</button>
            </div>
            <label className="toggle-row"><input type="checkbox" checked={creatineEnabled} onChange={(event) => setCreatineEnabled(event.target.checked)} /><span>أنا باخد كرياتين</span></label>
            {creatineEnabled && <label>الجرعة اليومية المسجلة عندك (جم)<input inputMode="decimal" value={creatineDose} onFocus={selectAll} onChange={(event) => setCreatineDose(event.target.value.replace(/[^0-9.]/g, '').slice(0, 4))} /></label>}
            <Button onClick={finish}>ابدأ تنظيم يومي</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
