# تقرير فحص ومراجعة الواجهة وتجربة المستخدم (UI/UX) — الشاشة الثانية: سجل المعاملات والفلاتر والنماذج
> **Swiss Carbon & Sapphire Clarity — UI/UX Comprehensive Quality Assurance Report**  
> **نطاق الفحص:** سجل المعاملات اليومي، شريط وأدوات الفلترة والبحث، الترقيم (Pagination)، نموذج إضافة وتعديل وتكرار المعاملة، منتقي التاريخ السويسري المخصص، ومنتقي القوائم المخصص، ونوافذ الحذف والتأكيد.

---

## بطاقة الفحص المرجعي (Audit Metadata)
* **الشاشة المفحوصة:** الشاشة الثانية — سجل المعاملات والفلاتر والنماذج (`Transactions & Filters`)
* **الملفات والمكونات المعنية:**
  - `src/pages/TransactionsPage.tsx`
  - `src/components/TransactionForm.tsx`
  - `src/components/ui/DatePickerInput.tsx`
  - `src/components/ui/Select.tsx`
  - `src/hooks/useTransactionModal.tsx`
  - `src/components/CategoryForm.tsx` (المودال الفرعي المنبثق من النموذج)
  - `src/components/ui/Modal.tsx`
  - `src/components/ui/EmptyState.tsx`
  - `src/components/ui/FormattedMoney.tsx`
* **المرجعيات التصميمية والهندسية الإلزامية:**
  - `DESIGN_SYSTEM.md` (الدستور البصري الشامل ولغة التصميم السويسرية والمحرمات البصرية الـ 13).
  - `AGENTS.md` (البروتوكول الهندسي الإلزامي ومنع الترقيع السطحي والحالات الحدية).
  - التقرير المنطقي والمالي السابق: `docs/qa-reports/02_transactions_and_filters.md`.
* **تاريخ المراجعة:** نوفمبر 2026
* **مستوى الالتزام العام بالدستور البصري:** **76%** (واجهة أنيقة في الأساس ولكن تعاني من عدة خروقات صريحة للمحرمات البصرية [TABOO-01], [TABOO-03], [TABOO-05], [TABOO-08], [TABOO-13]، وتشوهات ملحوظة على شاشات الهواتف المحمولة وقصور في سهولة الوصول a11y).

---

## جدول الملخص التنفيذي للملاحظات المرصودة

