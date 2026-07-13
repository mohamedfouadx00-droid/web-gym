import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChefHat, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { appSettings } from '../../data/db'
import {
  availableFoodRepo,
  checkInRepo,
  customFoodRepo,
  mealPlanRepo,
} from '../../data/repositories'
import { foodCatalog } from '../../data/foodCatalog'
import { getAvailableSpecialRecipes } from '../../data/specialRecipes'
import { dateKey, formatTimeAr } from '../../domain/dailyCoach'
import { getEgyptSeason, isFoodInSeason, seasonLabel, sortFoodsForSeason } from '../../domain/season'
import type { FoodCategory, FoodCatalogItem } from '../../domain/models'
import { matchesArabicSearch } from '../../domain/search'
import { regenerateDailyPlan } from '../../services/planService'
import { estimateNutritionWithAi } from '../../services/nutritionAiService'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

const categories: Array<{ id: FoodCategory | 'all'; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'meal', label: 'وجبات كاملة' },
  { id: 'protein', label: 'بروتين' },
  { id: 'carb', label: 'نشويات' },
  { id: 'dairy', label: 'ألبان' },
  { id: 'fruit', label: 'فاكهة' },
  { id: 'vegetable', label: 'خضار' },
  { id: 'fat', label: 'دهون' },
  { id: 'treat', label: 'حلويات وسناكس' },
]

const categoryLabels: Record<FoodCategory, string> = {
  protein: 'بروتين',
  carb: 'نشويات',
  dairy: 'ألبان',
  fruit: 'فاكهة',
  fat: 'دهون',
  vegetable: 'خضار',
  meal: 'وجبة كاملة',
  treat: 'حلو / سناك',
}

const defaultNutrition: Record<FoodCategory, { calories: number; protein: number; carbs: number; fats: number }> = {
  protein: { calories: 250, protein: 25, carbs: 5, fats: 12 },
  carb: { calories: 320, protein: 8, carbs: 60, fats: 6 },
  dairy: { calories: 180, protein: 10, carbs: 10, fats: 10 },
  fruit: { calories: 100, protein: 1, carbs: 25, fats: 0 },
  fat: { calories: 180, protein: 5, carbs: 5, fats: 16 },
  vegetable: { calories: 90, protein: 4, carbs: 16, fats: 1 },
  meal: { calories: 550, protein: 25, carbs: 60, fats: 22 },
  treat: { calories: 300, protein: 4, carbs: 42, fats: 13 },
}

