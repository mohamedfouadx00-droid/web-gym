import type { Exercise, FoodItem } from '../domain/models'

export const exercises: Exercise[] = [
  {
    id: 'leg-press', nameAr: 'ضغط الأرجل', muscle: 'الأرجل', secondaryMuscles: ['المؤخرة'], equipment: 'جهاز ضغط الأرجل', difficulty: 'مبتدئ', movement: 'squat', places: ['gym'], incrementKg: 5,
    recognitionTips: ['مقعد مائل أمام منصة كبيرة للقدمين', 'عادةً المنصة تتحرك على سكة أو ذراع', 'فيه مسند كامل للظهر ومقابض جانبية'],
    instructions: ['اضبط المقعد بحيث تنزل لمدى مريح بدون التفاف الحوض.', 'ضع القدمين بعرض الكتفين تقريبًا.', 'انزل ببطء حتى يصبح الركبان في زاوية مريحة.', 'ادفع المنصة بمنتصف القدم والكعب بدون قفل الركبتين.'],
    formCues: ['ظهرك وحوضك ثابتان على المقعد', 'الركبتان في اتجاه أصابع القدم', 'الحركة بطيئة ومتحكم بها'],
    mistakes: ['رفع الحوض من المقعد', 'قفل الركبتين بقوة', 'نزول أعمق من قدرتك مع التفاف أسفل الظهر'],
    stopSignals: ['ألم حاد في الركبة أو الظهر', 'دوخة أو عدم اتزان'], alternatives: ['goblet-squat', 'chair-squat'],
    startingWeightGuide: 'ابدأ بأخف وزن متاح على الجهاز. اعمل 10 عدات ببطء. بعد المجموعة سجّل العدات والمجهود، وأنا سأقول لك الوزن التالي.'
  },
  {
    id: 'machine-chest-press', nameAr: 'ضغط صدر على الجهاز', muscle: 'الصدر', secondaryMuscles: ['الترايسبس', 'الكتف الأمامي'], equipment: 'جهاز ضغط الصدر', difficulty: 'مبتدئ', movement: 'push', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['مقعد بظهر مرتفع ومقبضان أمام الصدر', 'المقابض تتحرك للأمام بعيدًا عن الجسم', 'غالبًا يوجد برج أوزان بجانب الجهاز'],
    instructions: ['اضبط المقعد حتى تصبح المقابض في مستوى منتصف الصدر.', 'ثبت الظهر على المسند والقدمين على الأرض.', 'ادفع للأمام بدون قفل الكوع.', 'ارجع ببطء حتى تشعر بتمدد مريح في الصدر.'],
    formCues: ['الكتفان لأسفل وخلف قليلًا', 'المعصم مستقيم', 'لا ترفع ظهرك من المقعد'],
    mistakes: ['رفع الكتفين', 'الارتداد بسرعة', 'اختيار وزن يمنع المدى الكامل'],
    stopSignals: ['ألم حاد في الكتف أو الصدر', 'تنميل غير طبيعي'], alternatives: ['incline-push-up', 'push-up'],
    startingWeightGuide: 'ابدأ بأخف وزن على الجهاز. هدف الاختبار 10 عدات نظيفة مع إحساس أنك قادر تعمل 3 عدات إضافية.'
  },
  {
    id: 'lat-pulldown', nameAr: 'سحب أمامي', muscle: 'الظهر', secondaryMuscles: ['البايسبس'], equipment: 'جهاز السحب العلوي', difficulty: 'مبتدئ', movement: 'pull', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['مقعد تحت بار طويل معلق من أعلى', 'فيه وسادة تثبت الفخذين', 'الكابل يأتي من بكرة فوق الرأس'],
    instructions: ['ثبت الفخذين أسفل الوسادة.', 'امسك البار أعرض قليلًا من الكتفين.', 'ابدأ بخفض الكتفين ثم اسحب البار لأعلى الصدر.', 'ارجع ببطء حتى تمد الذراعين بدون فقد التحكم.'],
    formCues: ['الصدر مرتفع قليلًا', 'الكوع يتجه لأسفل', 'لا تسحب خلف الرقبة'],
    mistakes: ['التأرجح للخلف', 'السحب باليد فقط', 'وضع البار خلف الرقبة'],
    stopSignals: ['ألم حاد في الكتف أو المرفق'], alternatives: ['seated-row', 'backpack-row'],
    startingWeightGuide: 'ابدأ بأخف وزن يسمح لك بتحريك البار ببطء. بعد 10 عدات سجّل الوزن وRPE وأنا أضبطه.'
  },
  {
    id: 'seated-leg-curl', nameAr: 'ثني الرجل الخلفي على الجهاز', muscle: 'الخلفية', secondaryMuscles: [], equipment: 'جهاز ثني الرجل', difficulty: 'مبتدئ', movement: 'isolation', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['مقعد مع رول أسطواني عند أسفل الساق', 'فيه وسادة تثبيت فوق الفخذين', 'الحركة تكون بثني الركبة لأسفل'],
    instructions: ['اضبط محور الجهاز مع الركبة.', 'ثبت الفخذين تحت الوسادة.', 'اثنِ الركبتين ببطء.', 'ارجع بتحكم بدون ارتداد.'],
    formCues: ['الحوض ثابت', 'لا تقذف الوزن', 'مدى مريح كامل'], mistakes: ['السرعة الزائدة', 'رفع الحوض'],
    stopSignals: ['شد حاد خلف الركبة'], alternatives: ['glute-bridge', 'backpack-rdl'],
    startingWeightGuide: 'ابدأ بأخف درجة على الجهاز واعمل 12 عدة ببطء. الهدف إحساس واضح بالعضلة بدون تشنج أو ألم.'
  },
  {
    id: 'plank', nameAr: 'بلانك', muscle: 'البطن والجذع', secondaryMuscles: ['الكتف'], equipment: 'وزن الجسم', difficulty: 'مبتدئ', movement: 'core', places: ['gym', 'home'], incrementKg: 0,
    instructions: ['ضع الكوع تحت الكتف.', 'مد الجسم في خط مستقيم.', 'شد البطن والمؤخرة.', 'تنفس طبيعيًا وحافظ على الوضع.'],
    formCues: ['لا تهبط بالحوض', 'لا ترفع المؤخرة عاليًا', 'توقف قبل انهيار الوضع'], mistakes: ['حبس النفس', 'تقويس الظهر'],
    stopSignals: ['ألم حاد في الظهر أو الكتف'], alternatives: ['dead-bug'],
    startingWeightGuide: 'ابدأ بـ20 ثانية فقط. لو ثبت التكنيك بسهولة نزيد الزمن تدريجيًا.'
  },
  {
    id: 'goblet-squat', nameAr: 'سكوات كأس بالدمبل', muscle: 'الأرجل', secondaryMuscles: ['المؤخرة', 'الجذع'], equipment: 'دمبل', difficulty: 'مبتدئ', movement: 'squat', places: ['gym', 'home'], incrementKg: 2,
    instructions: ['امسك دمبل أمام الصدر.', 'قف بعرض مريح للقدمين.', 'انزل بالحوض بين القدمين مع بقاء الصدر مرفوعًا.', 'اصعد بدفع الأرض بقدميك.'],
    formCues: ['الركبة تتبع اتجاه أصابع القدم', 'القدم كاملة على الأرض', 'الظهر محايد'], mistakes: ['انهيار الركبتين للداخل', 'رفع الكعب', 'الانحناء الشديد للأمام'],
    stopSignals: ['ألم حاد في الركبة أو الظهر'], alternatives: ['leg-press', 'chair-squat'],
    startingWeightGuide: 'ابدأ بدون وزن لاختبار الحركة. لو 10 عدات سهلة بتكنيك ثابت، استخدم أخف دمبل متاح في المجموعة التالية.'
  },
  {
    id: 'seated-row', nameAr: 'تجديف جالس على الكابل', muscle: 'الظهر', secondaryMuscles: ['البايسبس'], equipment: 'جهاز التجديف بالكابل', difficulty: 'مبتدئ', movement: 'pull', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['مقعد منخفض أمام كابل أفقي', 'فيه مسندان للقدمين', 'المقبض يُسحب نحو البطن'],
    instructions: ['اجلس والظهر محايد.', 'ابدأ بإرجاع الكتفين قليلًا.', 'اسحب المقبض نحو البطن.', 'ارجع ببطء حتى تمد الذراعين.'],
    formCues: ['لا تتأرجح بالجذع', 'الكوع قريب من الجسم', 'الصدر ثابت'], mistakes: ['السحب بأسفل الظهر', 'رفع الكتفين'],
    stopSignals: ['ألم حاد في الكتف أو الظهر'], alternatives: ['lat-pulldown', 'backpack-row'],
    startingWeightGuide: 'ابدأ بأخف وزن على الكابل وركز على سحب الكوع للخلف. سجّل النتيجة بعد أول مجموعة.'
  },
  {
    id: 'machine-shoulder-press', nameAr: 'ضغط كتف على الجهاز', muscle: 'الكتف', secondaryMuscles: ['الترايسبس'], equipment: 'جهاز ضغط الكتف', difficulty: 'مبتدئ', movement: 'push', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['مقعد بظهر مرتفع ومقبضان بجانب الرأس', 'المقابض تتحرك لأعلى', 'يشبه جهاز الصدر لكن نقطة الدفع أعلى'],
    instructions: ['اضبط المقعد بحيث تكون المقابض حول مستوى الأذن.', 'ثبت الظهر.', 'ادفع لأعلى بدون قفل الكوع.', 'انزل ببطء لمدى مريح.'],
    formCues: ['الأضلاع لأسفل', 'لا تقوس الظهر', 'المعصم مستقيم'], mistakes: ['وزن كبير ومدى قصير', 'رفع الكتفين'],
    stopSignals: ['ألم حاد في الكتف'], alternatives: ['pike-push-up'],
    startingWeightGuide: 'ابدأ بأخف وزن متاح؛ الكتف لا يحتاج إثبات قوة في أول يوم. الهدف حركة مريحة ونظيفة.'
  },
  {
    id: 'hip-thrust-machine', nameAr: 'دفع الحوض على الجهاز', muscle: 'المؤخرة', secondaryMuscles: ['الخلفية'], equipment: 'جهاز دفع الحوض', difficulty: 'مبتدئ', movement: 'hinge', places: ['gym'], incrementKg: 5,
    recognitionTips: ['مقعد منخفض مع حزام أو وسادة فوق الحوض', 'القدم ثابتة على منصة أمامية', 'الجسم يبدأ من وضع الجلوس المنخفض'],
    instructions: ['ثبت الحزام أو الوسادة على الحوض.', 'ضع القدمين بحيث تكون الساق شبه عمودية أعلى الحركة.', 'ارفع الحوض حتى يصبح الجذع مستقيمًا.', 'انزل ببطء.'],
    formCues: ['لا تبالغ في تقويس الظهر', 'الذقن للداخل قليلًا', 'الضغط من الكعب'], mistakes: ['الدفع بأسفل الظهر', 'وضع القدمين بعيدًا جدًا'],
    stopSignals: ['ألم حاد في أسفل الظهر'], alternatives: ['glute-bridge'],
    startingWeightGuide: 'ابدأ بأخف وزن على الجهاز واعمل 10 عدات بتحكم. زود فقط بعد ما تقدر تثبت أعلى الحركة بدون ألم.'
  },
  {
    id: 'cable-curl', nameAr: 'بايسبس كابل', muscle: 'البايسبس', secondaryMuscles: [], equipment: 'كابل منخفض', difficulty: 'مبتدئ', movement: 'isolation', places: ['gym'], incrementKg: 2.5,
    recognitionTips: ['قف أمام برج أوزان والكابل خارج من أسفل', 'يُركب بار قصير أو حبل في الكابل', 'الحركة تكون بثني الكوع فقط'],
    instructions: ['ثبت الكوع بجانب الجسم.', 'اثنِ الذراع بدون تحريك الكتف.', 'اعصر العضلة لحظة.', 'انزل ببطء.'],
    formCues: ['الجذع ثابت', 'المعصم مستقيم', 'لا تتأرجح'], mistakes: ['تحريك الكوع للأمام', 'استخدام الظهر'],
    stopSignals: ['ألم حاد في المرفق أو الرسغ'], alternatives: ['backpack-row'],
    startingWeightGuide: 'ابدأ بأخف وزن يسمح بـ12 عدة بدون تأرجح. لو جسمك يتحرك فالوزن كبير.'
  },
  {
    id: 'push-up', nameAr: 'ضغط أرضي', muscle: 'الصدر', secondaryMuscles: ['الترايسبس', 'الكتف'], equipment: 'وزن الجسم', difficulty: 'مبتدئ', movement: 'push', places: ['gym', 'home'], incrementKg: 0,
    instructions: ['ضع اليدين أعرض قليلًا من الكتفين.', 'اجعل الجسم خطًا مستقيمًا.', 'انزل بالصدر بين اليدين.', 'ادفع الأرض مع الحفاظ على الجذع ثابتًا.'],
    formCues: ['الحوض لا يهبط', 'الكوع ليس مفتوحًا 90 درجة', 'الرأس امتداد طبيعي للظهر'], mistakes: ['هبوط الحوض', 'مدى قصير جدًا'],
    stopSignals: ['ألم حاد في الكتف أو الرسغ'], alternatives: ['incline-push-up', 'machine-chest-press'],
    startingWeightGuide: 'ابدأ بضغط مائل على حائط أو سطح مرتفع لو الضغط الأرضي صعب. اختر المستوى الذي يسمح بـ8 عدات نظيفة.'
  },
  {
    id: 'chair-squat', nameAr: 'سكوات إلى كرسي', muscle: 'الأرجل', secondaryMuscles: ['المؤخرة'], equipment: 'كرسي ثابت', difficulty: 'مبتدئ', movement: 'squat', places: ['home'], incrementKg: 0,
    recognitionTips: ['استخدم كرسيًا ثابتًا لا يتحرك', 'ضعه خلفك كهدف للمس فقط وليس للجلوس الكامل'],
    instructions: ['قف أمام الكرسي والقدمين بعرض مريح.', 'ادفع الحوض للخلف وانزل ببطء.', 'المس الكرسي بخفة بدون ارتخاء.', 'اصعد بدفع الأرض.'],
    formCues: ['الركبتان في اتجاه القدمين', 'القدم كاملة على الأرض', 'الصدر مرفوع'], mistakes: ['السقوط على الكرسي', 'دخول الركبتين للداخل'], stopSignals: ['ألم حاد في الركبة أو الظهر'], alternatives: ['goblet-squat'],
    startingWeightGuide: 'ابدأ بوزن جسمك فقط. هدفك 10 عدات ثابتة. لو سهلة جدًا ننتقل للسكوات الحر أو نضيف حقيبة خفيفة.'
  },
  {
    id: 'incline-push-up', nameAr: 'ضغط مائل على سطح مرتفع', muscle: 'الصدر', secondaryMuscles: ['الترايسبس', 'الكتف'], equipment: 'طاولة أو سطح ثابت', difficulty: 'مبتدئ', movement: 'push', places: ['home'], incrementKg: 0,
    recognitionTips: ['اختر سطحًا ثابتًا لا ينزلق', 'كلما كان السطح أعلى كان التمرين أسهل'],
    instructions: ['ضع اليدين على سطح ثابت.', 'ارجع بالقدمين حتى يصبح الجسم خطًا مستقيمًا.', 'انزل بالصدر نحو السطح.', 'ادفع حتى تمد الذراعين بدون قفل قوي.'],
    formCues: ['الجسم خط واحد', 'الكوع بزاوية مريحة', 'البطن مشدودة'], mistakes: ['هبوط الحوض', 'تقصير مدى الحركة'], stopSignals: ['ألم حاد في الكتف أو الرسغ'], alternatives: ['push-up'],
    startingWeightGuide: 'ابدأ على سطح مرتفع يسمح بـ8-12 عدة نظيفة. لو سهل، استخدم سطحًا أقل ارتفاعًا في المرة القادمة.'
  },
  {
    id: 'backpack-row', nameAr: 'تجديف بحقيبة', muscle: 'الظهر', secondaryMuscles: ['البايسبس'], equipment: 'حقيبة ظهر', difficulty: 'مبتدئ', movement: 'pull', places: ['home'], incrementKg: 1,
    recognitionTips: ['استخدم حقيبة قوية وأغلقها جيدًا', 'ضع زجاجات مياه أو كتبًا لزيادة الحمل تدريجيًا'],
    instructions: ['امسك الحقيبة من المقبض بكلتا اليدين.', 'ادفع الحوض للخلف ومِل قليلًا.', 'اسحب الحقيبة نحو أسفل البطن.', 'انزلها ببطء.'],
    formCues: ['الظهر محايد', 'الكوع للخلف', 'لا تتأرجح'], mistakes: ['تدوير الظهر', 'السحب بسرعة'], stopSignals: ['ألم حاد في أسفل الظهر أو الكتف'], alternatives: ['seated-row'],
    startingWeightGuide: 'ابدأ بحقيبة خفيفة جدًا. لو أكملت 12 عدة وكنت قادرًا على 3 عدات إضافية، أضف زجاجة مياه صغيرة.'
  },
  {
    id: 'glute-bridge', nameAr: 'جسر الحوض', muscle: 'المؤخرة', secondaryMuscles: ['الخلفية'], equipment: 'وزن الجسم', difficulty: 'مبتدئ', movement: 'hinge', places: ['home'], incrementKg: 0,
    instructions: ['استلقِ والركبتان مثنيتان.', 'ضع القدمين بعرض الحوض.', 'اضغط بالكعب وارفع الحوض.', 'اثبت لحظة ثم انزل ببطء.'],
    formCues: ['الأضلاع لأسفل', 'لا تقوس الظهر', 'اعصر المؤخرة أعلى الحركة'], mistakes: ['الدفع بأسفل الظهر', 'وضع القدمين بعيدًا جدًا'], stopSignals: ['ألم حاد في أسفل الظهر'], alternatives: ['hip-thrust-machine'],
    startingWeightGuide: 'ابدأ بوزن جسمك لـ12 عدة. لو أصبح سهلًا جدًا، ضع حقيبة خفيفة فوق الحوض مع تثبيتها بيديك.'
  },
  {
    id: 'dead-bug', nameAr: 'ديد باج', muscle: 'البطن والجذع', secondaryMuscles: [], equipment: 'وزن الجسم', difficulty: 'مبتدئ', movement: 'core', places: ['home'], incrementKg: 0,
    instructions: ['استلقِ وارفع الركبتين فوق الحوض.', 'ثبت أسفل الظهر برفق على الأرض.', 'مد ذراعًا ورجلًا عكسية ببطء.', 'ارجع وبدّل الجانب.'],
    formCues: ['أسفل الظهر لا يبتعد عن الأرض', 'الحركة بطيئة', 'تنفس طبيعيًا'], mistakes: ['السرعة', 'تقويس الظهر'], stopSignals: ['ألم حاد في الظهر'], alternatives: ['plank'],
    startingWeightGuide: 'ابدأ بـ6 عدات لكل جانب. لو ظهرك بدأ يتقوس، قلل مدى مد الرجل بدل زيادة العدات.'
  },
  {
    id: 'reverse-lunge', nameAr: 'اندفاع خلفي', muscle: 'الأرجل', secondaryMuscles: ['المؤخرة'], equipment: 'وزن الجسم', difficulty: 'مبتدئ', movement: 'squat', places: ['home'], incrementKg: 0,
    instructions: ['قف مستقيمًا بجانب حائط عند الحاجة للتوازن.', 'خذ خطوة للخلف.', 'انزل الركبة الخلفية نحو الأرض بمدى مريح.', 'ادفع بالقدم الأمامية للعودة.'],
    formCues: ['الركبة الأمامية في اتجاه القدم', 'الجذع ثابت', 'الخطوة للخلف كافية'], mistakes: ['خطوة قصيرة جدًا', 'انهيار الركبة للداخل'], stopSignals: ['ألم حاد في الركبة'], alternatives: ['chair-squat'],
    startingWeightGuide: 'ابدأ بوزن الجسم ومع دعم خفيف من الحائط. نفذ 6-8 عدات لكل رجل.'
  },
  {
    id: 'pike-push-up', nameAr: 'ضغط كتف بايك', muscle: 'الكتف', secondaryMuscles: ['الترايسبس'], equipment: 'وزن الجسم', difficulty: 'متوسط', movement: 'push', places: ['home'], incrementKg: 0,
    instructions: ['ابدأ من وضع ضغط وارفع الحوض.', 'ضع الرأس بين الذراعين تقريبًا.', 'اثنِ الكوع وانزل الرأس نحو الأرض.', 'ادفع للعودة.'],
    formCues: ['الحوض مرتفع', 'التحكم أهم من العمق', 'الرقبة محايدة'], mistakes: ['تحويله لضغط صدر', 'هبوط سريع'], stopSignals: ['ألم حاد في الكتف أو الرقبة'], alternatives: ['incline-push-up'],
    startingWeightGuide: 'لو التمرين صعب، ابدأ بضغط مائل بدلًا منه. لا تستخدمه إلا إذا تقدر تعمل 6 عدات بتحكم.'
  },
  {
    id: 'backpack-rdl', nameAr: 'ديدلفت روماني بحقيبة', muscle: 'الخلفية', secondaryMuscles: ['المؤخرة', 'الظهر'], equipment: 'حقيبة ظهر', difficulty: 'مبتدئ', movement: 'hinge', places: ['home'], incrementKg: 1,
    recognitionTips: ['أغلق الحقيبة بإحكام', 'امسكها أمام الفخذين من المقبضين'],
    instructions: ['قف والركبتان مثنيتان قليلًا.', 'ادفع الحوض للخلف والحقيبة قريبة من الرجل.', 'انزل حتى تشعر بشد مريح خلف الفخذ.', 'ادفع الحوض للأمام للوقوف.'],
    formCues: ['الظهر محايد', 'الحركة من الورك', 'الحقيبة قريبة من الجسم'], mistakes: ['السكوات بدل حركة الورك', 'تدوير الظهر'], stopSignals: ['ألم حاد في أسفل الظهر'], alternatives: ['glute-bridge'],
    startingWeightGuide: 'ابدأ بحقيبة خفيفة جدًا أو فارغة لتعلم حركة الورك. أضف وزنًا فقط بعد 10 عدات ثابتة.'
  },
]