| الرقم | المكون / الملف | موضوع الملاحظة | التصنيف | المحرمات / القواعد المرتبطة | الأثر ودرجة الأهمية |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | `TransactionsPage.tsx` | صندوق الفلترة المخصصة المتداخل داخل بطاقة الفلاتر | بصري / هيكلي | `[TABOO-01]` No Box-in-Box | **عالية** (ازدحام إطارات) |
| **1.2** | `TransactionForm.tsx` | لافتات التحذير الكهرمانية والزرقاء المتداخلة داخل المودال | بصري / لوني | `[TABOO-01]`, `[TABOO-03]` | **حرجة** (تعدد الصناديق والألوان) |
| **1.3** | `TransactionsPage.tsx` & `TransactionForm.tsx` | استخدام ألوان دلالية (كهرماني) في الأزرار والشارات التفاعلية | نظام الألوان | `[TABOO-03]` No Color Carnival | **حرجة** (كسر النقاء السويسري) |
| **1.4** | متعدد (`Page`, `Form`, `Select`, `DatePicker`) | غياب `dark:shadow-none` وبقاء ظلال الوضع الفاتح في الداكن | الوضع الداكن | `[TABOO-05]` Borders Over Shadows | **متوسطة** (تشوه النقاء الكربوني) |
| **1.5** | `TransactionsPage.tsx` & `TransactionForm.tsx` | حشو نصي وشروح وعظية بديهية مفرطة في اللافتات والمفاتيح | صياغة وتجربة | `[TABOO-08]` No AI Verbosity | **متوسطة** (إهدار مساحة الشاشة) |
| **1.6** | `TransactionForm.tsx` | استخدام مربع اختيار أصلي للمتصفح (`input[type=checkbox]`) | مكونات قياسية | `[TABOO-13]` Strict Ban on Native Pickers | **عالية** (كسر التوحيد البصري) |
| **1.7** | `TransactionForm.tsx` | تضارب استدارة حواف حقل إدخال المبلغ (`rounded-2xl` بدلاً من `xl`) | نظام الحواف | الباب الرابع (4.2 Border Radius) | **منخفضة** (نشاز بصري طفيف) |
| **1.8** | `TransactionForm.tsx` | تباين نسبة شفافية حاوية أيقونة التصنيف (`25` مقابل `20`) | نظام الألوان | الباب الأول (1.2 Opacity Rules) | **منخفضة** (عدم اتساق لوني) |
| **2.1** | `TransactionsPage.tsx` | تكدس 3 أزرار سريعة متناهية الصغر في سطور المعاملات على الهاتف | تجاوبية / لمس | الباب الرابع (4.1 Touch Ergonomics) | **حرجة** (بتر النصوص ونقرات خاطئة) |
| **2.2** | `TransactionsPage.tsx` | اختناق وانقطاع الشريط الجانبي المثبت (`Sticky Sidebar`) عند التوسيع | تخطيط شبكي | الباب الرابع (4.4 Responsive Grids) | **حرجة** (احتجاب الإجماليات خارج الشاشة) |
| **2.3** | `TransactionsPage.tsx` | استخدام كلاس غير معرف `scrollbar-none` بدلاً من `.no-scrollbar` | مظهر وأشرطة تمرير | الباب الرابع (4.5 Scrollbars) | **عالية** (ظهور سكرولبار قبيح للمتصفح) |
| **2.4** | `DatePickerInput.tsx` | انبثاق تقويم "إلى تاريخ" وتجاوزه لحدود الشريط الجانبي والشاشة | تخطيط ونوافذ منبثقة | الباب السادس (6.1 Component Blueprints) | **عالية** (تراكب بصري مشوه) |
| **2.5** | `DatePickerInput.tsx` | تكرار أزرار "اليوم" و "أمس" السريعة مرتين في نفس المكون | تجربة مستخدم | الباب السادس (6.1 Component Blueprints) | **منخفضة** (تكرار إجرائي غير مبرر) |
| **2.6** | `TransactionForm.tsx` | انكسار والتفاف أزرار الإجراءات السفلية للمودال على الهواتف الضيقة | تجاوبية الهواتف | الباب الرابع (4.1 Spacing & Layout) | **متوسطة** (تشوه التذييل الثابت) |
| **2.7** | `TransactionsPage.tsx` & `Select.tsx` | تضارب ارتفاع زر الترتيب (`h-9` مقابل `h-11`) لغياب tailwind-merge | مقاييس موحدة | الباب الرابع (4.1 Input Heights) | **متوسطة** (كسر مقياس 44px) |
| **2.8** | `TransactionForm.tsx` | تلوين مؤشر "حد الصرف اليومي الآمن" بالأخضر حتى لو كان صفراً أو سالباً | أمانة مالية وبصرية | الباب الأول (1.2 Color Usage) | **حرجة** (تضليل مالي خطر) |
| **2.9** | `TransactionsPage.tsx` | حجم أيقونة الحالة الفارغة (`EmptyState`) متضخم بالنسبة لحاويتها | مقاييس الأيقونات | الباب الثالث (3.2 Icon System) | **منخفضة** (اختناق الأيقونة) |
| **2.10** | `TransactionForm.tsx` | استحالة طي حقل الملاحظة التفصيلية بعد النقر على إظهاره | تجربة مستخدم | الباب السادس (6.1 Input Form Design) | **منخفضة** (جمود الواجهة) |
| **3.1** | `TransactionsPage.tsx` | سطر المعاملة يفتقر لسمات الزر وسهولة الوصول ولوحة المفاتيح | إتاحة (a11y) | WCAG 2.1 AA (Keyboard Accessible) | **عالية** (عجز مستخدمي الكيبورد) |
| **3.2** | `TransactionsPage.tsx` | أزرار فلاتر المصدر والتصنيفات تفتقر لخاصية `aria-pressed` | إتاحة (a11y) | WCAG 2.1 AA (Name, Role, Value) | **عالية** (عمى قارئات الشاشة) |
| **3.3** | `TransactionsPage.tsx` | حقل البحث الرئيسي بدون تسمية يمكن الوصول إليها (Missing Accessible Name) | إتاحة (a11y) | WCAG 2.1 AA (Form Labels) | **متوسطة** (الاعتماد الحصري على placeholder) |
| **3.4** | `TransactionsPage.tsx` | زرا فتح البحث والفلاتر بالموبايل يفتقران لـ `aria-expanded` | إتاحة (a11y) | WCAG 2.1 AA (Expandable Controls) | **متوسطة** (غياب مؤشر الحالة) |
| **3.5** | `Select.tsx` & `DatePickerInput.tsx` | غياب التنقل بالأسهم وافتقار عناصر القائمة لخاصية `role="option"` | إتاحة (a11y) | WCAG 2.1 AA (Combobox / Listbox) | **عالية** (فشل التنقل بلوحة المفاتيح) |
| **3.6** | `TransactionForm.tsx` | مربع الاختيار الخاص بالتكرار بدون تسمية إتاحة (Unlabeled Input) | إتاحة (a11y) | WCAG 2.1 AA (Form Controls) | **متوسطة** (عنصر مجهول لقارئات الشاشة) |
| **4.1** | `TransactionsPage.tsx` | اختفاء بداية قائمة المعاملات خلف الترويسة المثبتة عند التنقل بين الصفحات | استقرار بصري | الباب الخامس `[TABOO-10]` Zero Jump | **عالية** (احتجاب المحتوى خلف الهيدر) |
| **4.2** | `TransactionsPage.tsx` | ظهور أزرار التعديل والحذف في مستندات الطباعة ومعاينة PDF | وضع الطباعة | الباب الرابع (4.4 Clean Print Layout) | **متوسطة** (تلوث بصري للتقرير المطبوع) |

---

## 1. مخالفات الدستور البصري والمحرمات الـ 13 (Design System & 13 Visual Taboos)

### 1.1 `[TABOO-01]` ظاهرة الصناديق المتداخلة (Box-in-Box) في شريط الفلاتر
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L808` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L971-L1002`.
- **الكود البرمجي الحالي:**
  ```tsx
  // البطاقة الحاوية الرئيسية للشريط الجانبي
  <div className="bg-white dark:bg-[#121215] p-3 sm:p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-3 print-hide">
    ...
    {isCustomDateRange && (
      // صندوق متداخل بإطار كامل وخلفية رمادية داخل البطاقة ذات الإطار!
      <div className="space-y-2 p-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
        <div className="grid grid-cols-2 gap-2">
          <DatePickerInput id="tx-custom-from" label="من تاريخ" ... />
          <DatePickerInput id="tx-custom-to" label="إلى تاريخ" ... />
        </div>
        ...
      </div>
    )}
  </div>
  ```
- **التشخيص البصري:** ينص الدستور البصري في المحرم الأول `[TABOO-01]` صراحة:
  > *"يُمنع وضع صندوق ذي إطار أو خلفية فرعية داخل بطاقة لتجميع الأرقام أو الحقول. البديل الإلزامي هو التقسيم السويسري بالخطوط الرفيعة (divide-x / divide-y) أو الحقول المباشرة."*
  وضع حاوية ذات إطار `border border-[#E4E4E7]` وخلفية غائرة داخل بطاقة الفلتر يخلق "صندوقاً داخل صندوق" مكدساً يرهق العين ويزيد سماكة الحدود المرئية.
- **الحل الجذري المقترح:** إزالة الإطار الخارجي والخلفية الفرعية المزدوجة، وعرض حقلي التاريخ مباشرة تحت زر "فترة مخصصة" مفصولين بمسافة منطقية فقط:
  ```tsx
  {isCustomDateRange && (
    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <div className="grid grid-cols-2 gap-2">
        <DatePickerInput id="tx-custom-from" label="من تاريخ" max={customDateTo || undefined} ... />
        <DatePickerInput id="tx-custom-to" label="إلى تاريخ" min={customDateFrom || undefined} ... />
      </div>
      ...
    </div>
  )}
  ```

