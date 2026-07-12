import { goalLabels } from '../domain/dailyCoach'
import type { FoodCatalogItem, UserPreferences } from '../domain/models'
import type { SmartDaySnapshot } from './smartEngineService'
import { locationLabel, seasonLabel } from './smartEngineService'

export interface CoachAiConfig {
  enabled: boolean
  endpoint: string
  model: string
}

export interface CoachQuestionContext {
  snapshot: SmartDaySnapshot
  availableFoods: FoodCatalogItem[]
  frequentFoods: FoodCatalogItem[]
  preferences: UserPreferences
  nextTaskTitles: string[]
}

export interface CoachReply {
  text: string
  source: 'local' | 'ai'
  fallbackReason?: string
}

const defaultConfig: CoachAiConfig = {
  enabled: false,
  endpoint: '/api/coach',
  model: '',
}

export function getCoachAiConfig(): CoachAiConfig {
  if (typeof localStorage === 'undefined') return defaultConfig
  try {
    const raw = localStorage.getItem('gym.coachAiConfig')
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig
  } catch {
    return defaultConfig
  }
}

export function saveCoachAiConfig(config: CoachAiConfig) {
  localStorage.setItem('gym.coachAiConfig', JSON.stringify(config))
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalizeArabic(word)))
}

function availableNames(context: CoachQuestionContext, limit = 5) {
  return context.availableFoods.slice(0, limit).map((food) => food.nameAr)
}

function foodMatchesQuestion(question: string, context: CoachQuestionContext) {
  const normalized = normalizeArabic(question)
  return context.availableFoods.filter((food) => normalized.includes(normalizeArabic(food.nameAr))).slice(0, 6)
}

function budgetFromQuestion(question: string) {
  const match = question.match(/(\d{2,5})\s*(?:جنيه|جنية|ج)/)
  return match ? Number(match[1]) : undefined
}

function localGymAnswer(context: CoachQuestionContext) {
  const { snapshot } = context
  if (snapshot.illness) {
    return snapshot.fastingNow
      ? 'بما إنك مفعّل وضع «أنا تعبان» وإنت صايم دلوقتي، متضغطش على نفسك بالجيم. ركّز على الراحة، وبعد المغرب اهتم بالمياه والأكل. لو الأعراض شديدة أو مستمرة اطلب تقييمًا طبيًا.'
      : 'بما إنك مفعّل وضع «أنا تعبان»، متضغطش على نفسك بالجيم. ركّز على الراحة والمياه، ولو الأعراض شديدة أو مستمرة اطلب تقييمًا طبيًا.'
  }
  if (snapshot.fastingNow) {
    return 'إنت في وقت الصيام دلوقتي. الأفضل تأجل الجيم لما بعد الإفطار والمياه بوقت مناسب، وخلي الشدة حسب نومك وطاقتك.'
  }
  if (snapshot.sleepHours !== undefined && snapshot.sleepHours <= 4.5) {
    return `إنت نمت ${snapshot.sleepHours} ساعة تقريبًا. لو الإرهاق واضح، الراحة النهارده أفضل. لو حاسس إنك قادر، خلي التمرين خفيف وقصير ومتتمرنش بالعافية.`
  }
  if (snapshot.energy === 'low') {
    return 'طاقتك المسجلة قليلة. كل واشرب وخد راحة قصيرة، وبعدها قيّم نفسك مرة تانية. لو التعب حقيقي أو مستمر، شيل الجيم النهارده.'
  }
  if (snapshot.nextPrayer && snapshot.nextPrayer.minutesAway >= 0 && snapshot.nextPrayer.minutesAway <= 30) {
    return `باقي حوالي ${snapshot.nextPrayer.minutesAway} دقيقة على ${snapshot.nextPrayer.title}. صلّي الأول، وبعدها تحرك للجيم براحة.`
  }
  return snapshot.goingGym
    ? 'حسب حالتك الحالية تقدر تتمرن، لكن التزم بالخطة وخلي قرار الشدة حسب نومك وطاقتك الفعلية.'
    : 'النهارده مش متسجل يوم جيم. تقدر تخليه راحة، أو تفعّل الجيم يدويًا لو وقتك وطاقتك مناسبين.'
}

