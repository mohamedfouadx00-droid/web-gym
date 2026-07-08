export interface SpecialRecipe {
  id: string
  title: string
  subtitle: string
  requiredFoodIds: string[]
  optionalFoodIds?: string[]
  ingredients: string[]
  steps: string[]
  bestTime: string
  note: string
}

export const specialRecipes: SpecialRecipe[] = [
  {
    id: 'banana-oat-pancake',
    title: 'بان كيك الشوفان والموز',
    subtitle: 'وجبة سهلة ومشبعة من مكونات بسيطة',
    requiredFoodIds: ['oats', 'banana', 'eggs'],
    optionalFoodIds: ['milk', 'honey'],
    ingredients: ['50 جم شوفان', 'موزة', 'بيضة', 'قليل لبن عند الحاجة', 'ملعقة صغيرة عسل اختيارية'],
    steps: [
      'اضرب الشوفان والموز والبيضة في الخلاط حتى يصبح الخليط ناعمًا.',
      'لو الخليط ثقيل جدًا، أضف كمية صغيرة من اللبن.',
      'سخّن طاسة غير لاصقة على نار هادئة وصب الخليط على شكل دوائر صغيرة.',
      'اتركه حتى يتماسك ثم اقلبه على الناحية الثانية.',
      'أضف العسل بعد التسوية لو موجود، وليس أثناء التسخين.',
    ],
    bestTime: 'مناسبة للفطار أو قبل الجيم بوقت كافٍ.',
    note: 'الكمية النهائية تتظبط حسب هدفك وباقي أكلك في اليوم.',
  },
  {
    id: 'oats-banana-bowl',
    title: 'شوفان دافئ بالموز',
    subtitle: 'وجبة سريعة من غير تعقيد',
    requiredFoodIds: ['oats', 'banana'],
    optionalFoodIds: ['milk', 'honey', 'peanut-butter'],
    ingredients: ['50 جم شوفان', 'موزة', 'لبن أو مياه', 'عسل أو زبدة فول سوداني اختيارية'],
    steps: [
      'حط الشوفان مع اللبن أو المياه على نار هادئة.',
      'قلّب لحد ما القوام يبقى كريمي.',
      'اطفِ النار وأضف الموز المهروس أو المقطع.',
      'أضف العسل أو زبدة الفول السوداني لو موجودة وبالكمية المناسبة لهدفك.',
    ],
    bestTime: 'مناسبة للفطار أو كسناك قبل الجيم حسب التوقيت.',
    note: 'لو محتاج بروتين أعلى، تناول معها مصدر بروتين متاح عندك.',
  },
  {
    id: 'tuna-potato-bowl',
    title: 'طبق تونة وبطاطس مشبع',
    subtitle: 'بروتين ونشويات في طبق واحد',
    requiredFoodIds: ['tuna', 'potato'],
    optionalFoodIds: ['salad', 'olive-oil'],
    ingredients: ['تونة مصفاة', 'بطاطس مسلوقة أو مشوية', 'سلطة اختيارية', 'كمية صغيرة زيت زيتون اختيارية'],
    steps: [
      'قطّع البطاطس بعد التسوية.',
      'أضف التونة المصفاة وقلّبهم معًا.',
      'أضف السلطة لو موجودة.',
      'لو خطتك تسمح، أضف كمية صغيرة من زيت الزيتون.',
    ],
    bestTime: 'مناسبة كوجبة رئيسية أو بعد الجيم.',
    note: 'الموقع يختارها فقط لما تكون مكوناتها متاحة عندك.',
  },
  {
    id: 'egg-foul-breakfast',
    title: 'فطار بيض وفول متوازن',
    subtitle: 'اختيار مصري عملي ومشبع',
    requiredFoodIds: ['eggs', 'foul'],
    optionalFoodIds: ['bread', 'cucumber'],
    ingredients: ['بيض', 'فول', 'عيش بلدي اختياري', 'خيار وطماطم اختيارية'],
    steps: [
      'جهّز البيض بالطريقة التي تفضلها مع أقل دهون إضافية ممكنة.',
      'سخّن الفول وأضف التوابل التي تناسبك.',
      'قدّم الوجبة مع الخضار والعيش لو الخطة تحتاج نشويات أكثر.',
    ],
    bestTime: 'مناسبة للفطار أو وجبة أولى بعد الاستيقاظ.',
    note: 'الكمية تتغير حسب هدف السعرات والبروتين اليومي.',
  },
]

export function getAvailableSpecialRecipes(foodIds: string[]): SpecialRecipe[] {
  const available = new Set(foodIds)
  return specialRecipes.filter((recipe) => recipe.requiredFoodIds.every((id) => available.has(id)))
}
