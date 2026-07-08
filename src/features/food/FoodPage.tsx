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

export default function FoodPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const rows = useLiveQuery(() => availableFoodRepo.list(userId, today), [userId, today]) ?? []
  const checkIn = useLiveQuery(() => checkInRepo.get(userId, today), [userId, today])
  const meals = useLiveQuery(() => mealPlanRepo.list(userId, today), [userId, today]) ?? []

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(new Set(rows.map((row) => row.foodId)))
  }, [rows])

  const visibleFoods = useMemo(() =>
    foodCatalog.filter((food) => {
      const matchesSearch = food.nameAr.includes(query.trim())
      const matchesCategory = category === 'all' || food.category === category
      return matchesSearch && matchesCategory
    }),
  [query, category])

  const specialRecipes = useMemo(
    () => getAvailableSpecialRecipes(Array.from(selected)),
    [selected],
  )

  function toggle(foodId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(foodId)) next.delete(foodId)
      else next.add(foodId)
      return next
    })
  }

  async function saveAndBuild() {
    setSaving(true)
    await availableFoodRepo.setFoodIds(userId, today, Array.from(selected))
    if (checkIn) await regenerateDailyPlan(userId, today)
    setSaving(false)
  }

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0)
  const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0)

  return (
    <Page title="الأكل المتاح عندي" subtitle="اختار بس الحاجة موجودة عندك ولا لأ — من غير كميات">
      {!checkIn && (
        <Card className="attention-card">
          <div>
            <h2>ابدأ يومك الأول</h2>
            <p>اضغط «أنا صحيت الآن»، وبعدها ارجع اختار المتاح.</p>
          </div>
        </Card>
      )}

      <Card title="إيه الموجود عندك النهارده؟">
        <p className="muted">
          لو صنف بقى مش متاح وقت الوجبة، تقدر تشيله من الوجبة نفسها من غير ما تلغي باقي الوجبة.
        </p>

        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن أكل"
          />
        </div>

        <div className="chips">
          {categories.map((item) => (
            <button
              key={item.id}
              className={category === item.id ? 'chip active' : 'chip'}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="food-select-grid">
          {visibleFoods.map((food) => {
            const active = selected.has(food.id)

            return (
              <button
                key={food.id}
                className={`food-select-card availability-card ${active ? 'selected' : ''}`}
                onClick={() => toggle(food.id)}
              >
                <span className="food-check">{active ? <Check size={16} /> : ''}</span>
                <strong>{food.nameAr}</strong>
                <span>{food.servingLabel}</span>
                <small>{active ? 'متاح عندي' : 'مش متاح'}</small>
              </button>
            )
          })}
        </div>

        <div className="sticky-action-row">
          <span>المتاح: {selected.size} أصناف</span>
          <Button disabled={saving} onClick={saveAndBuild}>
            <Sparkles size={17} />
            {saving ? 'بحدّث يومك...' : 'احفظ وحدّث الخطة'}
          </Button>
        </div>
      </Card>

      {specialRecipes.length > 0 && (
        <Card title="وجبات اسبيشيال من الموجود عندك">
          <div className="special-recipes-grid">
            {specialRecipes.map((recipe) => (
              <article key={recipe.id} className="special-recipe-card">
                <div className="recipe-title">
                  <ChefHat size={24} />
                  <div>
                    <h2>{recipe.title}</h2>
                    <p>{recipe.subtitle}</p>
                  </div>
                </div>

                <div className="recipe-section">
                  <strong>المكونات</strong>
                  <ul>{recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>

                <div className="recipe-section">
                  <strong>طريقة التحضير</strong>
                  <ol>{recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                </div>

                <div className="recipe-note">
                  <span>{recipe.bestTime}</span>
                  <small>{recipe.note}</small>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {meals.length > 0 ? (
        <>
          <div className="stats-grid">
            <Stat label="الخطة الحالية" value={`${totalCalories} سعر تقريبي`} />
            <Stat label="البروتين في الخطة" value={`${totalProtein} جم تقريبي`} />
          </div>

          <div className="meal-plan-grid">
            {meals.map((meal) => (
              <article key={meal.id} className="meal-card">
                <span className="meal-time">{formatTimeAr(meal.timeMinutes)}</span>
                <h2>{meal.title}</h2>
                <ul>{meal.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul>
                <div className="meal-meta">
                  <span>{meal.calories} سعر</span>
                  <span>{meal.protein} جم بروتين</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <EmptyState text="اختار الأكل المتاح واحفظه علشان تتبني الوجبات." />
        </Card>
      )}
    </Page>
  )
}
