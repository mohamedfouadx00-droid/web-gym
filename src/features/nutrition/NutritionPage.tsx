import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Clock3, ShoppingBasket, Utensils } from 'lucide-react'
import { appSettings } from '../../data/db'
import { goalRepo, inventoryRepo, mealRepo, profileRepo, waterRepo } from '../../data/repositories'
import { foods } from '../../data/seeds'
import { calculateNutritionTargets, getMealNowSuggestion, isSameLocalDay } from '../../domain/smartCoach'
import { Button, Card, EmptyState, Page, Stat } from '../../components/UI'

export default function NutritionPage() {
  const userId = appSettings.activeUserId!
  const profile = useLiveQuery(() => profileRepo.get(userId), [userId])
  const goal = useLiveQuery(() => goalRepo.get(userId), [userId])
  const meals = useLiveQuery(() => mealRepo.list(userId), [userId]) ?? []
  const waters = useLiveQuery(() => waterRepo.list(userId), [userId]) ?? []
  const inventory = useLiveQuery(() => inventoryRepo.list(userId), [userId]) ?? []
  const [foodId, setFoodId] = useState(foods[0].id)
  const [servings, setServings] = useState(1)
  const [inventoryName, setInventoryName] = useState('')

  const todayMeals = meals.filter((item) => isSameLocalDay(item.date))
  const totals = todayMeals.reduce((sum, item) => {
    const food = foods.find((candidate) => candidate.id === item.foodId)
    return food ? {
      calories: sum.calories + food.calories * item.servings,
      protein: sum.protein + food.protein * item.servings,
      carbs: sum.carbs + food.carbs * item.servings,
      fats: sum.fats + food.fats * item.servings,
    } : sum
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 })

  const targets = profile && goal ? calculateNutritionTargets(profile, goal) : null
  const remainingCalories = Math.max(0, (targets?.calories ?? 0) - totals.calories)
  const remainingProtein = Math.max(0, (targets?.proteinG ?? 0) - totals.protein)
  const suggestion = getMealNowSuggestion(new Date().getHours(), remainingCalories, remainingProtein)
  const waterToday = waters.filter((item) => isSameLocalDay(item.date)).reduce((sum, item) => sum + item.amountMl, 0)
  const waterTarget = profile ? Math.round(profile.currentWeightKg * 35 / 250) * 250 : 3000

  if (!profile || !goal || !targets) {
    return <Page title="التغذية"><EmptyState text="أكمل بياناتك وهدفك أولًا عشان أحسب لك خطة الأكل." /></Page>
  }

  return (
    <Page title="التغذية" subtitle="مش هسألك عايز تاكل إيه. هقولك الأنسب حسب المتبقي من يومك.">
      <section className="nutrition-command">
        <span className="eyebrow">كل إيه دلوقتي؟</span>
        <h2>{suggestion.title}</h2>
        <ul>{suggestion.items.map((item) => <li key={item}>{item}</li>)}</ul>
        <p>{suggestion.reason}</p>
      </section>

      <div className="stats-grid nutrition-stats">
        <Stat label="السعرات" value={`${Math.round(totals.calories)} / ${targets.calories}`} hint={`متبقي ${Math.round(remainingCalories)}`} />
        <Stat label="البروتين" value={`${Math.round(totals.protein)} / ${targets.proteinG} جم`} hint={`متبقي ${Math.round(remainingProtein)} جم`} />
        <Stat label="النشويات" value={`${Math.round(totals.carbs)} / ${targets.carbsG} جم`} />
        <Stat label="الدهون" value={`${Math.round(totals.fats)} / ${targets.fatsG} جم`} />
      </div>

      <div className="estimate-note">الأهداف تقديرية مبنية على بياناتك وهدفك، وتحتاج تعديلًا حسب تغير الوزن والطاقة والأداء خلال الأسابيع.</div>

      <div className="nutrition-layout">
        <Card title="سجّل اللي أكلته">
          <div className="form-grid">
            <label>الطعام<select value={foodId} onChange={(event) => setFoodId(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.nameAr} · {food.serving}</option>)}</select></label>
            <label>عدد الحصص<input type="number" onFocus={(event) => event.currentTarget.select()} min="0.25" step="0.25" value={servings} onChange={(event) => setServings(Number(event.target.value))} /></label>
          </div>
          <Button onClick={() => mealRepo.add({ userId, date: new Date().toISOString(), foodId, servings })}>إضافة لليوم</Button>
        </Card>

        <Card title="المياه الآن">
          <div className="water-progress"><strong>{waterToday}</strong><span>من {waterTarget} مل</span></div>
          <div className="progress-track"><span style={{ width: `${Math.min(100, waterToday / waterTarget * 100)}%` }} /></div>
          <div className="button-row">
            <Button onClick={() => waterRepo.add({ userId, amountMl: 250, date: new Date().toISOString() })}>+ 250 مل</Button>
            <Button variant="secondary" onClick={() => waterRepo.add({ userId, amountMl: 500, date: new Date().toISOString() })}>+ 500 مل</Button>
          </div>
        </Card>
      </div>

      <Card title="خطة يوم بسيطة بدل الحيرة">
        <div className="meal-plan-grid">
          <div><Clock3 size={20} /><strong>الفطار</strong><span>بيض + عيش بلدي + فاكهة</span></div>
          <div><Utensils size={20} /><strong>الوجبة الأساسية</strong><span>دجاج أو تونة + أرز أو بطاطس + خضار</span></div>
          <div><Utensils size={20} /><strong>وجبة خفيفة</strong><span>زبادي أو جبنة قريش حسب البروتين المتبقي</span></div>
        </div>
        <p className="muted">الكميات تتغير حسب الأرقام الموجودة فوق. سجّل أكلك، والاقتراح التالي يتغير تلقائيًا.</p>
      </Card>

      <Card title="أطعمة سريعة التسجيل">
        <div className="food-grid">{foods.map((food) => <button className="food-item clickable" key={food.id} onClick={() => mealRepo.add({ userId, date: new Date().toISOString(), foodId: food.id, servings: 1 })}><strong>{food.nameAr}</strong><span>{food.serving}</span><span>{food.calories} سعر · {food.protein} جم بروتين</span></button>)}</div>
      </Card>

      <Card title="مطبخي">
        <div className="button-row">
          <input value={inventoryName} onChange={(event) => setInventoryName(event.target.value)} placeholder="مثال: دجاج، أرز، بيض" />
          <Button disabled={!inventoryName.trim()} onClick={async () => { await inventoryRepo.add({ userId, name: inventoryName, quantity: 1, unit: 'وحدة' }); setInventoryName('') }}>إضافة</Button>
        </div>
        {inventory.length ? <div className="list">{inventory.map((item) => <div className="list-row" key={item.id}><ShoppingBasket size={18} /><strong>{item.name}</strong><span>{item.quantity} {item.unit}</span><button className="text-link" onClick={() => item.id && inventoryRepo.remove(item.id)}>حذف</button></div>)}</div> : <EmptyState text="مطبخك فارغ. أضف الموجود عندك عشان الاقتراحات القادمة تبقى أذكى." />}
      </Card>
    </Page>
  )
}
