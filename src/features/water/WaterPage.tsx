import { useLiveQuery } from 'dexie-react-hooks'
import { Droplets, Plus } from 'lucide-react'
import { appSettings } from '../../data/db'
import { dailyTaskRepo, goalRepo, profileRepo, waterRepo } from '../../data/repositories'
import { calculateTargets, dateKey, formatTimeAr, normalizeGoal } from '../../domain/dailyCoach'
import { Button, Card, EmptyState, Page, ProgressBar, Stat } from '../../components/UI'

export default function WaterPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const rawGoal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const logs = useLiveQuery(() => waterRepo.list(userId), [userId]) ?? []
  const tasks = useLiveQuery(() => dailyTaskRepo.list(userId, today), [userId, today]) ?? []
  const goal = normalizeGoal(rawGoal, userId)
  const target = profile ? calculateTargets(profile, goal).waterMl : 3000
  const todayLogs = logs.filter((log) => dateKey(new Date(log.date)) === today)
  const total = todayLogs.reduce((sum, log) => sum + log.amountMl, 0)
  const nextWater = tasks.find((task) => task.type === 'water' && !task.completed)

  async function add(amountMl: number) {
    await waterRepo.add({ userId, amountMl, date: new Date().toISOString() })
  }

  return (
    <Page title="مياهي" subtitle="التطبيق موزّع المياه داخل يومك، وهنا تسجل اللي شربته">
      <section className="water-hero">
        <Droplets size={42} />
        <div><span>شربت النهارده</span><strong>{total} مل</strong><small>من هدف تقريبي {target} مل</small></div>
      </section>
      <Card>
        <ProgressBar value={total} max={target} />
        <div className="stats-grid"><Stat label="المتبقي" value={`${Math.max(0, target - total)} مل`} /><Stat label="نسبة الإنجاز" value={`${Math.min(100, Math.round((total / target) * 100))}%`} /></div>
      </Card>
      {nextWater && <Card className="attention-card"><Droplets size={26} /><div><h2>الدفعة الجاية</h2><p>{formatTimeAr(nextWater.timeMinutes)} — {nextWater.details}</p></div></Card>}
      <Card title="سجّل بسرعة">
        <div className="quick-water-grid">
          {[250, 400, 500, 750].map((amount) => <Button key={amount} variant="secondary" onClick={() => add(amount)}><Plus size={16} /> {amount} مل</Button>)}
        </div>
      </Card>
      <Card title="سجل اليوم">
        {todayLogs.length ? <div className="list">{todayLogs.slice().reverse().map((log) => <div className="list-row" key={log.id}><strong>{log.amountMl} مل</strong><span>{new Date(log.date).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</span></div>)}</div> : <EmptyState text="لسه ما سجلتش مياه النهارده." />}
      </Card>
    </Page>
  )
}