export const foods: FoodItem[] = [
  { id: 'chicken', nameAr: 'صدر دجاج مشوي', serving: '100 جم', calories: 165, protein: 31, carbs: 0, fats: 3.6, category: 'protein' },
  { id: 'rice', nameAr: 'أرز مطبوخ', serving: '100 جم', calories: 130, protein: 2.7, carbs: 28, fats: 0.3, category: 'carb' },
  { id: 'eggs', nameAr: 'بيض', serving: 'بيضة', calories: 72, protein: 6.3, carbs: 0.4, fats: 4.8, category: 'protein' },
  { id: 'oats', nameAr: 'شوفان', serving: '100 جم', calories: 389, protein: 16.9, carbs: 66, fats: 6.9, category: 'carb' },
  { id: 'milk', nameAr: 'لبن قليل الدسم', serving: '250 مل', calories: 110, protein: 8, carbs: 12, fats: 3, category: 'dairy' },
  { id: 'yogurt', nameAr: 'زبادي', serving: 'علبة', calories: 100, protein: 6, carbs: 12, fats: 3, category: 'dairy' },
  { id: 'banana', nameAr: 'موز', serving: 'ثمرة', calories: 105, protein: 1.3, carbs: 27, fats: 0.3, category: 'fruit' },
  { id: 'lentils', nameAr: 'عدس مطبوخ', serving: '100 جم', calories: 116, protein: 9, carbs: 20, fats: 0.4, category: 'meal' },
  { id: 'foul', nameAr: 'فول مدمس', serving: '100 جم', calories: 110, protein: 7.6, carbs: 19.7, fats: 0.4, category: 'meal' },
  { id: 'bread', nameAr: 'عيش بلدي', serving: 'رغيف', calories: 270, protein: 9, carbs: 54, fats: 1.7, category: 'carb' },
  { id: 'tuna', nameAr: 'تونة مصفاة', serving: '100 جم', calories: 132, protein: 29, carbs: 0, fats: 1, category: 'protein' },
  { id: 'cottage-cheese', nameAr: 'جبنة قريش', serving: '100 جم', calories: 100, protein: 12, carbs: 3, fats: 4, category: 'protein' },
  { id: 'potato', nameAr: 'بطاطس مسلوقة', serving: '200 جم', calories: 174, protein: 4, carbs: 40, fats: 0.2, category: 'carb' },
  { id: 'olive-oil', nameAr: 'زيت زيتون', serving: 'ملعقة', calories: 119, protein: 0, carbs: 0, fats: 13.5, category: 'fat' },
]