export function answerCoachLocally(question: string, context: CoachQuestionContext): string {
  const text = normalizeArabic(question.trim())
  const { snapshot, preferences } = context
  const matchedFoods = foodMatchesQuestion(question, context)
  const budget = budgetFromQuestion(question)

  if (!text) return 'اكتبلي اللي حصل معاك أو سؤالك، وأنا هربطه ببيانات يومك الحالية.'

  if (containsAny(text, ['مش قادر اتنفس', 'الم شديد', 'اغماء', 'الم صدر', 'نزيف'])) {
    return 'الأعراض دي محتاجة تصرف طبي سريع، مش نصيحة تدريب أو أكل داخل التطبيق. اطلب مساعدة طبية عاجلة أو تواصل مع الطوارئ في بلدك.'
  }

  if (containsAny(text, ['جدول تمارين', 'تمارين ايه', 'العب ايه', 'مجموعات', 'تكرارات', 'حركات'])) {
    return 'التطبيق لا يقدّم تمارين أو حركات أو جداول أو مجموعات وتكرارات. أقدر أنظم لك ميعاد الجيم، قرار الذهاب، الشدة العامة، الأكل قبل وبعد الجيم، المياه والكرياتين.'
  }

  if (containsAny(text, ['اتمرن', 'الجيم', 'اريح', 'تمرين'])) {
    return localGymAnswer(context)
  }

  if (containsAny(text, ['تعبان', 'مرهق', 'مجهد', 'طاقتي قليله', 'صحيت تعبان'])) {
    const sleep = snapshot.sleepHours !== undefined ? ` ونمت ${snapshot.sleepHours} ساعة تقريبًا` : ''
    return snapshot.fastingNow
      ? `واضح إن طاقتك اتغيرت${sleep}. خُد راحة وقلل المجهود دلوقتي، وبعد المغرب ابدأ بالمياه والأكل بهدوء. لو التعب قوي أو مستمر، ألغِ الجيم وخد تقييمًا طبيًا عند الحاجة.`
      : `واضح إن طاقتك اتغيرت${sleep}. اشرب مياه، وكل وجبة بسيطة لو بقالك فترة من غير أكل، وخد راحة قصيرة. بعدها حدّث زر الطاقة. لو التعب قوي أو مستمر، ألغِ الجيم وخد تقييمًا طبيًا عند الحاجة.`
  }

  if (containsAny(text, ['نسيت الكرياتين', 'الكرياتين الصبح', 'اخد الكرياتين', 'كرياتين'])) {
    return snapshot.creatineTaken
      ? 'إنت مسجل إنك أخدت الكرياتين النهارده بالفعل.'
      : snapshot.fastingNow
        ? `مش مشكلة إنك نسيته. خُد جرعتك المعتادة ${preferences.creatineDoseG} جم بعد الإفطار أو بعد الجيم مع مياه؛ الانتظام أهم من ساعة محددة.`
        : `مش مشكلة إنك نسيته الصبح. خُد جرعتك المعتادة ${preferences.creatineDoseG} جم في وقت مناسب النهارده مع مياه؛ الانتظام أهم من ساعة محددة.`
  }

  if (budget !== undefined || containsAny(text, ['معايا فلوس', 'اشتري اكل', 'اجيب اكل', 'ميزانيه'])) {
    const common = availableNames(context, 3)
    const priceNote = budget ? `بميزانية ${budget} جنيه` : 'بميزانية محدودة'
    return `${priceNote}، ركّز على أساسيات مشبعة ورخيصة نسبيًا: بيض، فول، عيش، زبادي أو تونة حسب الأسعار عندك. ${common.length ? `وبما إن الموجود عندك حاليًا: ${common.join('، ')}، اشترِ المكمل الناقص بدل تكرار نفس النوع.` : 'اختار مصدر بروتين + عيش أو أرز + خضار أو فاكهة موسمية.'} الأسعار تختلف حسب المكان، فاعتبرها أولويات مش تسعيرة ثابتة.`
  }

  if (matchedFoods.length || containsAny(text, ['عندي', 'اعمل ايه', 'اكل ايه'])) {
    const names = matchedFoods.length ? matchedFoods.map((food) => food.nameAr) : availableNames(context)
    if (!names.length) return 'حدد الأكل المتاح عندك من صفحة الأكل، وبعدها أقدر أرتب لك وجبة من الموجود فعلًا.'
    return `من الموجود عندك تقدر تعمل وجبة من: ${names.join(' + ')}. خلي فيها مصدر بروتين واضح، وأضف عيش أو نشويات حسب الجوع وهدفك. ${snapshot.fastingNow ? 'حضّرها للإفطار أو السحور حسب الوقت، وبعد ما تأكل' : 'بعد ما تأكل'} سجّل الوجبة من «إيه اللي حصل فعلًا؟» علشان باقي اليوم يتظبط.`
  }

  if (containsAny(text, ['مياه', 'عطشان', 'شربت'])) {
    return snapshot.fastingNow
      ? `إنت في وقت الصيام دلوقتي. بعد المغرب وزّع هدف المياه ${snapshot.waterTargetMl} مل تدريجيًا لحد الفجر، ومتتعوضش كمية كبيرة مرة واحدة.`
      : `إنت مسجل حوالي ${snapshot.waterTodayMl} مل من هدف ${snapshot.waterTargetMl} مل. زوّد المياه تدريجيًا، ومتتعوضش كمية كبيرة مرة واحدة، خصوصًا لو الجيم قريب.`
  }

  if (containsAny(text, ['مكلتش', 'جعان', 'اكلت امتى'])) {
    if (snapshot.fastingNow) {
      return 'إنت في وقت الصيام دلوقتي، فمش هاقترح عليك أكل أو مياه قبل المغرب. قلل المجهود وجهّز إفطارًا متوازنًا، ولو عندك أعراض غير معتادة أو شديدة اهتم بسلامتك واطلب مساعدة طبية عند الحاجة.'
    }
    return snapshot.hoursSinceMeal >= 5
      ? `بقالك حوالي ${snapshot.hoursSinceMeal.toFixed(1)} ساعة من غير أكل. كل دلوقتي وجبة مناسبة، خصوصًا لو عندك جيم قريب.`
      : `آخر وجبة مش بعيدة جدًا؛ بقالك حوالي ${snapshot.hoursSinceMeal.toFixed(1)} ساعة. اختار حسب جوعك الحقيقي والخطوة التالية في يومك.`
  }

  return `أنا شايف إنك ${locationLabel(snapshot.location)}، والوقت في ${seasonLabel(snapshot.season)}، وهدفك «${goalLabels[snapshot.goal]}». ${snapshot.fastingNow ? 'إنت في وقت الصيام الآن، فالتوجيهات هتراعي عدم الأكل أو الشرب قبل المغرب. ' : ''}${snapshot.sleepHours !== undefined ? `نومك ${snapshot.sleepHours} ساعة تقريبًا، ` : ''}شربت ${snapshot.waterTodayMl} مل مياه، وبقالك ${snapshot.hoursSinceMeal.toFixed(1)} ساعة من آخر أكل. أقرب خطواتك: ${context.nextTaskTitles.join('، ') || 'مفيش خطوة عاجلة'}. اسألني عن الجيم أو الأكل أو المياه أو الكرياتين وأنا هجاوب حسب الحالة دي.`
}

