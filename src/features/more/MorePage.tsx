import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { appSettings, db } from '../../data/db'
import { goalRepo, preferencesRepo, profileRepo, scheduleRepo, supplementRepo } from '../../data/repositories'
import type { GoalType } from '../../domain/models'
import { Button, Card, Page } from '../../components/UI'

const goalLabels: Record<GoalType, string> = {
  muscle: 'بناء العضلات', fat_loss: 'خسارة الدهون', recomp: 'إعادة تكوين الجسم',
  strength: 'زيادة القوة', fitness: 'تحسين اللياقة', maintain: 'الحفاظ على الوزن',
}

export default function MorePage() {
  const userId = appSettings.activeUserId!
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const goal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const preferences = useLiveQuery(() => preferencesRepo.get(userId), [userId])
  const events = useLiveQuery(() => scheduleRepo.list(userId), [userId]) ?? []
  const supplements = useLiveQuery(() => supplementRepo.list(userId), [userId]) ?? []
  const [eventTitle, setEventTitle] = useState('')
  const [target, setTarget] = useState(100)
  const [barWeight, setBarWeight] = useState(20)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState(0)
  const [height, setHeight] = useState(0)
  const [goalType, setGoalType] = useState<GoalType>('muscle')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setWeight(profile.currentWeightKg)
      setHeight(profile.heightCm)
    }
    if (goal) setGoalType(goal.primary)
  }, [profile, goal])

  const perSide = Math.max(0, (target - barWeight) / 2)
  let remain = perSide
  const plates = [20, 15, 10, 5, 2.5, 1.25]
  const result = plates.flatMap((plate) => {
    const count = Math.floor(remain / plate)
    remain -= count * plate
    return count ? [`${count} × ${plate}`] : []
  })

  async function saveProfile() {
    if (!profile || !goal) return
    await profileRepo.save({ ...profile, name: name.trim(), currentWeightKg: weight, heightCm: height })
    await goalRepo.save({ ...goal, primary: goalType })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  async function exportData() {
    const data = {
      users: await db.users.toArray(), profiles: await db.profiles.toArray(), goals: await db.goals.toArray(),
      preferences: await db.preferences.toArray(), weightLogs: await db.weightLogs.toArray(), recoveryLogs: await db.recoveryLogs.toArray(),
      favoriteExercises: await db.favoriteExercises.toArray(), workoutSessions: await db.workoutSessions.toArray(),
      waterLogs: await db.waterLogs.toArray(), mealLogs: await db.mealLogs.toArray(), inventory: await db.inventory.toArray(),
      supplementLogs: await db.supplementLogs.toArray(), measurements: await db.measurements.toArray(), schedule: await db.schedule.toArray(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'gym-backup.json'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return (
    <Page title="المزيد" subtitle="عدّل بياناتك، وشوف الأدوات المساعدة.">
      <Card title="بياناتي التي يعتمد عليها التوجيه">
        <div className="form-grid">
          <label>الاسم<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>الوزن الحالي<input type="number" onFocus={(event) => event.currentTarget.select()} step="0.1" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
          <label>الطول<input type="number" onFocus={(event) => event.currentTarget.select()} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
          <label>الهدف<select value={goalType} onChange={(event) => setGoalType(event.target.value as GoalType)}>{Object.entries(goalLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <Button onClick={saveProfile}>حفظ التعديلات</Button>
        {saved && <div className="success-note">تم الحفظ. القرارات القادمة ستستخدم البيانات الجديدة.</div>}
      </Card>

      <Card title="ملخص إعدادات التمرين">
        <div className="list">
          <div className="list-row"><span>الهدف</span><strong>{goal ? goalLabels[goal.primary] : '—'}</strong></div>
          <div className="list-row"><span>أيام التمرين</span><strong>{preferences?.workoutDays.join('، ') ?? '—'}</strong></div>
          <div className="list-row"><span>المكان</span><strong>{preferences?.trainingPlace === 'gym' ? 'الجيم' : preferences?.trainingPlace === 'home' ? 'البيت' : 'الجيم والبيت'}</strong></div>
          <div className="list-row"><span>مدة الجلسة</span><strong>{preferences ? `${preferences.workoutDurationMin} دقيقة` : '—'}</strong></div>
        </div>
      </Card>

      <Card title="الجدول">
        <div className="button-row"><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="حدث جديد" /><Button disabled={!eventTitle.trim()} onClick={async () => { await scheduleRepo.add({ userId, title: eventTitle, type: 'custom', dateTime: new Date().toISOString() }); setEventTitle('') }}>إضافة</Button></div>
        <div className="list">{events.slice(0, 6).map((event) => <div className="list-row" key={event.id}><span>{event.title}</span><small>{new Date(event.dateTime).toLocaleString('ar-EG')}</small></div>)}</div>
      </Card>

      <Card title="المكملات">
        <Button onClick={() => supplementRepo.add({ userId, name: 'كرياتين', dose: '5 جم', date: new Date().toISOString(), taken: true })}>تسجيل كرياتين اليوم</Button>
        <p className="muted">عدد التسجيلات: {supplements.length}</p>
      </Card>

      <Card title="حاسبة أوزان البار">
        <div className="form-grid"><label>الوزن المستهدف<input type="number" onFocus={(event) => event.currentTarget.select()} value={target} onChange={(event) => setTarget(Number(event.target.value))} /></label><label>وزن البار<input type="number" onFocus={(event) => event.currentTarget.select()} value={barWeight} onChange={(event) => setBarWeight(Number(event.target.value))} /></label></div>
        <p>على كل جانب: <strong>{result.length ? result.join(' + ') : 'لا توجد أوزان مطلوبة'}</strong></p>
      </Card>

      <Card title="النسخ الاحتياطي"><Button onClick={exportData}>تصدير بياناتي</Button></Card>
    </Page>
  )
}