export default function FoodPage() {
  const userId = appSettings.activeUserId!
  const today = dateKey()
  const season = getEgyptSeason()

  const rows = useLiveQuery(() => availableFoodRepo.list(userId, today), [userId, today]) ?? []
  const customFoods = useLiveQuery(() => customFoodRepo.list(userId), [userId]) ?? []
  const checkIn = useLiveQuery(() => checkInRepo.get(userId, today), [userId, today])
  const meals = useLiveQuery(() => mealPlanRepo.list(userId, today), [userId, today]) ?? []

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState<FoodCategory>('meal')
  const [customServing, setCustomServing] = useState('')
  const [customCalories, setCustomCalories] = useState('')
  const [customProtein, setCustomProtein] = useState('')
  const [customCarbs, setCustomCarbs] = useState('')
  const [customFats, setCustomFats] = useState('')
  const [customSaving, setCustomSaving] = useState(false)
  const [aiEstimating, setAiEstimating] = useState(false)
  const [aiEstimateNote, setAiEstimateNote] = useState('')
  const [aiEstimateAssumptions, setAiEstimateAssumptions] = useState<string[]>([])
  const [aiEstimateConfidence, setAiEstimateConfidence] = useState<'low' | 'medium' | 'high' | ''>('')
  const [deletingCustomId, setDeletingCustomId] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setSelected(new Set(rows.map((row) => row.foodId)))
  }, [rows])

  useEffect(() => {
    if (!showCustom) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !customSaving && !aiEstimating) setShowCustom(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showCustom, customSaving, aiEstimating])

  useEffect(() => {
    if (!statusMessage) return
    const timeout = window.setTimeout(() => setStatusMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [statusMessage])

  const allFoods = useMemo(
    () => sortFoodsForSeason([...foodCatalog, ...customFoods], season),
    [customFoods, season],
  )

  const visibleFoods = useMemo(() =>
    allFoods.filter((food) => {
      const matchesSearch = matchesArabicSearch(food.nameAr, query)
      const matchesCategory = category === 'all' || food.category === category
      return matchesSearch && matchesCategory
    }),
  [allFoods, query, category])

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

  async function estimateCustomFood() {
    const description = customName.trim()
    if (!description || aiEstimating) return

    setAiEstimating(true)
    setErrorMessage('')
    setAiEstimateNote('')
    setAiEstimateAssumptions([])
    setAiEstimateConfidence('')
    try {
      const estimate = await estimateNutritionWithAi({
        description,
        serving: customServing.trim(),
        category: customCategory,
        context: 'المستخدم يريد تسجيل الطعام داخل خطة تغذية مرتبطة بموعد الجيم. لا تغيّر القيم بسبب الهدف؛ قدّر الطعام نفسه فقط.',
      })
      setCustomName(estimate.nameAr)
      setCustomServing(estimate.servingLabel)
      setCustomCategory(estimate.category)
      setCustomCalories(String(estimate.calories))
      setCustomProtein(String(estimate.protein))
      setCustomCarbs(String(estimate.carbs))
      setCustomFats(String(estimate.fats))
      setAiEstimateNote(estimate.note)
      setAiEstimateAssumptions(estimate.assumptions)
      setAiEstimateConfidence(estimate.confidence)
    } catch {
      setErrorMessage('الذكاء الاصطناعي مش متاح دلوقتي. اكتب وصف الحصة واحفظ، والتطبيق هيستخدم تقديرًا عامًا قابلًا للتعديل.')
    } finally {
      setAiEstimating(false)
    }
  }

  async function addCustomFood() {
    const name = customName.trim()
    if (!name || customSaving) return

    setCustomSaving(true)
    setErrorMessage('')
    try {
      const id = `custom-${crypto.randomUUID()}`
      const nutrition = {
        calories: Math.max(0, Number(customCalories) || defaultNutrition[customCategory].calories),
        protein: Math.max(0, Number(customProtein) || 0),
        carbs: Math.max(0, Number(customCarbs) || 0),
        fats: Math.max(0, Number(customFats) || 0),
      }
      const food: FoodCatalogItem & { userId: string; createdAt: string } = {
        id,
        userId,
        createdAt: new Date().toISOString(),
        nameAr: name,
        category: customCategory,
        servingLabel: customServing.trim() || (customCategory === 'meal' ? 'حصة متوسطة' : 'حصة واحدة'),
        ...nutrition,
        season: 'all',
        kind:
          customCategory === 'meal'
            ? 'complete_meal'
            : customCategory === 'treat'
              ? 'treat'
              : 'component',
      }

      await customFoodRepo.add(food)
      setSelected((current) => new Set([...current, id]))
      setCustomName('')
      setCustomServing('')
      setCustomCalories('')
      setCustomProtein('')
      setCustomCarbs('')
      setCustomFats('')
      setAiEstimateNote('')
      setAiEstimateAssumptions([])
      setAiEstimateConfidence('')
      setShowCustom(false)
      setStatusMessage('تمت إضافة الصنف واختياره ضمن المتاح. اضغط حفظ لتحديث الخطة.')
    } catch {
      setErrorMessage('مقدرناش نضيف الصنف دلوقتي. جرّب تاني.')
    } finally {
      setCustomSaving(false)
    }
  }

  async function deleteCustomFood(id: string) {
    if (deletingCustomId) return
    setDeletingCustomId(id)
    setErrorMessage('')
    try {
      await customFoodRepo.remove(id)
      await availableFoodRepo.removeFood(userId, today, id)
      setSelected((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      if (checkIn) await regenerateDailyPlan(userId, today)
      setStatusMessage('تم حذف الصنف وإزالته من خطة اليوم.')
    } catch {
      setErrorMessage('مقدرناش نحذف الصنف دلوقتي. جرّب تاني.')
    } finally {
      setDeletingCustomId('')
    }
  }

  async function saveAndBuild() {
    if (saving) return
    setSaving(true)
    setErrorMessage('')
    try {
      await availableFoodRepo.setFoodIds(userId, today, Array.from(selected))
      if (checkIn) await regenerateDailyPlan(userId, today)
      setStatusMessage(checkIn
        ? 'تم حفظ المتاح وإعادة بناء وجبات اليوم.'
        : 'تم حفظ الأكل المتاح. ابدأ يومك علشان نبني الخطة.')
    } catch {
      setErrorMessage('حصلت مشكلة أثناء الحفظ. اختياراتك ما زالت ظاهرة؛ جرّب تاني.')
    } finally {
      setSaving(false)
    }
  }

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0)
  const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0)

  return (
    <Page
      title="الأكل المتاح عندي"
      subtitle="اختار الموجود فعلًا، والموقع يوزعه بذكاء على الفطار والغداء والعشاء والسناك"
    >
      <div className="season-banner">
        <div>
          <span className="eyebrow">الموسم الحالي في مصر</span>
          <h2>{seasonLabel(season)}</h2>
          <p>الفاكهة اللي في موسمها تظهر أولًا. لو عندك فاكهة خارج موسمها فعلًا، تقدر تختارها عادي.</p>
        </div>
        <span className="season-badge">{season === 'summer' ? '☀️' : '❄️'}</span>
      </div>

      {statusMessage && (
        <Card className="success-card food-status-card"><Check size={22} /><p>{statusMessage}</p></Card>
      )}

      {errorMessage && (
        <Card className="food-error-card"><p>{errorMessage}</p></Card>
      )}

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
          النظام بيفرق بين الفطار والغداء والعشاء والسناك. مش هيجمع لك لحمة وفراخ وسمك في فطار واحد، والوجبات الكاملة بتدخل في وقتها المناسب.
        </p>

        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="مثال: مكرونة بشاميل، كفتة، برجر، كوكي..."
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
            const inSeason = isFoodInSeason(food, season)
            const isCustom = food.id.startsWith('custom-')

            return (
              <article
                key={food.id}
                className={`food-select-card availability-card ${active ? 'selected' : ''}`}
              >
                <button className="food-card-main" onClick={() => toggle(food.id)}>
                  <span className="food-check">{active ? <Check size={16} /> : ''}</span>
                  <strong>{food.nameAr}</strong>
                  <span>{food.servingLabel}</span>
                  <small>
                    {active ? 'متاح عندي' : 'مش متاح'}
                    {food.category === 'fruit' && (
                      <> · {inSeason ? 'في موسمه' : 'غالبًا خارج موسمه'}</>
                    )}
                  </small>
                </button>

                {isCustom && (
                  <button
                    className="delete-custom-food"
                    disabled={deletingCustomId === food.id}
                    onClick={() => void deleteCustomFood(food.id)}
                    title="حذف الطعام المضاف"
                  >
                    {deletingCustomId === food.id ? '...' : <Trash2 size={15} />}
                  </button>
                )}
              </article>
            )
          })}
        </div>

        <button className="add-custom-food-button" onClick={() => { setErrorMessage(''); setShowCustom(true) }}>
          <Plus size={18} />
          مش لاقي الأكل؟ أضفه بنفسك
        </button>

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
                  <span>{meal.calories} سعر تقريبي</span>
                  <span>{meal.protein} جم بروتين تقريبي</span>
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

      {showCustom && (
        <div className="modal-backdrop" onClick={() => setShowCustom(false)}>
          <div role="dialog" aria-modal="true" className="modal" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">طعام غير موجود في القائمة</span>
            <h2>أضفه بدل ما تتجاهله</h2>

            <label>
              اكتب الوجبة والكمية بطريقتك
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="مثال: طبق فول متوسط + رغيف بلدي + 3 طعمية مقلية"
              />
            </label>

            <label>
              نوعه الأقرب
              <select
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value as FoodCategory)}
              >
                {Object.entries(categoryLabels)
                  .filter(([id]) => id !== 'fruit' && id !== 'vegetable')
                  .map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
              </select>
            </label>

            <button
              type="button"
              className="ai-estimate-food-button"
              disabled={!customName.trim() || aiEstimating || customSaving}
              onClick={() => void estimateCustomFood()}
            >
              <Sparkles size={18} />
              <span>{aiEstimating ? 'بفهم الوجبة وبقدّر الكمية...' : 'حلّل الوجبة بالذكاء الاصطناعي'}</span>
            </button>

            {aiEstimateConfidence && (
              <div className="ai-food-result">
                <strong>تم ملء القيم تلقائيًا — دقة التقدير: {aiEstimateConfidence === 'high' ? 'مرتفعة نسبيًا' : aiEstimateConfidence === 'medium' ? 'متوسطة' : 'منخفضة'}</strong>
                {aiEstimateNote && <p>{aiEstimateNote}</p>}
                {aiEstimateAssumptions.length > 0 && (
                  <ul>{aiEstimateAssumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                )}
              </div>
            )}

            <div className="form-grid custom-food-nutrition-grid">
              <label>
                وصف الحصة
                <input value={customServing} onChange={(event) => setCustomServing(event.target.value)} placeholder="مثال: طبق متوسط أو 2 قطعة" />
              </label>
              <label>
                السعرات للحصة
                <input inputMode="decimal" value={customCalories} onChange={(event) => setCustomCalories(event.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} />
              </label>
              <label>
                البروتين (جم)
                <input inputMode="decimal" value={customProtein} onChange={(event) => setCustomProtein(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} />
              </label>
              <label>
                النشويات (جم)
                <input inputMode="decimal" value={customCarbs} onChange={(event) => setCustomCarbs(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} />
              </label>
              <label>
                الدهون (جم)
                <input inputMode="decimal" value={customFats} onChange={(event) => setCustomFats(event.target.value.replace(/[^0-9.]/g, '').slice(0, 5))} />
              </label>
            </div>

            <p className="safety-note">
              مش مطلوب تعرف السعرات. اكتب الوجبة والكمية واضغط التحليل؛ القيم تظل تقديرية لأن الزيت والحجم وطريقة الطبخ قد تغيّر النتيجة.
            </p>

            {errorMessage && <p className="form-error">{errorMessage}</p>}

            <div className="button-row">
              <Button disabled={!customName.trim() || customSaving || aiEstimating} onClick={addCustomFood}>
                {customSaving ? 'بضيف...' : 'احفظ الوجبة واخترها كمتاحة'}
              </Button>
              <Button disabled={customSaving || aiEstimating} variant="secondary" onClick={() => setShowCustom(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