function buildSystemPrompt(context: CoachQuestionContext) {
  const snapshot = context.snapshot
  return [
    'أنت مدرب يومي داخل تطبيق صحة ولياقة وتغذية عربي مصري.',
    'اكتب ردًا قصيرًا وعمليًا وبلا جلد ذات. لا تشخّص أمراضًا ولا تستبدل الطبيب.',
    'ممنوع تقديم أسماء تمارين أو جداول تمارين أو حركات أو مجموعات أو تكرارات. يمكنك فقط تنظيم توقيت الجيم، قرار الذهاب، الشدة العامة، الراحة، الأكل، المياه والكرياتين.',
    `الوقت الحالي: ${snapshot.now.toISOString()}.`,
    `المكان: ${locationLabel(snapshot.location)}. الموسم: ${seasonLabel(snapshot.season)}. الجمعة: ${snapshot.isFriday ? 'نعم' : 'لا'}.`,
    `النوم: ${snapshot.sleepHours ?? 'غير مسجل'} ساعة. الطاقة: ${snapshot.energy}. تعب/إصابة: ${snapshot.illness ?? 'لا'}.`,
    `الهدف: ${goalLabels[snapshot.goal]}. المياه: ${snapshot.waterTodayMl}/${snapshot.waterTargetMl} مل. الصيام الآن: ${snapshot.fastingNow ? 'نعم' : 'لا'}.`,
    `من آخر أكل: ${snapshot.hoursSinceMeal.toFixed(1)} ساعة. الجيم اليوم: ${snapshot.goingGym ? 'نعم' : 'لا'}.`,
    `الكرياتين: ${snapshot.creatineTaken ? 'تم' : 'لم يتم'}. الجرعة المسجلة: ${context.preferences.creatineDoseG} جم.`,
    `الأكل المتاح: ${context.availableFoods.map((food) => food.nameAr).slice(0, 20).join('، ') || 'غير محدد'}.`,
    `الخطوات القادمة: ${context.nextTaskTitles.join('، ') || 'لا توجد'}.`,
  ].join('\n')
}

async function askRemoteAi(question: string, context: CoachQuestionContext, config: CoachAiConfig) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.35,
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        { role: 'user', content: question },
      ],
    }),
  })

  if (!response.ok) throw new Error(`AI request failed: ${response.status}`)
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
    output_text?: string
    text?: string
  }
  const text = data.choices?.[0]?.message?.content ?? data.output_text ?? data.text
  if (!text?.trim()) throw new Error('Empty AI response')
  return text.trim()
}

export async function askSmartCoach(question: string, context: CoachQuestionContext): Promise<CoachReply> {
  const localText = answerCoachLocally(question, context)
  const config = getCoachAiConfig()

  if (!config.enabled || !config.endpoint.trim() || !config.model.trim()) {
    return { text: localText, source: 'local' }
  }

  try {
    const text = await askRemoteAi(question, context, config)
    return { text, source: 'ai' }
  } catch (error) {
    return {
      text: localText,
      source: 'local',
      fallbackReason: error instanceof Error ? error.message : 'تعذر الاتصال بخدمة AI',
    }
  }
}
