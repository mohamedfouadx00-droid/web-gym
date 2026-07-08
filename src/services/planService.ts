import { availableFoodRepo, checkInRepo, dailyTaskRepo, goalRepo, mealPlanRepo, preferencesRepo, profileRepo } from '../data/repositories'
import { foodCatalog } from '../data/foodCatalog'
import { buildDailyPlan, normalizeGoal, normalizePreferences, recommendGoal } from '../domain/dailyCoach'

export async function regenerateDailyPlan(userId: string, date: string) {
  const [profile, rawGoal, rawPreferences, checkIn, availableRows] = await Promise.all([
    profileRepo.get(userId),
    goalRepo.get(userId),
    preferencesRepo.get(userId),
    checkInRepo.get(userId, date),
    availableFoodRepo.list(userId, date),
  ])

  if (!profile || !checkIn) return null

  const recommendation = recommendGoal(profile)
  const normalizedGoal = normalizeGoal(rawGoal, userId)
  const goal = { ...normalizedGoal, primary: recommendation.goal }
  if (!rawGoal || normalizedGoal.primary !== recommendation.goal) await goalRepo.save(goal)

  const preferences = normalizePreferences(rawPreferences, userId)
  const selectedIds = new Set(availableRows.filter((row) => row.quantity > 0).map((row) => row.foodId))
  const availableFoods = foodCatalog.filter((food) => selectedIds.has(food.id))
  const previousTasks = await dailyTaskRepo.list(userId, date)
  const plan = buildDailyPlan({ profile, goal, preferences, checkIn, availableFoods })

  const previousState = new Map(
    previousTasks.map((task) => [`${task.type}|${task.title}`, { completed: task.completed, response: task.response }]),
  )
  const tasks = plan.tasks.map((task) => {
    const state = previousState.get(`${task.type}|${task.title}`)
    return { ...task, completed: state?.completed ?? false, response: state?.response }
  })

  await Promise.all([
    dailyTaskRepo.replaceDay(userId, date, tasks),
    mealPlanRepo.replaceDay(userId, date, plan.meals),
  ])

  plan.tasks = tasks
  return plan
}
