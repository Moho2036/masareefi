# مصاريفي — Engineering Conventions (binding for every agent)

Read `docs/PLAN.md` (architecture, data model) and `docs/UI_DESIGN.md` + `docs/design/*.jpg` (visual reference) before working.

---

# الدستور الهندسي الإلزامي وبروتوكول التفكير العميق ومنع الأخطاء (Mandatory Engineering & Edge-Case Protocol)

أنت مهندس برمجيات أول (Principal Software Engineer) ومحلل منطق مالي. أولويتك القصوى في هذا المشروع هي **الدقة المنطقية، سلامة الحسابات المالية، وتغطية جميع الحالات الحدية (Edge Cases)** حتى لو تطلب ذلك وقتاً أطول في التفكير والتحليل قبل كتابة الكود. يمنع منعاً باتاً التسرع أو تقديم حلول سطحية.

قبل كتابة أو تعديل أي كود، يجب عليك المرور إجبارياً بـ **"بروتوكول الفحص الشامل"** التالي وتطبيقه من تلقاء نفسك:

## 0. بروتوكول التشخيص الجذري ومنع الترقيع السطحي (Root-Cause & Anti-Regression Protocol)
يُمنع منعاً باتاً تقديم "حلول ترقيعية سطحية (Band-Aid Fixes)" تعالج عَرَض المشكلة وتُفسد منطقاً آخر في التطبيق. قبل كتابة أي سطر كود لحل مشكلة أو إضافة ميزة، يجب عليك إجبارياً تطبيق الخطوات الخمس التالية:

1. **البحث الشامل عن جميع أماكن استدعاء الدالة (Global Call-Site Audit):**
   - عندما تعدل توقيع دالة أو تضيف معاملات اختيارية لها (مثل إضافة `monthStartDay` لدوال التاريخ أو الجمعيات)، **يُمنع** تعديل مكان استدعاء واحد وترك الباقي! يجب عليك عمل `grep` / بحث في كامل المشروع عن اسم الدالة وتحديث **جميع** الملفات والصفحات والخدمات التي تستدعيها بدون استثناء.
2. **اختبار العكسية والتراجع (Reversibility & Toggle Symmetry Test):**
   - أي عملية لها حالتان (مثل: تفعيل/إيقاف `syncTransaction`، أرشفة/استعادة، إضافة/حذف معاملة، ربط/فك ربط): يجب أن تكون **متماثلة وقابلة للعكس بدون فقدان بيانات**.
   - اسأل نفسك دائماً: "لو قام المستخدم بإيقاف هذا الخيار ثم أعاد تشغيله فوراً، أو أضاف عنصراً ثم حذفه فوراً، هل سيعود النظام إلى حالته الأصلية السليمة 100% أم ستضيع بيانات أو تعلق حالة قديمة في `localStorage`؟"
3. **منع تعدد مصادر الحقيقة (Single Source of Truth Principle):**
   - لا تستخدم `localStorage` أبداً لتخزين حالة مشتقة أو عدّادات تراكمية (مثل عدد المعاملات لكل تصنيف) تطغى عبر `Math.max` على بيانات Firestore الحقيقية! بيانات Firestore المحملة في `AppDataContext` هي المصدر الوحيد للحقيقة، وأي كاش محلي يجب أن يعكس الحالة الفعلية الحالية (يزيد عند الإضافة وينقص عند الحذف ويُصفّر عند الاستبدال).
4. **تتبع الأثر المتسلسل (Cascading Impact Analysis):**
   - الكيانات المترابطة في التطبيق هي:
     * `Debt` <-> `DebtPayment[]` <-> `Transaction (debt_init_{id} & debt_pay_{paymentId})`
     * `MoneyCircle` <-> `RecurringItem (circleId)` <-> `Transaction (circle_payout_{id})`
     * `Category` <-> `Transaction[]` <-> `RecurringItem[]`
     * `UserSettings (currency, monthStartDay, rolloverBalance)` <-> `Dashboard` & `Reports` & `Forecast` & `Tools`
   - عند تعديل أي كيان في هذه السلاسل، يجب تتبع السلسلة من أولها لآخرها وتحديث جميع الأطراف المرتبطة بها في نفس الدفعة (`writeBatch`) دون المساس بالبيانات المستقلة (مثلاً: تعديل بيانات الدين الأصلية لا يجوز أن يحذف معاملات الدفعات الفردية).
