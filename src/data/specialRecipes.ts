export interface SpecialRecipe {
  id: string
  title: string
  subtitle: string
  requiredFoodIds: string[]
  ingredients: string[]
  steps: string[]
  bestTime: string
  note: string
}

export const specialRecipes: SpecialRecipe[] = [
  {
    id: 'banana-oat-pancake',
    title: 'بان كيك الشوفان والموز',
    subtitle: 'وجبة سهلة ومشبعة',
    requiredFoodIds: ['oats', 'banana', 'eggs'],
    ingredients: ['شوفان', 'موز', 'بيض', 'قليل لبن عند الحاجة — اختياري', 'عسل — اختياري'],
    steps: [
      'اضرب الشوفان والموز والبيض في الخلاط.',
      'لو الخليط ثقيل، أضف قليلًا من اللبن.',
      'سخّن طاسة غير لاصقة على نار هادئة.',
      'صب الخليط واقلبه بعد ما يتماسك.',
      'أضف العسل بعد التسوية لو موجود.',
    ],
    bestTime: 'مناسبة للفطار أو قبل الجيم بوقت كافٍ.',
    note: 'المكونات الاختيارية لا تمنع ظهور الوصفة.',
  },
  {
    id: 'oats-banana-bowl',
    title: 'شوفان دافئ بالموز',
    subtitle: 'وجبة سريعة من غير تعقيد',
    requiredFoodIds: ['oats', 'banana'],
    ingredients: ['شوفان', 'موز', 'مياه أو لبن', 'عسل أو زبدة فول سوداني — اختياري'],
    steps: [
      'حط الشوفان مع مياه أو لبن على نار هادئة.',
      'قلّب لحد ما القوام يبقى كريمي.',
      'اطفِ النار وأضف الموز.',
      'أضف العسل أو زبدة الفول السوداني لو موجودة.',
    ],
    bestTime: 'مناسبة للفطار أو كسناك حسب وقت الجيم.',
    note: 'لو محتاج بروتين أعلى، تناول معها مصدر بروتين متاح.',
  },
  {
    id: 'tuna-potato-bowl',
    title: 'طبق تونة وبطاطس',
    subtitle: 'بروتين ونشويات في طبق واحد',
    requiredFoodIds: ['tuna-water', 'potato'],
    ingredients: ['تونة مصفاة', 'بطاطس مسلوقة أو مشوية', 'سلطة — اختيارية', 'زيت زيتون — اختياري'],
    steps: [
      'قطّع البطاطس بعد التسوية.',
      'أضف التونة المصفاة.',
      'أضف السلطة لو موجودة.',
      'أضف كمية صغيرة من زيت الزيتون لو مناسب ليومك.',
    ],
    bestTime: 'مناسبة كوجبة رئيسية أو بعد الجيم.',
    note: 'تظهر فقط لو التونة والبطاطس متاحين.',
  },
  {
    id: 'egg-foul-breakfast',
    title: 'فطار بيض وفول',
    subtitle: 'اختيار مصري عملي ومشبع',
    requiredFoodIds: ['eggs', 'foul'],
    ingredients: ['بيض', 'فول', 'عيش بلدي — اختياري', 'خيار أو طماطم — اختياري'],
    steps: [
      'جهّز البيض بالطريقة اللي تفضلها.',
      'سخّن الفول.',
      'أضف الخضار والعيش لو متاحين.',
    ],
    bestTime: 'مناسبة للفطار أو أول وجبة.',
    note: 'المكونات الاختيارية لا تلغي الوصفة.',
  },
]

export function getAvailableSpecialRecipes(foodIds: string[]): SpecialRecipe[] {
  const available = new Set(foodIds)
  return specialRecipes.filter((recipe) =>
    recipe.requiredFoodIds.every((id) => available.has(id)),
  )
}
