import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Heart, Home, MapPin, Search } from 'lucide-react'
import { appSettings } from '../../data/db'
import { favoriteRepo } from '../../data/repositories'
import { exercises } from '../../data/seeds'
import ExerciseVisual from '../../components/ExerciseVisual'
import { Card, EmptyState, Page } from '../../components/UI'

type Scope = 'all' | 'gym' | 'home' | 'favorites'

export default function ExercisesPage() {
  const userId = appSettings.activeUserId!
  const favorites = useLiveQuery(() => favoriteRepo.list(userId), [userId]) ?? []
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('الكل')
  const [scope, setScope] = useState<Scope>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const favoriteIds = new Set(favorites.map((item) => item.exerciseId))
  const muscles = ['الكل', ...Array.from(new Set(exercises.map((item) => item.muscle)))]
  const list = exercises.filter((item) => {
    const matchesScope = scope === 'all' || scope === 'favorites' && favoriteIds.has(item.id) || scope === 'gym' && item.places.includes('gym') || scope === 'home' && item.places.includes('home')
    const matchesMuscle = muscle === 'الكل' || item.muscle === muscle
    const normalized = `${item.nameAr} ${item.muscle} ${item.equipment}`
    return matchesScope && matchesMuscle && normalized.includes(query.trim())
  })
  const grouped = useMemo(() => list.reduce<Record<string, typeof exercises>>((acc, exercise) => { (acc[exercise.muscle] ??= []).push(exercise); return acc }, {}), [list])
  const detail = exercises.find((item) => item.id === selected)

  return <Page title="مكتبة التمارين" subtitle="منظمة حسب المكان والعضلة، ومع كل تمرين صورة وشرح للمبتدئ.">
    <Card className="library-toolbar">
      <div className="search-box"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم التمرين أو الجهاز"/></div>
      <div className="scope-tabs">
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>الكل</button>
        <button className={scope === 'gym' ? 'active' : ''} onClick={() => setScope('gym')}><MapPin size={16}/> الجيم</button>
        <button className={scope === 'home' ? 'active' : ''} onClick={() => setScope('home')}><Home size={16}/> البيت</button>
        <button className={scope === 'favorites' ? 'active' : ''} onClick={() => setScope('favorites')}><Heart size={16}/> المفضلة</button>
      </div>
      <div className="chips muscle-filters">{muscles.map((item) => <button key={item} className={muscle === item ? 'chip active' : 'chip'} onClick={() => setMuscle(item)}>{item}</button>)}</div>
      <div className="library-result-count">{list.length} تمرين مطابق</div>
    </Card>

    {Object.keys(grouped).length ? Object.entries(grouped).map(([group, groupExercises]) => <section className="exercise-section" key={group}>
      <div className="section-heading"><h2>{group}</h2><span>{groupExercises.length} تمارين</span></div>
      <div className="organized-exercise-grid">{groupExercises.map((exercise) => <article className="organized-exercise-card" key={exercise.id}>
        <ExerciseVisual exerciseId={exercise.id} compact/>
        <div className="exercise-card-body"><div className="exercise-card-title"><div><h3>{exercise.nameAr}</h3><p>{exercise.equipment}</p></div><button className="icon-btn" onClick={() => favoriteRepo.toggle(userId, exercise.id)} aria-label="إضافة للمفضلة"><Heart fill={favoriteIds.has(exercise.id) ? 'currentColor' : 'none'}/></button></div><div className="exercise-tags"><span>{exercise.difficulty}</span>{exercise.places.map((place) => <span key={place}>{place === 'gym' ? 'الجيم' : 'البيت'}</span>)}</div><button className="open-exercise-button" onClick={() => setSelected(exercise.id)}>شوف الصورة والطريقة الصحيحة</button></div>
      </article>)}</div>
    </section>) : <EmptyState text="مفيش تمارين مطابقة للبحث أو الفلاتر الحالية."/>}

    {detail && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal exercise-modal visual-modal" onClick={(event) => event.stopPropagation()}>
      <span className="eyebrow">دليل التمرين</span><h2>{detail.nameAr}</h2><p>{detail.muscle} · {detail.equipment} · {detail.difficulty}</p>
      <div className="exercise-visual-grid"><div><span className="visual-label">شكل الجهاز أو الأداة</span><ExerciseVisual exerciseId={detail.id} mode="equipment"/></div><div><span className="visual-label">البداية والنهاية</span><ExerciseVisual exerciseId={detail.id} mode="movement"/></div></div>
      {detail.recognitionTips?.length ? <div className="recognition-box"><strong>إزاي تعرف الجهاز أو تجهز الأداة؟</strong><ul>{detail.recognitionTips.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      <div className="coach-weight-box"><span>أول مرة</span><strong>{(detail.incrementKg ?? 0) > 0 ? 'ابدأ باختبار خفيف' : 'ابدأ بالنسخة الأسهل'}</strong><p>{detail.startingWeightGuide}</p></div>
      <div className="technique-columns"><div><h3>اعمل كده</h3><ol>{detail.instructions.map((item) => <li key={item}>{item}</li>)}</ol></div><div><h3>علامات إن التكنيك سليم</h3><ul>{detail.formCues.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>أخطاء شائعة</h3><ul>{detail.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
      <div className="stop-box"><AlertTriangle size={18}/><span>أوقف التمرين عند: {detail.stopSignals.join('، ')}.</span></div>
      <button className="btn secondary" onClick={() => setSelected(null)}>فهمت</button>
    </div></div>}
  </Page>
}
