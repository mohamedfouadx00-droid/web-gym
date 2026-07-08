import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChefHat, Search, Sparkles } from 'lucide-react'
import { appSettings } from '../../data/db'
import { availableFoodRepo, checkInRepo, mealPlanRepo } from '../../data/repositories'
import { foodCatalog } from '../../data/foodCatalog'
import { getAvailableSpecialRecipes } from '../../data/specialRecipes'
import { dateKey, formatTimeAr } from '../../domain/dailyCoach'
import type { FoodCategory } from '../../domain/models'
import { regenerateDailyPlan } from '../../services/planService'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

const categories: Array<{ id: FoodCategory | 'all'; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'protein', label: 'بروتين' },
  { id: 'carb', label: 'نشويات' },
  { id: 'dairy', label: 'ألبان' },
  { id: 'fruit', label: 'فاكهة' },
  { id: 'fat', label: 'دهون' },
  { id: 'vegetable', label: 'خضار' },
]

interface FoodDraft {
  quantity: string
  unit: string
}

export default function FoodPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const rows = useLiveQuery(() => availableFoodRepo.list(userId, today), [userId, today]) ?? []
  const checkIn = useLiveQuery(() => checkInRepo.get(userId, today), [userId, today])
  const meals = useLiveQuery(() => mealPlanRepo.list(userId, today), [userId, today]) ?? []

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, FoodDraft>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(new Set(rows.map((row) => row.foodId)))
    const next: Record<string, FoodDraft> = {}
    rows.forEach((row) => {
      next[row.foodId] = { quantity: String(row.quantity || 1), unit: row.unit || 'حصة' }
    })
    setDrafts(next)
  }, [rows])

  const visibleFoods = useMemo(() => foodCatalog.filter((food) => {
    const matchesSearch = food.nameAr.includes(query.trim())
    const matchesCategory = category === 'all' || food.category === category
    return matchesSearch && matchesCategory
  }), [query, category])

  const specialRecipes = useMemo(() => getAvailableSpecialRecipes(Array.from(selected)), [selected])

  function defaultUnit(foodId: string) {
    const food = foodCatalog.find((item) => item.id === foodId)
    if (!food) return 'حصة'
    if (food.category === 'fruit') return 'ثمرة'
    if (food.category === 'dairy') return 'كوب'
    return 'حصة'
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setDrafts((items) => ({ ...items, [id]: items[id] ?? { quantity: '', unit: defaultUnit(id) } }))
      }
      return next
    })
  }

  function updateDraft(id: string, patch: Partial<FoodDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { quantity: '', unit: defaultUnit(id) }), ...patch },
    }))
  }

  async function saveAndBuild() {
    setSaving(true)
    const items = Array.from(selected).map((foodId) => ({
      foodId,
      quantity: Math.max(0.1, Number(drafts[foodId]?.quantity) || 1),
      unit: drafts[foodId]?.unit || defaultUnit(foodId),
    }))
    await availableFoodRepo.setItems(userId, today, items)
    if (checkIn) await regenerateDailyPlan(userId, today)
    setSaving(false)
  }

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0)
  const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0)

  return (
    <Page title="أكلي النهارده" subtitle="قول لي الموجود عندك والكميات التقريبية، وأنا أبني اليوم من الواقع">
      {!checkIn && <Card className="attention-card"><div><h2>ابدأ من صفحة اليوم أولًا</h2><p>اضغط «أنا صحيت الآن»، وبعدها ارجع اختار الأكل المتاح.</p></div></Card>}

      <Card title="إيه الموجود عندك؟">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن أكل" /></div>
        <div className="chips">{categories.map((item) => <button key={item.id} className={category === item.id ? 'chip active' : 'chip'} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>

        <div className="food-select-grid">
          {visibleFoods.map((food) => {
            const active = selected.has(food.id)
            const draft = drafts[food.id] ?? { quantity: '', unit: defaultUnit(food.id) }
            return (
              <article key={food.id} className={`food-select-card quantity-card ${active ? 'selected' : ''}`}>
                <button className="food-card-main" onClick={() => toggle(food.id)}>
                  <span className="food-check">{active ? <Check size={16} /> : ''}</span>
                  <strong>{food.nameAr}</strong>
                  <span>{food.servingLabel}</span>
                  <small>{food.calories} سعر · {food.protein} جم بروتين</small>
                </button>
                {active && (
                  <div className="food-quantity-row">
                    <label>الكمية<input inputMode="decimal" value={draft.quantity} placeholder="اكتب الكمية" onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateDraft(food.id, { quantity: event.target.value.replace(/[^0-9.]/g, '').slice(0, 7) })} /></label>
                    <label>الوحدة<input value={draft.unit} onChange={(event) => updateDraft(food.id, { unit: event.target.value })} /></label>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div className="sticky-action-row">
          <span>اخترت {selected.size} أصناف</span>
          <Button disabled={saving || selected.size === 0} onClick={saveAndBuild}><Sparkles size={17} /> {saving ? 'ببني يومك...' : 'احفظ وابني أكلي'}</Button>
        </div>
      </Card>

      {specialRecipes.length > 0 && (
        <Card title="وجبات اسبيشيال من الموجود عندك">
          <p className="muted">الوجبات دي بتظهر فقط لما المكونات الأساسية تكون عندك.</p>
          <div className="special-recipes-grid">
            {specialRecipes.map((recipe) => (
              <article key={recipe.id} className="special-recipe-card">
                <div className="recipe-title"><ChefHat size={24} /><div><h2>{recipe.title}</h2><p>{recipe.subtitle}</p></div></div>
                <div className="recipe-section"><strong>المكونات</strong><ul>{recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div className="recipe-section"><strong>طريقة التحضير</strong><ol>{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                <div className="recipe-note"><span>{recipe.bestTime}</span><small>{recipe.note}</small></div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {meals.length > 0 ? (
        <>
          <div className="stats-grid">
            <Stat label="إجمالي الخطة الحالية" value={`${totalCalories} سعر`} />
            <Stat label="بروتين الخطة الحالية" value={`${totalProtein} جم`} hint="الهدف الفعلي ظاهر في صفحة اليوم" />
          </div>
          <div className="meal-plan-grid">
            {meals.map((meal) => (
              <article key={meal.id} className="meal-card">
                <span className="meal-time">{formatTimeAr(meal.timeMinutes)}</span>
                <h2>{meal.title}</h2>
                <ul>{meal.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>
                <div className="meal-meta"><span>{meal.calories} سعر</span><span>{meal.protein} جم بروتين</span></div>
              </article>
            ))}
          </div>
          <Card><p className="muted">لو صنف خلص أو الكمية تغيّرت، عدّلها واضغط «احفظ وابني أكلي» وسيُعاد ترتيب الخطة.</p></Card>
        </>
      ) : (
        <Card><EmptyState text={selected.size ? 'اضغط احفظ وابني أكلي علشان تظهر وجبات اليوم.' : 'اختار الأكل المتاح عندك أولًا.'} /></Card>
      )}
    </Page>
  )
}