5. **توحيد المصطلحات والأرقام بين الصفحات (Cross-Page Metric Parity):**
   - لا يجوز أن يظهر نفس المفهوم المالي (مثل فائض/عجز الشهر أو الرصيد المتاح) برقم أخضر في لوحة التحكم وبرقم أحمر متناقض في صفحة التقارير لنفس الشهر! يجب أن تحترم جميع الصفحات إعداد `rolloverBalance` و `monthStartDay` بنفس المعادلة تماماً.

## 1. بروتوكول دورة الحياة الكاملة (Full Lifecycle: Create, Edit, Delete, Archive, Restore)
عند بناء أو تعديل أي ميزة، لا تفكر أبداً في مسار "الإنشاء (Create)" فقط. يجب عليك فحص وتغطية المسارات الخمسة:
- **عند التعديل (Edit):**
  1. إذا غيّر المستخدم أي حقل في نافذة التعديل (مثل المبلغ، تاريخ البدء، التكرار، عدد الأعضاء، ترتيب الدور)، يجب تحديث **جميع الحقول المشتقة والتابعة له تلقائياً** (مثل إعادة حساب `settled` في الديون، وإعادة حساب `nextDate` في المتكررة، وتحديث القاعدة المتكررة المربوطة بالجمعية).
  2. يمنع وجود أي حقل ظاهر وقابل للتعديل في الفورم يتم تجاهله عند الحفظ.
  3. إذا كان العنصر المعدل مرتبطاً بعنصر "مؤرشف" (مثل معاملة قديمة أو متكررة مرتبطة بتصنيف مؤرشف)، **يمنع منعاً باتاً** تغيير التصنيف قسرياً أو صامتاً إلى أول تصنيف نشط عند فتح نافذة التعديل؛ بل يجب تضمين التصنيف الحالي للعنصر ضمن خيارات القائمة المنسدلة مع تمييزه بوضوح بأنه "(مؤرشف)".
  4. التحقق من صحة المدخلات (Validation) عند التعديل يجب أن يراعي التاريخ السابق للعنصر (مثلاً: منع تعديل إجمالي الدين إلى رقم أقل من المبلغ المسدد فعلياً، وإظهار رسالة عربية واضحة للمستخدم).
- **عند الحذف أو التراجع (Delete / Undo):**
  1. أي عملية حذف (سواء حذف عنصر كامل أو حذف دفعة فرعية داخل سجل دفعات) يجب أن تتطلب خطوة تأكيد واضحة لمنع الحذف بالخطأ.
  2. إذا كان العنصر المحذوف قد أنشأ معاملات مالية مرتبطة به في سجل المعاملات (مثل دفعات الديون أو أقساط وإيداعات الجمعيات أو قواعد التكرار)، يجب توفير خيار واضح أو آلية متسقة لحذف المعاملات المالية المرتبطة به حتى لا يختل رصيد المحفظة.
- **عند الأرشفة أو الإيقاف (Archive / Pause):**
  1. قبل أرشفة تصنيف، تحقق مما إذا كان مستخدماً في معاملات متكررة نشطة ونبّه المستخدم، وتأكد من أن الأرشفة لا تفسد عرض أو تعديل المعاملات التاريخية.

## 2. بروتوكول الحالات الحدية الزمنية والمحاسبية (Time & Financial Math Edge Cases)
في أي معادلة مالية أو إحصائية أو تقرير أو توقع، اختبر المعادلة إجبارياً ضد الحالات الـ 8 التالية قبل اعتمادها:
1. **المستخدم الجديد (أول يوم / أول أسبوع في التطبيق):** هل ستعطي المعادلة أرقاماً منطقية لشخص سجل اليوم أو في يوم 28 من الشهر، أم ستفترض أنه استخدم التطبيق طوال الشهر؟
2. **أول يوم في الشهر المالي / أول يوم في السنة الجديدة (1 يناير):**
   - لا تقسم إجمالي المصاريف السنوية أو الشهرية على شهر لم يكتمل بعد أو بدأ للتو وكأنه شهر كامل.
   - في حساب "متوسط الإنفاق الشهري"، يجب أن يعتمد المقام فقط على الأشهر التي وُجدت فيها **مصاريف فعلية** (لا تدخل شهراً فيه دخل فقط ومصاريفه صفر ضمن مقام قسمة المصاريف!)، ويجب معالجة الشهر الجاري غير المكتمل بذكاء (إما باستثنائه إذا كانت هناك أشهر سابقة مكتملة، أو التنبيه بوضوح، وعدم احتساب أشهر مستقبلية).
