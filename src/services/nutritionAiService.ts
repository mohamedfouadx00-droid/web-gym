import type { FoodCategory } from '../domain/models'
import { requestAiJson } from './aiHttpService'
import { getCoachAiConfig, normalizeCoachEndpoint } from './smartCoachService'

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
  const coachEndpoint = normalizeCoachEndpoint(getCoachAiConfig().endpoint)
  const nutritionEndpoint = coachEndpoint.replace(/\/api\/coach\/?$/i, '/api/nutrition/estimate')
  const data = await requestAiJson<{ estimate?: NutritionEstimate; error?: string }>({
    url: nutritionEndpoint,
    method: 'POST',
    data: input,
    timeoutMs: 75_000,
  })

  if (!data.estimate) {
    throw new Error(data.error || 'لم نتمكن من تقدير الوجبة بالذكاء الاصطناعي.')
  }
  return data.estimate
}