---

### 1.2 `[TABOO-01]` و `[TABOO-03]` لافتات وصناديق التنبيه المتداخلة ذات الألوان الفاقعة داخل النوافذ المنبثقة
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L985-L1088` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1220-L1231`.
- **الكود البرمجي الحالي:**
  ```tsx
  // نافذة المودال نفسها عبارة عن سطح أبيض/كربوني rounded-2xl بإطار وظل
  // بداخلها تم حشو صناديق تنبيه كاملة rounded-2xl بإطارات ملونة سميكة:
  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs space-y-2">
  <div className="mb-2 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
  ```
- **التشخيص البصري:** هذه اللافتات تشكل صناديق ضخمة مغلقة تحتل نصف ارتفاع النافذة المنبثقة بحواف `rounded-2xl` تحاكي إطار النافذة نفسها، وتستخدم درجات لونية فاقعة ذات حدود صفراء وزرقاء سميكة (`border-amber-300`) تخالف الطراز السويسري الهادئ (Swiss Minimalist Strip).
- **الحل الجذري المقترح:** تحويل اللافتات إلى خطوط إرشادية سويسرية مفتوحة مندمجة في الصفحة عبر خط جانبي دقيق `border-s-2` بدون حواف `rounded-2xl` دائرية ضخمة وبدون خلفيات ملونة فاقعة:
  ```tsx
  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1">
    <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>معاملة مرتبطة بسجل الديون</span>
    </div>
    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
      لتعديل أصل الدين أو حذفه يرجى الانتقال إلى صفحة الديون.
    </p>
  </div>
  ```

---

### 1.3 `[TABOO-03]` استخدام ألوان دلالية (كهرماني) في الأزرار والشارات التفاعلية
- **الموقع في الكود:**
  - `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L716-L720`
  - `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L863-L866`
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1002-L1006` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1024-L1028`
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1227-L1229`
- **الكود البرمجي الحالي:**
  ```tsx
  // 1. زر الانتقال لسجل الدين في سطر المعاملة:
  className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"

  // 2. شارة عدد الفلاتر في أيقونة الموبايل:
  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
    {activeAdvancedFiltersCount}
  </span>

  // 3. أزرار الانتقال داخل نموذج المعاملة:
  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"

  // 4. شارة التصنيف المفقود:
  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/60 shrink-0">تصنيف مفقود</span>
  ```
- **التشخيص البصري:** الباب الأول في الدستور البصري (البند 1.2):
  > *"يُحظر حظراً باتاً استخدام الأخضر أو الأحمر أو الكهرماني في: أزرار الإجراءات الاعتيادية (مثل زر تسجيل دفعة، أو زر إرسال عبر واتساب، أو زر الانتقال)، وخلفيات الشارات والأفاتار ومربعات الأيقونات... الألوان الدلالية مخصصة حصرياً لنصوص الأرقام المالية ولخط الحالة العلوي h-1 ولأزرار الحذف النهائي danger ولتنبيهات alert الحرجة."*
  تلوين زر الانتقال للديون بلون كهرماني `bg-amber-600` وزر الإجراء السريع في القائمة بـ `text-amber-600` وشارة الفلاتر النشطة بـ `bg-amber-500` يخلق "مهرجان ألوان" غير مبرر يوهم المستخدم بوجود خطأ فادح بدلاً من توجيه انتباهه للأرقام المالية.
- **الحل الجذري المقترح:**
  - توحيد لون شارة الفلاتر لتكون زرقاء ياقوتية ملكية (`bg-blue-600 text-white`).
  - جعل أزرار الانتقال التوجيهية تعتمد خيار `variant="primary"` الياقوتي أو `variant="outline"` الرمادي النقي مع أيقونة زرقاء.
  - جعل شارة "تصنيف مفقود" رمادية محايدة مع علامة تحذير صفراء دقيقة: `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300`.

---

### 1.4 `[TABOO-05]` غياب `dark:shadow-none` وبقاء ظلال الوضع الفاتح في الوضع الداكن الكربوني
- **الموقع في الكود:**
  - `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L936` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L959` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1030` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1064` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1084`.
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1002` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1251` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1506`.
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L224` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L292`.
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/Select.tsx#L219`.
- **الكود البرمجي الحالي:**
  - `shadow-2xs` على الأزرار والشارات النشطة بدون `dark:shadow-none`.
  - `shadow-xl` على لوحة التقويم وقائمة `Select` بدون `dark:shadow-none`.
  - `shadow-lg` على القائمة الفرعية لدوريات التكرار بدون `dark:shadow-none`.
- **التشخيص البصري:** نص الدستور البصري في الباب الرابع (4.3):
  > *"في الوضع الداكن: انعدام تام للظلال (dark:shadow-none) على جميع البطاقات والأزرار والحقول، حيث يعتمد الفصل البصري في الوضع الداكن الكربوني على فرق الإضاءة والحدود الدقيقة #27272A فقط."*
  ترك `shadow-xl` و `shadow-2xs` نشطة في الوضع الداكن ينشئ تدرجات رمادية باهتة متسخة تعكر صفاء الخلفية الكربونية `#09090B` وسياج الكروت `#121215`.
- **الحل الجذري المقترح:** إلحاق كل صنف ظل بصنف التعطيل في الداكن: `shadow-2xs dark:shadow-none` و `shadow-xl dark:shadow-none` و `shadow-xs dark:shadow-none`.

---