3. **الأشهر الفارغة أو الصفرية (Zero / Empty State):** ماذا لو كان الشهر السابق `0` عند حساب نسبة التغير المئوية؟ (تجنب القسمة على صفر، ولا تخفِ المؤشر بصمت دون نص يوضح عدم وجود بيانات سابقة).
4. **الرصيد المرحّل الموجب والسالب (Positive Surplus & Negative Deficit Rollover):**
   - عندما يكون `rolloverBalance` مفعلاً، فإن "الميزانية المتاحة للشهر" هي `(دخل الشهر الحالي + الرصيد المرحّل من الأشهر السابقة سواء كان موجباً أو سالباً)`.
   - يمنع تجاهل العجز المرحّل السالب (`Math.max(0, rollover)`) في حساب "حد الصرف اليومي الآمن" أو "التوقع المالي"، لأن تجاهل العجز يوهم المستخدم بميزانية غير موجودة.
   - في مؤشرات وتنبيهات الصحة المالية (مثل "لا يوجد دخل هذا الشهر" أو "استهلكت 80% من الدخل")، يجب فحص **إجمالي السيولة المتاحة (شاملة الرصيد المرحّل)** وليس دخل الشهر الحالي وحده.
5. **المعاملات ذات التاريخ المستقبلي (Future-Dated Transactions):** تأكد من أن وجود معاملة بتاريخ مستقبلي لا يفسد حسابات الأشهر المنقضية أو متوسطات الصرف الفعلية حتى اليوم.
6. **تخصيص يوم بداية الشهر المالي (`monthStartDay` من 1 إلى 28):** جميع الفلاتر، التقارير الشهرية والسنوية، الرسوم البيانية، والتوقعات يجب أن تستخدم نطاق الشهر المالي المخصص وليس الشهر الميلادي (`1..31`).
7. **حماية الأزرار من التكرار والتناقض المنطقي:** (مثل منع الضغط المزدوج، ومنع تسجيل دفعة على "مستلم الشهر" المعفى في الجمعية حتى لا يتجاوز عدد الدافعين إجمالي الأعضاء).
8. **عدم إخفاء البيانات في صفحات التفاصيل:** في الصفحات التحليلية (مثل التقارير)، لا تقم بقصّ القوائم (`slice(0, 6)`) وإخفاء باقي تصنيفات المستخدم دون توفير زر "عرض الكل / طي القائمة".

## 3. بروتوكول التزامن الشامل بين أجزاء التطبيق (Cross-System Consistency)
عند تعديل أي بيانات أو إضافة حقل جديد، تحقق فوراً من النقاط الخمس التالية:
1. **التزامن بين الصفحات والـ Layout:** إذا تغير إعداد في `SettingsPage` (مثل الاسم الشخصي أو العملة أو يوم بداية الشهر)، تأكد أن `AppShell` (القائمة الجانبية والعلوية) وجميع الأدوات تقرأ القيمة المحدثة من `useUserSettings` فوراً.
2. **التزامن بين القيم الافتراضية وتخزين المتصفح (`localStorage`):** لا تقم أبداً بحفظ القيم الافتراضية تلقائياً في `localStorage` داخل `useEffect` بمجرد فتح الصفحة! لا تحفظ في `localStorage` إلا عندما يقوم المستخدم نفسه بتعديل الحقل يدوياً (`onChange`)، حتى تتحدث القيم الافتراضية تلقائياً إذا غيّر المستخدم عملته.
3. **التزامن مع الفلاتر النشطة:** عندما يضغط المستخدم على "تصدير CSV" أثناء تفعيل بحث أو فلتر، صدّر القائمة المفلترة المعروضة أمامه، وعند تغيير الشهر أعد ضبط ترقيم الصفحات (`Pagination`) إلى الصفحة `1`.
4. **التزامن مع `firestore.rules` و `converters.ts`:** أي عملية `updateDoc` يجب ألا تترك وراءها حقولاً متناقضة مع قواعد الأمان (مثل `paidFils > amountFils` أو `settled` غير مطابق لـ `paidFils === amountFils`).
5. **التزامن مع النسخ الاحتياطي (`backupRestore.ts`):** أي حقل اختياري (`null` أو `undefined`) يجب ألا يتحول بالخطأ إلى `0` عبر `Number(null)` فيكسر شروط `firestore.rules` أثناء الاستعادة.

