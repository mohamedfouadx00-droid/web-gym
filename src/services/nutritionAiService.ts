import type { FoodCategory } from '../domain/models'
import { getCoachAiConfig } from './smartCoachService'

export interface NutritionEstimate {
  nameAr: string
  servingLabel: string
  category: FoodCategory
  calories: number
  protein: number
  carbs: number
  fats: number
  confidence: 'low' | 'medium' | 'high'
  assumptions: string[]
  note: string
}

export async function estimateNutritionWithAi(input: {
  description: string
  serving?: string
  category?: FoodCategory
  context?: string
}): Promise<NutritionEstimate> {
  const coachEndpoint = getCoachAiConfig().endpoint.trim()
  if (!coachEndpoint) throw new Error('فعّل رابط خدمة الذكاء الاصطناعي من الإعدادات أولًا.')
  const nutritionEndpoint = coachEndpoint.replace(/\/api\/coach\/?$/i, '/api/nutrition/estimate')
  const response = await fetch(nutritionEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  const data = await response.json() as { estimate?: NutritionEstimate; error?: string }
  if (!response.ok || !data.estimate) {
    throw new Error(data.error || `Nutrition AI request failed: ${response.status}`)
  }
  return data.estimate
}