### 1.5 `[TABOO-08]` الحشو النصي والشروح الوعظية البديهية المفرطة (AI Verbosity)
- **الموقع في الكود:**
  - `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1109-L1123`.
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L994-L998` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1054-L1056` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1311-L1316` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1543` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1558-L1560`.
- **الكود البرمجي الحالي:**
  ```tsx
  // 1. لافتة كل الأشهر:
  <div className="...">
    وضع <strong>البحث في كامل السجل (كل الأشهر)</strong> مفعّل حالياً. النتائج المعروضة وتصدير CSV يشملان كافة الأشهر. (التنقل بين الأشهر من الشريط العلوي سيعيدك تلقائياً لتصفح ذلك الشهر).
  </div>

  // 2. لافتة تغيير تاريخ التصفح:
  <p className="...">
    تم ضبط التاريخ تلقائياً على بداية الشهر المالي المتصفح حالياً ({formatDateInput(range.start)}). يمكنك تغييره بحرية.
  </p>

  // 3. وصف مفتاح الانتهاء:
  <Toggle label="تحديد تاريخ انتهاء للتكرار" description="يتوقف التكرار التلقائي بعد هذا التاريخ" />
  ```
- **التشخيص البصري:** ينص المحرم الثامن `[TABOO-08]` على:
  > *"يُمنع وضع لافتات شرح طويلة تحت عناوين الصفحات، أو كتابة جمل وعظية من سطرين تحت كل مفتاح Toggle... التوضيحات البديهية تهدر مساحة الشاشة وتوحي بضعف جودة التصميم."*
  تضمين 3 جمل كاملة لشرح وضع "كل الأشهر"، وإضافة جملة "يمكنك تغييره بحرية"، وتكرار شرح عنوان زر التبديل بعبارة "يتوقف التكرار بعد هذا التاريخ" كلها أسطر مكررة تستهلك الارتفاع العمودي المتاح على الشاشة دون جدوى.
- **الحل الجذري المقترح:**
  - اختصار لافتة كل الأشهر إلى سطر واحد سويسري مكثف: `"عرض كامل السجل التاريخي (كافة الأشهر) — [إلغاء]"`.
  - حذف جملة "يمكنك تغييره بحرية" والاكتفاء بـ `"التاريخ الافتراضي: بداية الشهر المتصفح"`.
  - إزالة `description` البديهي من مفتاح تاريخ الانتهاء.

---

### 1.6 `[TABOO-13]` استخدام مربع اختيار أصلي للمتصفح (`input[type=checkbox]`) داخل نموذج المعاملة
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1560-L1566`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-[#E4E4E7] dark:border-[#27272A] text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center justify-between gap-2">
    <span>تاريخ المعاملة في الماضي؛ سيتم تلقائياً جدولة الاستحقاق القادم من تاريخ اليوم.</span>
    <input
      type="checkbox"
      checked={scheduleNextIfPast}
      onChange={(e) => setScheduleNextIfPast(e.target.checked)}
      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
    />
  </div>
  ```
- **التشخيص البصري:** ينص المحرم الثالث عشر `[TABOO-13]` صراحة على:
  > *"حظر أدوات الاختيار والتقويم الافتراضية للمتصفح ونظام التشغيل؛ يجب استخدام المكونات المخصصة دائماً."*
  وجود عنصر HTML خام `<input type="checkbox">` بحجمه الافتراضي الصغير ومربعه التقليدي بجانب مكونات `<Toggle>` المصقولة في نفس الشاشة يشكل شذوذاً بصرياً وتراجعاً في تجربة المستخدم ومساحة اللمس.
- **الحل الجذري المقترح:** استبدال مربع الاختيار بمكون `<Toggle>` المعتمد أو بمفتاح تبديل سويسري مصقول.

---

### 1.7 تضارب استدارة حواف حقل إدخال المبلغ (`rounded-2xl` بدلاً من `rounded-xl`)
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1109`.
- **الكود البرمجي الحالي:** `<div className="... px-4 py-3 bg-zinc-50 dark:bg-zinc-900/70 rounded-2xl border ...">`
- **التشخيص البصري:** نص الباب الرابع (4.2 في هرمية الاستدارة):
  > *"rounded-xl (12px): لجميع حقول الإدخال (Input, Select, DatePickerInput)، والأزرار القياسية. rounded-2xl مخصصة حصرياً للبطاقات والمودال."*
  منح حقل المبلغ استدارة `rounded-2xl` بينما حقل التاريخ والوصف والملاحظة والأزرار تستخدم `rounded-xl` يخل بتجانس الحقول الرأسية داخل نفس النموذج.
- **الحل الجذري المقترح:** تعديل الصنف إلى `rounded-xl`.

---

### 1.8 تباين نسبة شفافية حاوية أيقونة التصنيف بين الشاشات والنماذج
- **الموقع في الكود:**
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1257`: `${cat.color}25` (~14.5%).
  - `file:///c:/Users/mohan/Desktop/expenses1/src/components/CategoryForm.tsx#L203` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/CategoryForm.tsx#L233`: `${color}1F` (~12.15%).
  - `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L586`: `${color}20` (12.5%).
- **التشخيص البصري:** الباب الأول (1.2، البند 4 في الشفافية والتباين) يحدد بدقة هندسية:
  > *"خلفية أيقونة التصنيف المخصص: تأخذ لون التصنيف الست عشري بشفافية 12.5% فقط (${color}20 في النظام الست عشري)."*
- **الحل الجذري المقترح:** توحيد جميع الحاويات عبر المشروع لتستخدم اللاحقة `${color}20`.

---

## 2. تجربة المستخدم والتجاوبية على الهواتف والشاشات الكبيرة (Responsive UI/UX & Touch Ergonomics)

### 2.1 تكدس 3 أزرار سريعة متناهية الصغر في سطور المعاملات على الهاتف
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L656-L756`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
    <button aria-label="تكرار المعاملة" className="p-1.5 rounded-lg text-zinc-400 ...">
      <Copy className="w-3.5 h-3.5" />
    </button>
    <button aria-label="تعديل المعاملة" className="p-1.5 rounded-lg text-zinc-400 ...">
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button aria-label="حذف المعاملة" className="p-1.5 rounded-lg text-zinc-400 ...">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
  ```
- **التشخيص الدقيق للأثر على الهاتف المحمول:**
  1. كلاس `sm:opacity-0` يعني أن الأزرار تكون **ظاهرة بشكل دائم على الموبايل (`< sm`) بشفافية 100%**!
  2. في كل سطر على شاشة هاتف بعرض 360px، يقتطع هذا الصف الثلاثي مع المبلغ المالي أكثر من **165 بكسل** من العرض الكلي، مما يحشر عنوان المعاملة والتصنيف والملاحظة في مساحة ضيقة جداً تؤدي لقص وبتر الكلمات وظهور نقاط الحذف (`...`).
  3. حجم كل زر هو `p-1.5` بأيقونة `14px`، أي مساحة لمس إجمالية **26×26 بكسل فقط**، مع تباعد خيطي `gap-0.5` (2 بكسل)! معايير الإتاحة العالمية ومسافات اللمس السويسرية تتطلب ألا تقل مساحة اللمس التفاعلية عن **40×40 بكسل إلى 44×44 بكسل**. هذا التقارب الشديد يؤدي إلى نقر زر الحذف الأحمر بالخطأ عند محاولة نقر زر التعديل أو التكرار!
  4. النقر على السطر في أي مكان يفتح بالفعل نافذة التعديل والتكرار والحذف؛ وبالتالي فإن فرض 3 أزرار مجهرية دائمة في كل سطر يلوث الشاشة بآلاف الأيقونات المتكررة دون مبرر.
- **الحل الجذري المقترح:**
  - إخفاء هذه الأزرار المباشرة على شاشات الهواتف (`hidden sm:flex`)، حيث يوفر النقر على السطر وصولاً سهلاً وكاملاً لكافة الإجراءات.
  - على أجهزة التابلت التي تعمل باللمس، توفير مساحة لمس كافية أو زر قائمة مصغر `...` بدلاً من الاعتماد على التحويم الفأري `hover` المفقود في الأجهزة اللوحية.

---

### 2.2 اختناق وانقطاع الشريط الجانبي المثبت (`Sticky Sidebar`) عند التوسيع
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L806-L808`.
- **الكود البرمجي الحالي:**
  ```tsx
  <aside className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-20 print-hide">
  ```
- **التشخيص الدقيق للأثر على الشاشات الكبيرة:**
  الشريط الجانبي مثبت في أعلى الشاشة (`lg:sticky lg:top-20`). عندما ينقر المستخدم على `عرض كل التصنيفات` (وتضم قائمته مثلاً 15–20 تصنيفاً)، أو يفتح لوحة "فترة مخصصة"، أو يفعل وضع "كل الأشهر" مع ظهور لافتة التنبيه وشريط الملخص، يتجاوز الارتفاع الرأسي للشريط الجانبي ارتفاع نافذة المتصفح (`100vh`).
  ونظراً لأن عنصر `<aside>` لا يمتلك حداً أقصى للارتفاع ولا شريط تمرير داخلي (`overflow-y-auto`)، فإن الجزء السفلي من الشريط الجانبي — وبشكل خاص **بطاقة إجمالي المداخيل والمصاريف السفلية (Totals Strip Card)** وباقي التصنيفات — يغوص تحت الحافة السفلية للشاشة ويصبح **مستحيلاً رؤيته أو الوصول إليه** أثناء التمرير في جدول المعاملات!
- **الحل الجذري المقترح:**
  إضافة حد أقصى للارتفاع مع شريط تمرير داخلي هادئ:
  ```tsx
  <aside className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar print-hide">
  ```

---

### 2.3 استخدام كلاس غير معرف `scrollbar-none` بدلاً من `.no-scrollbar` الدستوري
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1010` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1054`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 select-none text-xs scrollbar-none">
  ```
- **التشخيص الدقيق:**
  في ملف `src/index.css` (الأسطر 136–142) والدستور البصري (الباب الرابع 4.5)، تم تعريف صنف إخفاء شريط التمرير باسم `.no-scrollbar`:
  ```css
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  ```
  استخدام اسم مغاير وغير معرف `scrollbar-none` يجعل المتصفح يتجاهله تماماً، مما يؤدي إلى ظهور أشرطة تمرير أفقية رمادية سميكة وقبيحة تحت شرائح فلاتر "المصدر" و "التصنيفات" في متصفحات سطح المكتب (Chrome, Edge على ويندوز).
- **الحل الجذري المقترح:** استبدال `scrollbar-none` بـ `no-scrollbar` في كافة أشرطة الشرائح الأفقية.

---

### 2.4 تراكب ومحاذاة خاطئة لنافذة التقويم المنسدلة (DatePicker Popover) داخل شبكة الأعمدة المزدوجة
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L224` وموضعه في `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L973-L991`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="absolute start-0 top-[calc(100%+0.35rem)] z-50 w-72 sm:w-80 rounded-2xl ...">
  ```
- **التشخيص الدقيق:**
  حقل "إلى تاريخ" يقع في العمود الأيسر (الطرف النهائي في بيئة RTL) داخل شبكة `grid grid-cols-2` بعرض عمود يبلغ حوالي 140px. نافذة التقويم المنبثقة تحمل عرضاً ثابتاً `w-72` (288px) وتبدأ من محاذاة `start-0` (اليمين). ونتيجة لذلك، تنبثق النافذة من منتصف العمود وتتمدد نحو اليسار لتخرج تماماً عن حافة الشريط الجانبي وتتداخل مع المعاملات الرئيسية، وعلى الشاشات الصغيرة تخرج جزئياً خارج إطار الشاشة متسببة في سكرول عرضي غير مرغوب.
- **الحل الجذري المقترح:**
  إضافة خاصية توجيه المحاذاة `popoverAlign?: 'start' | 'end'` في `DatePickerInput.tsx`؛ ليكون محاذاة حقل "إلى تاريخ" هي `end-0` فيبقى التقويم منبثقاً للداخل ضمن حدود العمود والشريط الجانبي.

---

### 2.5 تكرار أزرار "اليوم" و "أمس" السريعة مرتين في نفس المكون
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L136-L167` مقارنة بـ `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L305-L329`.
- **التشخيص الدقيق:**
  عند تمرير `showQuickButtons` في نموذج المعاملة، تظهر كبسولتان "اليوم" و "أمس" في سطر التسمية فوق حقل التاريخ مباشرة. وعندما ينقر المستخدم على الحقل ليفتح التقويم، يجد في قاع لوحة التقويم نفس الزرين "اليوم" و "أمس" متكررين للمرة الثانية على بعد 4 سنتيمترات!
- **الحل الجذري المقترح:** الاكتفاء بأزرار التسمية العلوية عند تفعيل `showQuickButtons` وإخفاء الشريط السفلي المكرر من لوحة التقويم في هذه الحالة لمنع التكرار الإجرائي الحشوي.

---

### 2.6 تراجع الترتيب البصري للأزرار السفلية في نموذج المعاملة على الهواتف الضيقة
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1613-L1675`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="sticky bottom-0 z-10 ... flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
      <Button type="submit" variant="primary" className="flex-1">حفظ</Button>
      <Button type="button" variant="outline" className="...">حفظ وإضافة أخرى</Button>
      <Button type="button" variant="ghost" className="...">إلغاء</Button>
    </div>
    ...
  </div>
  ```
- **التشخيص الدقيق:**
  على الهواتف ذات الشاشات الضيقة (360px–375px)، لا تتسع الحاوية لثلاثة أزرار نصية بجانب بعضها مع زر سلة المهملات. وبسبب `flex-wrap`، ينكسر زر "إلغاء" أو "تكرار المعاملة" إلى سطر ثانٍ أسفل زر الحفظ، مما يجعل التذييل الثابت ضخماً ويغطي مساحة كبيرة من حقول النموذج أثناء التمرير.
- **الحل الجذري المقترح:**
  إعادة هيكلة التذييل على الهواتف: زر الحفظ الرئيسي يمتد على كامل العرض أو يتشارك السطر مع زر الإلغاء، بينما يوضع خيار "حفظ وإضافة أخرى" كخيار تبديل أو زر ثانوي مدمج بأيقونة واضحة تمنع الانكسار العشوائي.

---

### 2.7 تضارب الارتفاع وعدم احترام قاعدة `h-11` في منتقي الترتيب لغياب tailwind-merge
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L913` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/Select.tsx#L197`.
- **الكود البرمجي الحالي:**
  - في `Select.tsx`: `className={cn('w-full h-11 flex ...', className)}`
  - وفي `TransactionsPage.tsx`: `className="h-9 py-1 text-xs font-bold"`
- **التشخيص الدقيق:**
  دالة `cn` في `src/lib/cn.ts` هي ببساطة:
  ```ts
  export function cn(...inputs: ClassValue[]): string { return clsx(inputs) }
  ```
  وهي لا تستخدم `tailwind-merge` لحل تضارب الأصناف. ونتيجة لذلك، يُنتج المتصفح عنصراً يحمل `class="... h-11 ... h-9"`. وفي CSS، يفوز الصنف الذي يظهر تالياً في ملف CSS المولد بغض النظر عن ترتيبه في الكود!
  علاوة على ذلك، ينص الباب الرابع (4.1 البند 6): *"الارتفاع القياسي الموحد لجميع حقول الإدخال والاختيار والتاريخ والأزرار الرئيسية: h-11 (44px) لضمان محاذاة أفقية مثالية ومساحة لمس مريحة على الهواتف"*. فرض `h-9` (36px) على قائمة الترتيب يكسر هذا المعيار.
- **الحل الجذري المقترح:** إزالة `h-9` وتوحيد ارتفاع قائمة الترتيب عند `h-10` أو `h-11` القياسي.

---

### 2.8 تلوين مؤشر "حد الصرف اليومي الآمن" بالأخضر حتى لو كان صفراً أو سالباً
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1177-L1181`.
- **الكود البرمجي الحالي:**
  ```tsx
  <span>
    حد الصرف اليومي الآمن:{' '}
    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
      <FormattedMoney amountFils={forecast.dailySafeFils} />
    </strong>
  </span>
  ```
- **التشخيص الدقيق:**
  تم تثبيت صنف اللون الأخضر الدلالي `text-emerald-600 dark:text-emerald-400` بشكل صلب دون فحص قيمة `dailySafeFils`. إذا كان المستخدم في حالة عجز مالي وكان حد الصرف اليومي `0 د.أ` أو سالباً، فإنه يُعرض باللون الأخضر الزاهي كأنه رقم إيجابي مشجع!
  هذا خرق صريح لقواعد النزاهة المالية وأمانة العرض المحاسبي المنصوص عليها في الباب الأول والثاني من الدستور الهندسي.
- **الحل الجذري المقترح:**
  تلوين الرقم ديناميكياً:
  ```tsx
  <strong className={cn(
    forecast.dailySafeFils > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : forecast.dailySafeFils < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-zinc-500 dark:text-zinc-400'
  )}>
    <FormattedMoney amountFils={forecast.dailySafeFils} />
  </strong>
  ```

---

### 2.9 حجم أيقونة الحالة الفارغة (`EmptyState`) متضخم بالنسبة لحاويتها
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1197` مقارنة بـ `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/EmptyState.tsx#L27-L29`.
- **الكود البرمجي الحالي:**
  - في `EmptyState.tsx`: الحاوية بأبعاد `w-12 h-12` (48×48px).
  - في `TransactionsPage.tsx`: تم تمرير الأيقونة بحجم `<ArrowLeftRight className="w-8 h-8" />` (32×32px).
- **التشخيص البصري:** نص الباب الثالث (3.2 في جدول أحجام الأيقونات):
  > *"أيقونة الحالة الفارغة (EmptyState / Charts): حجم الأيقونة w-6 h-6 (24px) داخل حاوية محايدة w-12 h-12 (بدون إطار منقط)."*
  استخدام `w-8 h-8` يترك هامشاً ضيقاً جداً (8px فقط) حول الأيقونة مما يجعلها تبدو محشورة ومخنوقة داخل المربع.
- **الحل الجذري المقترح:** ضبط حجم الأيقونة على `w-6 h-6`.

---

### 2.10 عدم إمكانية طي حقل الملاحظة التفصيلية بعد فتحه
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/TransactionForm.tsx#L1360-L1399`.
- **التشخيص الدقيق:**
  يبدأ النموذج بزر نصي أنيق `+ إضافة ملاحظة تفصيلية`. بمجرد النقر عليه، يتم تفعيل `showNoteField = true` ويظهر حقل الملاحظة. لكن إذا نقر المستخدم عليه بالخطأ أو قرر عدم كتابة أي ملاحظة، لا يوجد أي زر للتراجع أو طي الحقل مجدداً، ويظل الحقل محتلاً لمساحة رأسية لا يحتاجها المستخدم طوال جلسة الإدخال.
- **الحل الجذري المقترح:** توفير زر إغلاق مصغر أو فحص إفراغ الملاحظة لإعادة إظهار زر الإضافة الخفيف عند الحاجة.

---

## 3. سهولة الوصول والتنقل بلوحة المفاتيح وقارئات الشاشة (Accessibility & Keyboard a11y)

### 3.1 سطر المعاملة يفتقر لسمات الزر وسهولة الوصول وتفاعل لوحة المفاتيح
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L577-L581`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div
    key={tx.id}
    onClick={() => openEdit(tx)}
    className="group flex items-center justify-between p-3 sm:p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
  >
  ```
- **تشخيص الإتاحة (a11y):**
  السطر بأكمله تفاعلي ويفتح نافذة التعديل، ولكنه مبني كـ `<div>` بحت دون `role="button"` وبدون `tabIndex={0}` وبدون معالج لمفاتيح `Enter` أو `Space`.
  مستخدمو لوحة المفاتيح الذين يتنقلون بمفتاح `Tab` لا يمكنهم التركيز على سطر المعاملة ولا تفعيله، وقارئات الشاشة تعلن عنه كمحتوى نصي ثابت وليس كعنصر قابل للتفاعل.
- **الحل الجذري المقترح:**
  إضافة الخصائص الدلالية ومعالج لوحة المفاتيح:
  ```tsx
  <div
    key={tx.id}
    role="button"
    tabIndex={0}
    onClick={() => openEdit(tx)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openEdit(tx)
      }
    }}
    aria-label={`معاملة ${primaryLabel} بقيمة ${formatWithSign(tx.amountFils, tx.type)}`}
    className="..."
  >
  ```

---

### 3.2 أزرار فلاتر المصدر والتصنيفات تفتقر لخاصية `aria-pressed` وحالة التحديد
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1020-L1036` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1073-L1091`.
- **الكود البرمجي الحالي:**
  ```tsx
  <button
    key={s.value}
    type="button"
    onClick={() => { setSelectedSource(s.value); setCurrentPage(1); }}
    className={cn('...', isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600')}
  >
    {s.label}
  </button>
  ```
- **تشخيص الإتاحة (a11y):**
  حالة التحديد (محدد / غير محدد) تُعبَّر عنها **بصرياً فقط عبر اللون الأزرق**، ولا توجد أي خاصية برمجية مثل `aria-pressed={isSelected}` تعلن لقارئ الشاشة عن الفلتر النشط حالياً. المستخدم الكفيف يسمع فقط أسماء التصنيفات والمصادر المتتالية دون أي فكرة عما إذا كان الخيار مفعلاً أم لا.
- **الحل الجذري المقترح:**
  إضافة `aria-pressed={isSelected}` على كافة أزرار الشرائح، وتغليف المجموعة بـ `role="group"` مع `aria-label="تصفية حسب المصدر"` و `aria-label="تصفية حسب التصنيف"`.

---

### 3.3 حقل البحث الرئيسي يفتقر لتسمية يمكن الوصول إليها (Missing Accessible Name)
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L876-L883`.
- **الكود البرمجي الحالي:**
  ```tsx
  <input
    ref={searchInputRef}
    type="text"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="ابحث في العنوان، الملاحظات، التصنيف، أو المبلغ..."
    className="..."
  />
  ```
- **تشخيص الإتاحة (a11y):**
  الحقل لا يحتوي على عنصر `<label>` مربوط بمعرف `id`، ولا يحتوي على `aria-label`. نص الـ `placeholder` ليس بديلاً معتمداً لتسمية الحقول وفق معايير WCAG 2.1 Success Criterion 4.1.2، وتتجاهله معظم برمجيات الإتاحة بعد بدء الكتابة.
- **الحل الجذري المقترح:** إضافة `aria-label="البحث في المعاملات"` ومعرف `id="tx-search-input"`.

---

### 3.4 زرا فتح البحث والفلاتر على الهواتف يفتقران لـ `aria-expanded`
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L830` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L850`.
- **تشخيص الإتاحة (a11y):**
  أزرار التبديل للموبايل تفتح وتغلق لوحات قابلة للطي (Collapsible Panels)، ولكنها تفتقر لخاصيتي `aria-expanded={isMobileSearchOpen}` و `aria-expanded={isMobileFiltersOpen}` و `aria-controls`. وبالتالي لا يعلم مستخدم التقنيات المساعدة ما إذا كان النقر قد فتح لوحة أم أغلقها.
- **الحل الجذري المقترح:** تزويد الزرين بـ `aria-expanded={isOpen}` وتحديث `aria-label` ليتغير ديناميكياً بين "فتح البحث / إغلاق البحث".

---

### 3.5 غياب التنقل بالأسهم وافتقار عناصر القائمة لخاصية `role="option"` في `Select.tsx` و `DatePickerInput.tsx`
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/Select.tsx#L189-L250` و `file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/DatePickerInput.tsx#L223-L303`.
- **تشخيص الإتاحة (a11y):**
  1. في `Select.tsx`: لوحة الخيارات تحمل `role="listbox"` ولكن الأزرار بداخلها لا تحمل `role="option"` ولا `aria-selected={isSelected}`. وعندما تكون القائمة مفتوحة، لا يستجيب المكون لمفاتيح الأسهم `ArrowDown` و `ArrowUp` للانتقال بين الخيارات، بل يتسبب ضغط الأسهم في تمرير الصفحة خلف القائمة!
  2. في `DatePickerInput.tsx`: لوحة التقويم تفتقر لخاصية `role="dialog"`، وأيام الشهر داخل الشبكة تُعرض كنصوص أرقام مجردة `day.getDate()` (مثلاً: "14") دون `aria-label` يوضح اليوم والشهر والسنة ("الأربعاء 14 أكتوبر 2026"). كما يفتقر التقويم للتنقل بالأسهم بين أيام الأسبوع.
- **الحل الجذري المقترح:**
  تحديث `Select.tsx` ليدعم نمط WAI-ARIA Combobox مع معالجة مفاتيح الأسهم واختيار العنصر بـ `Enter`، وتزويد أزرار أيام التقويم بـ `aria-label` كامل للتاريخ.

---

## 4. سلوكيات الطباعة وانتقال الصفحات (Printing, Export & Visual Stability)

### 4.1 اختفاء بداية قائمة المعاملات خلف الترويسة المثبتة عند التنقل بين الصفحات
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L418` و `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L1232`.
- **الكود البرمجي الحالي:**
  ```tsx
  // دالة تغيير الصفحة:
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    if (typeof window !== 'undefined') {
      transactionListRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }

  // الحاوية المستهدفة:
  <div ref={transactionListRef} className="space-y-5">
  ```
- **التشخيص الدقيق:**
  الترويسة العلوية الثابتة في `AppShell.tsx` مثبتة عند قمة الشاشة (`sticky top-0 z-20`) بارتفاع يبلغ نحو 56 بكسل.
  عند استدعاء `scrollIntoView({ block: 'start' })`، يقوم المتصفح بمحاذاة الحافة العلوية لـ `transactionListRef` تماماً مع النقطة `y = 0` في إطار العرض.
  ونتيجة لذلك، فإن **أول 56 بكسل من قائمة المعاملات — وهي ترويسة اليوم الأول وأول معاملة في الصفحة الجديدة — تغوص مباشرة خلف الترويسة العلوية المثبتة وتختفي عن نظر المستخدم!** ويضطر المستخدم للتمرير اليدوي للأعلى لرؤية ترويسة اليوم التي اختفت.
- **الحل الجذري المقترح:**
  إضافة هامش تمرير علوي (`scroll-margin-top`) للحاوية عبر فئة Tailwind:
  ```tsx
  <div ref={transactionListRef} className="space-y-5 scroll-mt-20">
  ```
  هذا يضمن توقف التمرير التلقائي على بعد 80 بكسل تحت الترويسة المثبتة، مما يبقي أول معاملة ظاهرة بالكامل ومريحة للقراءة.

---

### 4.2 ظهور أزرار التعديل والحذف في وثائق الطباعة ومعاينة PDF
- **الموقع في الكود:** `file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx#L656`.
- **الكود البرمجي الحالي:**
  ```tsx
  <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
  ```
- **التشخيص الدقيق:**
  على الرغم من أن الترويسة العلوية والشريط الجانبي يحملان فئة `print-hide`، فإن حاوية الإجراءات السريعة (زر النسخ، وزر التعديل، وزر الحذف، وأيقونة الانتقال للديون) لا تحمل فئة `print:hidden`. في معاينة الطباعة أو التصدير إلى PDF، تظل هذه العناصر التفاعلية جزءاً من شجرة DOM في السطر وقد تظهر كفراغات أو أيقونات رمادية باهتة تشوه التقرير المالي المطبوع.
- **الحل الجذري المقترح:** إضافة `print:hidden` لحاوية الإجراءات السريعة في سطر المعاملة.

---

## 5. كتالوج الحلول البرمجية المقترحة وخطة التطوير (Actionable Remediation Blueprint)

### جدول المهام وخطة الإصلاح الموصى بها لوكيل التحسين (Improvement Worker Action Items):

```markdown
1. [ ] إصلاح تداخل الصناديق في الشريط الجانبي (TransactionsPage.tsx L971):
      - إزالة `border` و `bg-zinc-50` من حاوية التاريخ المخصص وجعلها فاصلاً مدمجاً بـ `pt-2 border-t`.
2. [ ] إعادة صياغة لافتات التنبيه في نموذج المعاملة (TransactionForm.tsx):
      - استبدال الصناديق الضخمة rounded-2xl بخط إرشادي سويسري جانبي `border-s-2` وخلفية خافتة.
      - تنقية الأزرار من اللون الكهرماني `bg-amber-600` وإعادتها للنمط الياقوتي أو المحايد.
3. [ ] تحسين تجربة الموبايل وحل تزاحم أسطر المعاملات (TransactionsPage.tsx L656):
      - إخفاء أزرار التعديل والحذف المجهرية على الهواتف عبر `hidden sm:flex`.
4. [ ] معالجة اختناق الشريط الجانبي (TransactionsPage.tsx L806):
      - إضافة `lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar` للحفاظ على ظهور الإجماليات.
5. [ ] تصحيح صنف إخفاء السكرولبار (TransactionsPage.tsx L1010, L1054):
      - استبدال `scrollbar-none` بـ `no-scrollbar` الدستوري.
6. [ ] تصحيح إزاحة التمرير للترقيم (TransactionsPage.tsx L1232):
      - إضافة `scroll-mt-20` لمنع اختفاء أول معاملة خلف الهيدر المثبت.
7. [ ] ضبط ديناميكية لون حد الصرف اليومي (TransactionForm.tsx L1178):
      - ربط اللون بالقيمة الحقيقية لمنع تلوين الأصفار والعجز بالأخضر.
8. [ ] ترقية سهولة الوصول a11y:
      - تزويد سطر المعاملة بـ `role="button"` و `tabIndex={0}` ومعالج الكيبورد.
      - تزويد أزرار الفلترة بـ `aria-pressed`.
      - تزويد حقل البحث بـ `aria-label="البحث في المعاملات"`.
      - استبدال `<input type="checkbox">` بمفتاح `<Toggle>` المعتمد.
9. [ ] ضبط تناسق الظلال والاستدارة:
      - إضافة `dark:shadow-none` لكافة القوائم المنسدلة والأزرار.
      - توحيد استدارة حقل المبلغ إلى `rounded-xl`.
      - توحيد شفافية أيقونات التصنيفات إلى `${color}20`.
```

---

## 6. الخلاصة التنفيذية (Executive Summary)
شاشة المعاملات تتمتع ببنية معمارية قوية ونظام تجميع وفرز متقدم ومحاذاة تامة للأرقام المالية والاتجاه العربي `RTL`. لكنها بحاجة ماسة إلى هذه الصيانة البصرية لضبط هرمية الحدود، والتخلص من الصناديق المتداخلة والظلال الداكنة، وحماية تجربة مستخدمي الهواتف من تزاحم الأزرار المجهرية، وضمان شمولية الوصول لجميع فئات المستخدمين وفق معايير الدستور البصري السويسري الموحد لتطبيق **بَصير**.