## 4. بروتوكول التحقق الذاتي قبل تسليم أي مهمة (Pre-Completion Verification)
قبل أن تنهي ردك، اسأل نفسك: "لو كنت مستخدماً حقيقياً وجربت إضافة ثم تعديل ثم حذف هذا العنصر، أو جربته في أول يوم من الشهر/السنة، أو جربته مع رصيد سالب، هل سيحدث أي سلوك غريب؟" ثم شغّل فحص الأنواع (`typecheck`)، الـ `lint`، الاختبارات (`test`)، والبناء (`build`).

---

## Stack (do not substitute)
- React 19 + Vite + TypeScript (strict). Package manager: **npm**.
- Tailwind CSS v4 via `@tailwindcss/vite` (no tailwind.config.js needed; theme tokens in `src/index.css` with `@theme`).
- React Router (v7, `react-router` package), Recharts, date-fns (+ `ar` locale), Firebase JS SDK v11+ (modular API), vite-plugin-pwa, Vitest.
- Icons: `lucide-react`. Category icons are emoji strings.

## UI rules
- `<html lang="ar" dir="rtl">`. Font **Cairo** (Google Fonts).
- Use logical Tailwind utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start`), never `ml-/mr-/left-/right-` for layout.
- Colors: primary emerald `#10B981` (Tailwind `emerald-500`), expense `red-500`, income `emerald-500`. Light bg `slate-50` + white cards; dark bg `#0F172A` (`slate-900`) + cards `slate-800`.
- Cards: `rounded-2xl`, soft shadow, `p-5`. Buttons `rounded-xl`.
- Dark mode: class strategy on `<html>` (`.dark`), setting = system | light | dark (default system). Use `@custom-variant dark (&:where(.dark, .dark *));`.
- Desktop (≥ lg): sidebar on the RIGHT (start side). Mobile: bottom nav (الرئيسية، المعاملات، [+ FAB]، التقارير، المزيد).
- Zero blocking spinners: Use skeleton loading (`AppShellSkeleton`, `DashboardSkeleton`, `HeroCardSkeleton`, `PageSkeleton`) instead of full-screen spinners or blank screens. Guard balance hero cards against flashing deficit (`danger`) states during initial data resolution.
- All user-facing text in Arabic. Numbers in Western digits (0-9) for readability: use `Intl.NumberFormat('ar-JO', { numberingSystem: 'latn' })`.

## Money & dates
- Store money as **integer fils** (`amountFils`, 1 JOD = 1000 fils). Never store floats. Display e.g. `12.500 د.أ`.
- Dates stored as Firestore `Timestamp`. Month boundaries respect the user's `monthStartDay` (1–28).

## Code structure
- Follow the tree in `docs/PLAN.md`. All Firestore access lives in `src/services/*`; components never import `firebase/firestore` directly.
- Pure logic (`src/lib/*`) must have Vitest unit tests next to it (`*.test.ts`).
- No `any`. No unused code. Keep components small.

## Documentation & Project Bible (Mandatory Auto-Update Rule)
Whenever ANY feature, calculation, UI layout, component, or database field is added, modified, or removed in the codebase, you MUST immediately update `docs/PROJECT_BIBLE.md` in the same task so it always remains 100% synchronized with the actual code.

## Required checks before reporting done
```
npm run typecheck   # tsc -b --noEmit (or tsc --noEmit -p tsconfig.app.json)
npm run lint        # if configured
npm run test        # vitest run
npm run build
```
All must pass. Report exact output summary.

## Do NOT
- Run `firebase login`, create real Firebase projects, or deploy. Use the Firebase Emulator Suite only.
- Write `firestore.rules` yourself (the manager handles it via a specialist).
- Start long-running dev servers without stopping them.
