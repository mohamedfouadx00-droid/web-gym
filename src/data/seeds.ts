import type {Exercise,FoodItem} from '../domain/models'
export const exercises:Exercise[]=[
{id:'bench',nameAr:'ضغط صدر بالبار',muscle:'الصدر',secondaryMuscles:['الترايسبس','الكتف الأمامي'],equipment:'بار',difficulty:'متوسط',instructions:['ثبت قدميك','اخفض البار لمنتصف الصدر','ادفع بثبات'],mistakes:['رفع الحوض','فتح الكوع أكثر من اللازم'],alternatives:['push-up']},
{id:'squat',nameAr:'سكوات بالبار',muscle:'الأرجل',secondaryMuscles:['المؤخرة'],equipment:'بار',difficulty:'متوسط',instructions:['ثبت الجذع','انزل بتحكم','ادفع الأرض'],mistakes:['انهيار الركبتين','تقويس الظهر'],alternatives:['leg-press']},
{id:'deadlift',nameAr:'ديدلفت',muscle:'الخلفية',secondaryMuscles:['الظهر','المؤخرة'],equipment:'بار',difficulty:'متقدم',instructions:['قرب البار','شد الجذع','قف بالورك والركبتين'],mistakes:['تدوير الظهر'],alternatives:['rdl']},
{id:'lat',nameAr:'سحب أمامي',muscle:'الظهر',secondaryMuscles:['البايسبس'],equipment:'كابل',difficulty:'مبتدئ',instructions:['اسحب للصدر','ثبت الكتفين','عد ببطء'],mistakes:['السحب خلف الرقبة'],alternatives:['row']},
{id:'ohp',nameAr:'ضغط كتف',muscle:'الكتف',secondaryMuscles:['الترايسبس'],equipment:'دمبل',difficulty:'متوسط',instructions:['ثبت الجذع','ادفع لأعلى','انزل بتحكم'],mistakes:['تقويس الظهر'],alternatives:['machine-press']},
{id:'row',nameAr:'تجديف بالبار',muscle:'الظهر',secondaryMuscles:['البايسبس'],equipment:'بار',difficulty:'متوسط',instructions:['ميل الجذع','اسحب للبطن','ثبت الظهر'],mistakes:['التأرجح'],alternatives:['lat']},
{id:'curl',nameAr:'بايسبس دمبل',muscle:'البايسبس',secondaryMuscles:[],equipment:'دمبل',difficulty:'مبتدئ',instructions:['ثبت الكوع','ارفع بتحكم','اخفض ببطء'],mistakes:['التأرجح'],alternatives:['hammer-curl']},
{id:'tri',nameAr:'ترايسبس كابل',muscle:'الترايسبس',secondaryMuscles:[],equipment:'كابل',difficulty:'مبتدئ',instructions:['ثبت الكوع','مد الذراع','عد ببطء'],mistakes:['تحريك الكتف'],alternatives:['dips']},
{id:'legpress',nameAr:'ضغط الأرجل',muscle:'الأرجل',secondaryMuscles:['المؤخرة'],equipment:'جهاز',difficulty:'مبتدئ',instructions:['ثبت الظهر','انزل بمدى مناسب','ادفع دون قفل الركبة'],mistakes:['رفع الحوض'],alternatives:['squat']},
{id:'pushup',nameAr:'ضغط أرضي',muscle:'الصدر',secondaryMuscles:['الترايسبس','الكتف'],equipment:'وزن الجسم',difficulty:'مبتدئ',instructions:['جسم مستقيم','انزل بتحكم','ادفع الأرض'],mistakes:['هبوط الحوض'],alternatives:['bench']}
]
export const foods:FoodItem[]=[
{id:'chicken',nameAr:'صدر دجاج مشوي',serving:'100 جم',calories:165,protein:31,carbs:0,fats:3.6},
{id:'rice',nameAr:'أرز مطبوخ',serving:'100 جم',calories:130,protein:2.7,carbs:28,fats:.3},
{id:'eggs',nameAr:'بيض',serving:'بيضة',calories:72,protein:6.3,carbs:.4,fats:4.8},
{id:'oats',nameAr:'شوفان',serving:'100 جم',calories:389,protein:16.9,carbs:66,fats:6.9},
{id:'milk',nameAr:'لبن قليل الدسم',serving:'250 مل',calories:110,protein:8,carbs:12,fats:3},
{id:'banana',nameAr:'موز',serving:'ثمرة',calories:105,protein:1.3,carbs:27,fats:.3},
{id:'lentils',nameAr:'عدس مطبوخ',serving:'100 جم',calories:116,protein:9,carbs:20,fats:.4},
{id:'foul',nameAr:'فول مدمس',serving:'100 جم',calories:110,protein:7.6,carbs:19.7,fats:.4},
{id:'bread',nameAr:'عيش بلدي',serving:'رغيف',calories:270,protein:9,carbs:54,fats:1.7},
{id:'tuna',nameAr:'تونة مصفاة',serving:'100 جم',calories:132,protein:29,carbs:0,fats:1}
]
