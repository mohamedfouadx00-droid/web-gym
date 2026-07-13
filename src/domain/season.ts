import type { FoodCatalogItem, SeasonType } from './models'

export function getEgyptSeason(date = new Date()): SeasonType {
  const month = date.getMonth() + 1
  return month >= 4 && month <= 10 ? 'summer' : 'winter'
}

export function seasonLabel(season: SeasonType): string {
  if (season === 'summer') return 'الصيف'
  if (season === 'winter') return 'الشتاء'
  return 'طوال السنة'
}

export function isFoodInSeason(food: FoodCatalogItem, season = getEgyptSeason()): boolean {
  return !food.season || food.season === 'all' || food.season === season
}

export function sortFoodsForSeason(
  foods: FoodCatalogItem[],
  season = getEgyptSeason(),
): FoodCatalogItem[] {
  return [...foods].sort((a, b) => {
    const aScore = isFoodInSeason(a, season) ? 0 : 1
    const bScore = isFoodInSeason(b, season) ? 0 : 1
    if (aScore !== bScore) return aScore - bScore
    return a.nameAr.localeCompare(b.nameAr, 'ar')
  })
}
