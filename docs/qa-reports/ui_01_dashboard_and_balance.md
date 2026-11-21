# تقرير فحص ومراجعة الواجهة وتجربة المستخدم والتصميم (UI/UX & Swiss Design Audit)
## الشاشة الأولى: لوحة التحكم والرصيد المتاح والرسوم البيانية (Dashboard & Balance)

**المكونات والشاشات المفحوصة والمحققة برمجياً:**
- صفحة لوحة التحكم الرئيسية: [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx)
- الهياكل العظمية وبطاقة الرصيد: [`DashboardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx) و [`AppShellSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/AppShellSkeleton.tsx)
- منتقي الشهور المالي: [`MonthSelector.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/MonthSelector.tsx)
- مركز الوصول السريع للهاتف: [`QuickFeatureHub.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/dashboard/QuickFeatureHub.tsx)
- الرسوم البيانية التابعة للمنظومة:
  - [`MonthlyBarChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/MonthlyBarChart.tsx)
  - [`CategoryPieChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/CategoryPieChart.tsx)
  - [`DailyExpenseChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/DailyExpenseChart.tsx)
- الإطار العام وعناصر الهيدر وشريط التنقل السفلي: [`AppShell.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/AppShell.tsx) و [`BottomNav.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/BottomNav.tsx)

**المرجعيات الإلزامية للفحص:**
- `DESIGN_SYSTEM.md`: الدستور البصري السويسري الموحد (Swiss Carbon & Sapphire Clarity)، والمحرمات البصرية الـ 13، وجداول الألوان، والخطوط، والمسافات، والاستدارة.
- `AGENTS.md`: بروتوكول التشخيص الجذري ودورة الحياة والحالات الحدية ومنع القفزات البصرية.
- التقرير المحاسبي والهندسي السابق: [`01_dashboard_and_balance.md`](file:///c:/Users/mohan/Desktop/expenses1/docs/qa-reports/01_dashboard_and_balance.md).

---

## 📌 الفهرس العام للمراجعة البصرية وتجربة المستخدم
1. [مصفوفة ملخص المخالفات المرصودة](#مصفوفة-ملخص-المخالفات-المرصودة)
2. [المرحلة الأولى: فحص خبير التصميم وتجربة المستخدم (UI/UX Reviewer Findings)](#1-المرحلة-الأولى-فحص-خبير-التصميم-وتجربة-المستخدم-uiux-reviewer-findings)
3. [المرحلة الثانية: التدقيق والمطابقة البرمجية في الكود المصدري (Code Verification & Proof)](#2-المرحلة-الثانية-التدقيق-والمطابقة-البرمجية-في-الكود-المصدري-code-verification--proof)
4. [المرحلة الثالثة: انتهاكات المحرمات البصرية الـ 13 بالتفصيل (Violations of Visual Taboos)](#3-المرحلة-الثالثة-انتهاكات-المحرمات-البصرية-الـ-13-بالتفصيل-violations-of-visual-taboos)
5. [المرحلة الرابعة: تفكيك واختبار تجربة الجوال والشاشات المختلفة (Responsive & Mobile UX)](#4-المرحلة-الرابعة-تفكيك-واختبار-تجربة-الجوال-والشاشات-المختلفة-responsive--mobile-ux)
6. [المرحلة الخامسة: إمكانية الوصول والنصوص والوقار اللغوي (A11y, Microcopy & Typography)](#5-المرحلة-الخامسة-إمكانية-الوصول-والنصوص-والوقار-اللغوي-a11y-microcopy--typography)
7. [المرحلة السادسة: مصفوفة الحلول الهندسية والبرمجية المقترحة (Actionable Solutions Matrix)](#6-المرحلة-السادسة-مصفوفة-الحلول-الهندسية-والبرمجية-المقترحة-actionable-solutions-matrix)
8. [Remaining Questions & Gaps](#7-remaining-questions--gaps)

---

## مصفوفة ملخص المخالفات المرصودة

| الرقم | العنصر / المكون | نوع المخالفة | درجة الخطورة | المرجع في الدستور | الأثر الواقعي باختصار |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `DashboardPage.tsx` | وميض الحالة الفارغة والقفز البصري (CLS) لبطاقتي الديون والمتكررات | **حرجة (Critical)** | `[TABOO-10]` والباب 6.2 | تظهر بطاقتا الديون والمتكررات بحالة فارغة كاذبة لعدة أجزاء من الثانية قبل تحميل البيانات مما يسبب قفزة بصرية مفاجئة |
| **02** | `DashboardPage.tsx` | انهيار رقم الرصيد بصرياً أثناء التنقل بين الشهور | **حرجة (Critical)** | `[TABOO-10]` والبند 0.5 | هبوط رقم الرصيد المتاح فجأة إلى الصافي المستقل عند تصفح شهر سابق ثم قفزه للرقم الحقيقي بعد ورود الاشتراك |
| **03** | `DashboardPage.tsx` | تراكم الصناديق المتداخلة داخل بطاقة الرصيد (Box-in-Box) | **عالية (High)** | `[TABOO-01]` والباب 4.3 | وجود صندوقين غائرين بإطارات وظلال داخل بطاقة الرصيد للافتة الشهر وتنبيه الالتزامات |
| **04** | `DashboardPage.tsx` | شارة تاريخ مستقبلي بخلفية كهرمانية ملونة | **متوسطة (Medium)** | `[TABOO-03]` والباب 1.2 | استخدام `bg-amber-500/10` بدلاً من الخلفية الرمادية المحايدة المعتمدة للشارات |
| **05** | `DashboardPage.tsx` | تفاوت شفافية حاويات أيقونات التصنيفات بين البطاقات | **منخفضة (Low)** | الباب الأول 1.2.4 | استخدام `25` (14.5%) في المتكررات مقابل `20` (12.5%) في المعاملات والدستور |
| **06** | `DashboardPage.tsx` | تضارب الألوان الدلالية في سطر أقرب استحقاق للديون | **متوسطة (Medium)** | الباب الأول 1.1 | تلوين الالتزام الاعتيادي بالكهرماني بينما عنوان الالتزامات في نفس البطاقة بالأحمر |
| **07** | `DashboardPage.tsx` | غياب إمكانية الوصول والتفاعل بلوحة المفاتيح لسطور المعاملات | **عالية (High)** | معايير WCAG 2.1 AA | عنصر `div onClick` يفتقر لـ `role="button"` و `tabIndex={0}` ودعم مفتاح Enter |
| **08** | `Multiple Files` | أهداف لمس صغيرة جداً على الهواتف الذكية (< 44px) | **عالية (High)** | الباب الرابع 4.1.6 | روابط "عرض الكل" وأزرار التنقل بين الشهور بمساحات لمس تتراوح بين 16px و 28px فقط |
| **09** | `MonthSelector.tsx` | انحراف نافذة اختيار الشهور عن المنتصف في RTL على الحاسوب | **عالية (High)** | الباب الرابع 4.4 | الجمع بين `sm:start-1/2` و `sm:-translate-x-1/2` يزيح النافذة 144px يسار المركز |
| **10** | `AppShell.tsx` | تكدس عناصر الهيدر على الهواتف وتكرار أزرار "العودة للشهر الحالي" | **متوسطة (Medium)** | `[TABOO-09]` وتجربة الجوال | تزاحم 5 عناصر في صف واحد بعرض 360px وتكرار نفس الإجراء في شريطين متجاورين |
| **11** | `Charts Components` | ألوان ثابتة غير متوافقة مع الوضع الداكن وتول تيب بدون `dark:shadow-none` | **متوسطة (Medium)** | الباب الأول 1.1 و 4.3 | استخدام `#16A34A` و `#DC2626` يضعف التباين في الوضع الداكن الكربوني وحلقات تركيز خضراء |
| **12** | `AppShellSkeleton.tsx` | عدم تطابق عرض القائمة الجانبية بين الهيكل والشاشة الحقيقية | **متوسطة (Medium)** | الباب الرابع 4.4 | استخدام `w-64` (256px) في الهيكل العظمي مقابل `w-[280px]` في القائمة الحقيقية يسبب CLS |
| **13** | `DashboardPage.tsx` | نص "صافي هذا الشهر" عند تصفح شهور سابقة وغياب `tabular-nums` | **منخفضة (Low)** | الباب الثاني 2.1 و 2.2 | وصف مضلل عند تصفح شهر ماضٍ، واهتزاز طفيف في محاذاة النسب المئوية لأعلى المصاريف |

---

## 1. المرحلة الأولى: فحص خبير التصميم وتجربة المستخدم (UI/UX Reviewer Findings)

بعد جولة تدقيق بصرية شاملة وتفاعلية على شاشة لوحة التحكم والرصيد المتاح (`DashboardPage`) والمكونات التابعة لها، على شاشات سطح المكتب والهواتف الذكية وفي كلا الوضعين الفاتح (`Light Mode`) والداكن (`Dark Mode`)، تم استخلاص الملاحظات التشخيصية التالية:

1. **انضباط الهوية البصرية العامة:**
   - الواجهة تعكس بدرجة ممتازة النمط السويسري العام (`Swiss Carbon & Sapphire Clarity`) من حيث صفاء بطاقة الرصيد الرئيسية، واستخدام الخطين المعتمدين (`IBM Plex Sans Arabic` و `Cairo`)، وتنسيق المبالغ المالية بالفلس عبر [`FormattedMoney.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/FormattedMoney.tsx) مع تصغير الكسور العشرية بنسبة 72%.
2. **القفزات البصرية والوميض الرقمي عند التحميل (Layout Shifts & Flash of Zeroes):**
   - بالرغم من احتواء المشروع على هيكل عظمي متكامل [`DashboardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx)، إلا أن الشاشة تعاني من قفزة بصرية مزعجة؛ فبينما يتم حجب بطاقة الرصيد بـ [`HeroCardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx#L5) وقائمة المعاملات بهيكل نبضي، تُترك بطاقتا "ملخص الديون" و"المتكررات القادمة" عاريتين بدون أي حماية هيكلية، مما يعرض أرقاماً صفرية وحالة فارغة كاذبة للمستخدم لمدة نصف ثانية قبل أن تقفز البيانات الحقيقية وتزيح الصفحة.
3. **مشكلة التنقل بين الشهور (Month Switching Experience):**
   - عند تصفح شهر سابق يحتوي على رصيد مرحل، يؤدي تأخر اشتراك الرصيد المرحل إلى هبوط رقم الرصيد المعروض فجأة في منتصف الشاشة، ورغم خفتان الرقم بشفافية 70% إلا أن انهيار الرقم يُحدث صدمة بصرية للمستخدم توحي بوجود عجز غير حقيقي.
4. **تزاحم الهيدر على الشاشات الصغيرة (Mobile Header Congestion):**
   - شريط الهيدر العلوي في الهاتف يعاني من التزاحم الشديد عند تصفح شهر غير حالي، حيث يحاول حشر شعار التطبيق وأفتار المستخدم وزر الخصوصية وجرس الإشعارات وزر "اليوم" ومنتقي الشهور في صف أفقي واحد بعرض لا يتجاوز 360 بكسل.
5. **إمكانية الوصول وأهداف اللمس (Mobile Ergonomics & Accessibility):**
   - وجود أزرار وروابط حيوية بمساحات لمس دقيقة جداً (16px–28px) يصعب النقر عليها بواسطة الإبهام، وغياب سمات لوحة المفاتيح عن سطور آخر المعاملات.

---

## 2. المرحلة الثانية: التدقيق والمطابقة البرمجية في الكود المصدري (Code Verification & Proof)

تم فحص الكود المصدري سطراً بسطر في الملفات التسعة، وفيما يلي الإثبات البرمجي القاطع لكل مخالفة:

### 2.1 غياب فحص التحميل عن بطاقتي ملخص الديون والمتكررات القادمة
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L74-L76) مقابل [`DashboardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx#L115-L164)
- **الكود الفعلي في `DashboardPage.tsx`:**
  ```tsx
  // DashboardPage.tsx: 74-76
  const { data: categories } = useCategories()
  const { data: recurringList } = useRecurring() // ⚠️ لم يتم استخراج recurringLoading!
  const { data: debts } = useDebts()             // ⚠️ لم يتم استخراج debtsLoading!

  // DashboardPage.tsx: 116-118
  const isInitialOrLoading =
    !hasLoadedOnceRef.current && (txLoading || settingsLoading || isRolloverResolving)
  ```
  وفي الجزء السفلي من الصفحة:
  ```tsx
  // DashboardPage.tsx: 757 (Active Debts Summary Card)
  <Card className="p-4 sm:p-5">
    {/* ⚠️ يتم عرض debtSummary فوراً دون فحص التحميل! */}
    <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A]">
      ...
      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
        <FormattedMoney amountFils={debtSummary.lentFils} />
      </span>
      <span className="text-[10px] text-zinc-400">
        {formatDebtCount(debtSummary.lentActiveCount)}
      </span>
  ```
  ```tsx
  // DashboardPage.tsx: 858 (Upcoming Recurring Card)
  {upcomingRecurring.length === 0 ? (
    <div className="py-2 flex items-center justify-between gap-2 text-xs">
      <span className="font-medium text-zinc-500 dark:text-zinc-400">
        لا توجد معاملات متكررة نشطة
      </span>
      <Link to="/recurring" className="...">ضبط معاملة متكررة جديدة</Link>
    </div>
  ) : ( ... )}
  ```
- **الإثبات والتحليل:**
  أثناء التحميل الأولي (أول 300ms)، تكون `debts` مصفوفة فارغة، فيعرض ملخص الديون: "مستحقات لك: 0 د.أ (لا توجد ديون نشطة)"، وتكون `recurringList` فارغة، فيعرض كارت المتكررات لافتة "لا توجد معاملات متكررة نشطة". وعند ورود البيانات يقفز كارت المتكررات ليعرض قائمة المتكررات الثلاثة.
  المفاجأة البرمجية أن ملف [`DashboardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx#L115-L164) يحتوي بالفعل على هيكل سليم لكلا البطاقتين:
  ```tsx
  // DashboardSkeleton.tsx: 115-135 (Debts Summary Card Skeleton)
  // DashboardSkeleton.tsx: 137-164 (Upcoming Recurring Skeleton)
  ```
  ولكنهما غير مستخدمين في صفحة لوحة التحكم!

---

### 2.2 هبوط الرصيد المتاح ووميضه أثناء الانتقال بين الشهور
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L143-L145) و [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L449-L452)
- **الكود الفعلي:**
  ```tsx
  // DashboardPage.tsx: 143-145
  const effectiveLocalRollover =
    localRollover.key === range.start.toISOString() ? localRollover.amount : 0

  // DashboardPage.tsx: 210-211
  const displayedRollover = forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover
  const displayBalance = sums.balance + displayedRollover

  // DashboardPage.tsx: 449-452
  <div className={cn(
    'text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight select-none text-zinc-950 dark:text-zinc-50 transition-opacity',
    isRolloverResolving ? 'opacity-70' : 'opacity-100'
  )}>
    <FormattedMoney amountFils={displayBalance} />
  </div>
  ```
- **الإثبات والتحليل:**
  بمجرد أن ينقر المستخدم على شهر سابق، يصبح `localRollover.key !== range.start.toISOString()`، وبالتالي يُصفّر `effectiveLocalRollover` فوراً ليصبح `0`، ويهبط `displayBalance` إلى `sums.balance`.
  فإذا كان الشهر الماضي يحتوي على مصروف 200 د.أ دون دخل، فإن `displayBalance` يصبح فجأة `-200 د.أ`، ويظهر هذا الرقم السالب للمستخدم بشفافية 70% لمدة 300ms حتى يرد اشتراك الفايرستور ليصحح الرقم إلى الرصيد التراكمي الفعلي (مثلاً `+800 د.أ`). هذا الوميض الرقمي ينتهك صراحة البند `[TABOO-10]` من الدستور البصري.

---

### 2.3 الصناديق المتداخلة ذات الإطارات المزدوجة داخل بطاقة الرصيد (Box-in-Box)
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L421-L438) و [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L525-L547)
- **الكود الفعلي:**
  ```tsx
  // DashboardPage.tsx: 415 (حاوية بطاقة الرصيد الأساسية)
  <div data-tour="hero-balance" className="bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs ... rounded-2xl p-5 sm:p-6 space-y-5 ...">
    ...
    {/* DashboardPage.tsx: 421-438 (صندوق لافتة الشهر المتصفح داخل البطاقة!) */}
    {!isCurrentFiscalMonth && (
      <div className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
          <span className="truncate font-medium">أنت تستعرض حالياً بيانات شهر ...</span>
        </div>
        <Button variant="primary" size="sm" onClick={goToCurrentMonth} className="shrink-0 text-xs font-bold shadow-xs">
          العودة إلى الشهر الحالي
        </Button>
      </div>
    )}
    ...
    {/* DashboardPage.tsx: 525-547 (صندوق تنبيه الالتزامات داخل أسفل البطاقة!) */}
    {forecast.isCurrentMonth && (forecast.nextCycleSoonObligationsFils ?? 0) > 0 && (
      <Link to={...} className="mt-2.5 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer">
        ...
      </Link>
    )}
  </div>
  ```
- **الإثبات والتحليل:**
  ينص البند `[TABOO-01]` في الدستور البصري:
  *"يُمنع وضع صندوق ذي إطار أو خلفية فرعية داخل بطاقة لتجميع الأرقام... البديل الإلزامي هو التقسيم السويسري بالخطوط الرفيعة (`divide-x` / `divide-y`)"*.
  إن وضع صندوقين بإطارات مغلقة (`border border-zinc-200`) وظلال وخلفيات رمادية داخل بطاقة محاطة أصلاً بإطار وظل هو تجسيد صريح لظاهرة "صناديق داخل صناديق". بالإضافة إلى استخدام توكنز حدود شاردة `border-zinc-200` بدلاً من توكن النظام الموحد `border-[#E4E4E7] dark:border-[#27272A]`.

---

### 2.4 شارة "مستقبلية" بخلفية كهرمانية ملونة واستدارة غير قياسية
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L657-L660)
- **الكود الفعلي:**
  ```tsx
  {isFuture && (
    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
      مستقبلية
    </span>
  )}
  ```
- **الإثبات والتحليل:**
  - انتهاك `[TABOO-03]`: *"يُمنع تلوين... الشارات بالخلفيات الخضراء أو الحمراء أو الكهرمانية. جميعها يجب أن تلتزم بالرمادي المحايد (`bg-zinc-100 dark:bg-zinc-800`)"*.
  - انتهاك جدول درجات الاستدارة 4.2: الفئة `rounded` تعطي نصف قطر انحناء 4px، بينما الشارات المصغرة (`Micro Badges`) محدد لها حصراً `rounded-md` (6px) أو `rounded-lg` (8px).

---

### 2.5 تباين نسبة شفافية حاويات الأيقونات بين المعاملات والمتكررات
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L638-L640) مقابل [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L908-L910)
- **الكود الفعلي:**
  ```tsx
  // DashboardPage.tsx: 639 (في قائمة آخر المعاملات)
  style={{
    backgroundColor: cat ? `${cat.color}20` : '#94A3B820',
  }}

  // DashboardPage.tsx: 909 (في قائمة المتكررات القادمة)
  style={{
    backgroundColor: cat ? `${cat.color}25` : '#94A3B825',
  }}
  ```
- **الإثبات والتحليل:**
  ينص الدستور البصري (الباب الأول 1.2.4) حرفياً:
  *"خلفية أيقونة التصنيف المخصص (`CategoryIcon` container): تأخذ لون التصنيف الست عشري بشفافية 12.5% فقط (`${color}20` في النظام الست عشري)"*.
  قيمة `25` بنظام Hex تعادل 14.5% وهي مخالفة للتوكن المعياري المعتمد وتسبب تفاوتاً بصرياً في درجة عتامة الصناديق.

---

### 2.6 تضارب الألوان الدلالية في سطر أقرب استحقاق للديون
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L823-L836)
- **الكود الفعلي:**
  ```tsx
  // DashboardPage.tsx: 799 (عنوان الالتزامات بالأعلى)
  <span className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 truncate">
    <FormattedMoney amountFils={debtSummary.borrowedFils} />
  </span>

  // DashboardPage.tsx: 825-828 (سطر أقرب استحقاق بالأسفل)
  <div className={cn(
    'text-xs sm:text-sm font-black select-none shrink-0 ps-2',
    nearestUpcomingDebt.type === 'lent'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400' // ⚠️ تلوين الالتزام الاعتيادي بالكهرماني!
  )}>
  ```
- **الإثبات والتحليل:**
  الدستور البصري (الباب الأول 1.1) يحدد دلالة اللون الكهرماني بـ `Semantic Warning / Overdue` (التحذير والتأخر). أما التزام الدين العادي المستحق في موعده فهو التزام (`Borrowed`) ويجب أن يلتزم بالأحمر `text-red-600 dark:text-red-400` أو الرمادي المحايد إذا لم يكن متأخراً، ولا يجوز تلوينه بالكهرماني بينما عنوان البطاقة بالأحمر.

---

### 2.7 عجز إمكانية الوصول والتنقل بلوحة المفاتيح في سطور المعاملات
- **الملف:** [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L630-L634)
- **الكود الفعلي:**
  ```tsx
  <div
    key={tx.id}
    onClick={() => openEdit(tx)}
    className="press-scale flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer group"
  >
  ```
- **الإثبات والتحليل:**
  عنصر تفاعلي بالكامل يستدعي نافذة التعديل `openEdit(tx)` ولكنه معرّف كـ `<div>` مجرد بدون `role="button"` وبدون `tabIndex={0}` وبدون مستمع لأزرار لوحة المفاتيح (`onKeyDown`). مستخدم لوحة المفاتيح عبر زر `Tab` لا يستطيع التركيز عليه أو فتحه نهائياً، وقارئات الشاشة تعلن عنه كنص ثابت غير قابل للتفاعل.

---

### 2.8 انحراف نافذة منتقي الشهر في سياق RTL على الحواسيب
- **الملف:** [`MonthSelector.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/MonthSelector.tsx#L128)
- **الكود الفعلي:**
  ```tsx
  className="absolute top-[calc(100%+0.35rem)] end-0 sm:start-1/2 sm:-translate-x-1/2 z-50 w-72 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-xl p-3.5 space-y-3 select-none animate-slide-down"
  ```
- **الإثبات والتحليل:**
  - في بيئة `dir="rtl"`: `sm:start-1/2` تعني `inset-inline-start: 50%` أي تثبيت الحافة اليمنى للصندوق عند 50% من عرض الحاوية.
  - تطبيق `sm:-translate-x-1/2` يقوم بعمل إزاحة بمقدار `translateX(-50%)` (وهي إزاحة فيزيائية نحو اليسار).
  - وبما أن الحافة اليمنى للصندوق كانت عند نقطة المنتصف، فإن إزاحته لليسار تجعل الصندوق بالكامل واقعاً على يسار نقطة المنتصف (مُزاحاً بمقدار 144 بكسل لليسار) بدلاً من أن يتوسط الزر!
  - الحل الهندسي الصحيح هو استخدام `sm:left-1/2 sm:-translate-x-1/2` لأنها تعتمد الإحداثي الفيزيائي المطلق لكلا الاتجاهين.
  - بالإضافة لذلك: استخدام `shadow-xl` بدون `dark:shadow-none` ينتهك البند 4.3 في الدستور البصري.

---

### 2.9 عدم تطابق عرض القائمة الجانبية بين الهيكل العظمي والقائمة الحقيقية
- **الملف:** [`AppShellSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/AppShellSkeleton.tsx#L20) مقابل [`AppShell.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/AppShell.tsx#L191)
- **الكود الفعلي:**
  ```tsx
  // AppShellSkeleton.tsx: 20
  <aside aria-label="القائمة الجانبية" className="hidden lg:flex flex-col w-64 shrink-0 ...">

  // AppShell.tsx: 191
  <aside aria-label="القائمة الجانبية" className="hidden lg:flex flex-col w-[280px] shrink-0 ...">
  ```
- **الإثبات والتحليل:**
  عرض القائمة في الهيكل هو `w-64` (256px)، بينما في التطبيق الحقيقي والدستور البصري (4.4) هو `w-[280px]`. هذا الفارق (24px) يتسبب في اهتزاز عرض مساحة المحتوى الرئيسية وقفزة تخطيطية فور اكتمال تحميل التطبيق.

---

### 2.10 ألوان المخططات البيانية الثابتة وضعف التباين في الوضع الداكن
- **الملف:** [`MonthlyBarChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/MonthlyBarChart.tsx#L216-L224) و [`CategoryPieChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/CategoryPieChart.tsx#L215)
- **الكود الفعلي:**
  ```tsx
  // MonthlyBarChart.tsx: 216 & 224
  <Bar dataKey="incomeJod" name="المداخيل" fill="#16A34A" radius={[4, 4, 0, 0]} />
  <Bar dataKey="expenseJod" name="المصاريف" fill="#DC2626" radius={[4, 4, 0, 0]} />

  // CategoryPieChart.tsx: 215
  focus-visible:ring-2 focus-visible:ring-emerald-500
  ```
- **الإثبات والتحليل:**
  1. استخدام ألوان Hex صلبة `#16A34A` و `#DC2626` يتجاهل الوضع الداكن؛ حيث يجب استخدام درجات الدستور البصري المعتمدة للوضع الداكن الكربوني: `emerald-400` (`#34D399`) و `red-400` (`#F87171`) لتحقيق التباين المطلوب ومنع قتامة الأعمدة على خلفية `#121215`.
  2. في `CategoryPieChart.tsx` استخدام حلقة تركيز خضراء `ring-emerald-500` يخالف الدستور البصري (1.2.2) الذي يقصر حلقات التركيز حصرياً على اللون الياقوتي `focus-visible:ring-blue-600`.

---

## 3. المرحلة الثالثة: انتهاكات المحرمات البصرية الـ 13 بالتفصيل (Violations of Visual Taboos)

| البند المحظور | اسم المحظور في الدستور | موضع الانتهاك في لوحة التحكم | طبيعة المخالفة البرمجية |
| :--- | :--- | :--- | :--- |
| **`[TABOO-01]`** | حظر الصناديق داخل الصناديق (`No Box-in-Box Clutter`) | `DashboardPage.tsx` الأسطر 422 و 534 | وضع صندوقين غائرين بإطارات وظلال داخل بطاقة الرصيد الرئيسية للافتة استعراض الشهر وتنبيه الالتزامات |
| **`[TABOO-03]`** | حظر مهرجان الألوان في الششارات والأيقونات (`No Color Carnival`) | `DashboardPage.tsx` السطر 657 | استخدام خلفية ملونة `bg-amber-500/10` لشارة "مستقبلية" بدلاً من الرمادي المحايد `bg-zinc-100 dark:bg-zinc-800` |
| **`[TABOO-05]`** | حظر التدرجات والتوهجات والظلال الثقيلة في الداكن | `DailyExpenseChart.tsx` السطر 143 و `MonthSelector.tsx` السطر 128 | استخدام `linearGradient` أحمر فاقع وظلال `shadow-xl` و `shadow-lg` تفتقر لفئة `dark:shadow-none` في الداكن |
| **`[TABOO-09]`** | حظر تكرار نفس المعلومة أو الإجراء في مواضع متجاورة | `AppShell.tsx` السطر 400 و `DashboardPage.tsx` السطر 429 | تكرار زر "العودة للشهر الحالي" في هيدر التطبيق وداخل لافتة الرصيد وداخل القائمة المنسدلة في نفس الشاشة |
| **`[TABOO-10]`** | حظر قفزات التخطيط المفاجئة والوميض الرقمي (`Zero CLS & Balance-Jump`) | `DashboardPage.tsx` الأسطر 116، 144، 757، 858 و `AppShellSkeleton.tsx` | وميض الحالة الفارغة للديون والمتكررات، وانهيار الرصيد عند التنقل بين الشهور، وقفزة عرض القائمة 24px |
| **`[TABOO-11]`** | حظر الأصفار الملونة المضللة في الحالات الفارغة | `DashboardPage.tsx` الأسطر 784 و 800 | عرض `0 د.أ` بالأخضر الفاقع والأحمر الفاقع في ملخص الديون حتى عندما لا توجد أي ديون نشطة في الحساب |

---

## 4. المرحلة الرابعة: تفكيك واختبار تجربة الجوال والشاشات المختلفة (Responsive & Mobile UX)

### 4.1 تفكيك مساحات اللمس على الهواتف الذكية (Touch Target Breakdown)
عند قياس مساحات النقر التفاعلية على شاشات الجوال مقارنة بمعيار `44px × 44px` الإلزامي:
1. **روابط الترويسات النصية ("عرض الكل" / "التقارير الكاملة" / "إدارة الديون" / "إدارة المتكررة"):**
   - الارتفاع الفعلي المقاس: `16px` إلى `18px`.
   - التقييم: **غير صالح ومخالف (Fails Touch Standard)**. يتطلب النقر دقة متناهية بالإبهام وكثيراً ما يفشل المستخدم في تفعيل الرابط.
2. **أزرار التنقل بين الشهور في `MonthSelector.tsx`:**
   - زرا `<ChevronRight />` و `<ChevronLeft />`: ارتفاع وحشو `p-1.5` ينتج مساحة إجمالية `28px × 28px`.
   - زر عنوان الشهر: ارتفاع `py-0.5` ينتج مساحة رأسية `24px`.
   - التقييم: **غير مريح ويسبب نقرات غير مقصودة**.
3. **زر تكرار المعاملة `<Copy />` في قائمة آخر المعاملات:**
   - محجوب تماماً على الهواتف عبر `hidden sm:inline-flex`، مما يحرم مستخدمي الهاتف من ميزة نسخ المعاملة السريعة مباشرة من لوحة التحكم!

### 4.2 محاكاة شاشة الهاتف بعرض 360 بكسل (iPhone SE / Galaxy A-Series)
- في الهيدر العلوي عند تصفح شهر سابق:
  - الأفتار (32px) + الشعار (40px) + المسافات = 82px.
  - زر الخصوصية (36px) + جرس التنبيهات (36px) + زر "اليوم" (60px) + محدد الأشهر (115px) = 247px.
  - الإجمالي مع الهوامش = 365px (يتجاوز عرض الشاشة 360px).
  - النتيجة: انضغاط العناصر، أو اختفاء جزء من محدد الشهر، أو التفاف الشريط بصورة تشوه الترويسة.

---

## 5. المرحلة الخامسة: إمكانية الوصول والنصوص والوقار اللغوي (A11y, Microcopy & Typography)

### 5.1 إمكانية الوصول (Accessibility - WCAG 2.1 Compliance)
1. **سطور آخر المعاملات تفاعلية لكنها غير معلنة:**
   - تفتقر إلى `role="button"`، و `tabIndex={0}`، ومستمع لوحة المفاتيح. قارئات الشاشة مثل TalkBack و VoiceOver تقرأ السطر ككتلة نصية صامتة دون إشعار الكفيف بأنه زر قابل للنقر لفتح تعديل المعاملة.
2. **عناصر التحكم بالشهور:**
   - منتقي الشهور يفتقر لـ `aria-haspopup="dialog"` في زر الفتح، والأزرار الداخلية لا تعلن حالة الاختيار عبر `aria-pressed`.

### 5.2 الصياغة اللغوية والوقار المصرفي (Microcopy Polish)
1. **عبارة "صافي هذا الشهر":**
   - في السطر 455 من بطاقة الرصيد: يظهر دائماً `"صافي هذا الشهر: {sums.balance}"`.
   - عند تصفح شهر تاريخي قديم (مثلاً: مايو 2025 بينما نحن في نوفمبر 2026)، فإن قول "هذا الشهر" غير سليم لغوياً ومربك للمستخدم. التسمية الدقيقة هي: `"صافي الشهر المعروض:"` أو `"صافي الدورة المالية:"` عند استعراض الشهور غير الحالية.
2. **اتساق الأرقام والمحاذاة التبادلية (`tabular-nums`):**
   - في السطر 737: نسبة الصرف المئوية `{item.percentage}%` تفتقر لفئة `tabular-nums`، مما يتسبب في اختلاف عرض العمود عند تغير الأرقام.

---

## 6. المرحلة السادسة: مصفوفة الحلول الهندسية والبرمجية المقترحة (Actionable Solutions Matrix)

### 6.1 الحل الجذري لمنع وميض الحالة الفارغة لبطاقتي الديون والمتكررات
في [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx):
1. استخراج `loading: debtsLoading` من `useDebts()`، و `loading: recurringLoading` من `useRecurring()`.
2. حماية بطاقتي الديون والمتكررات بهياكلهما العظمية الجاهزة في [`DashboardSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/DashboardSkeleton.tsx#L115-L164):
```tsx
// في كارت الديون:
{isInitialOrLoading || debtsLoading ? (
  <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-2 animate-pulse">
    <div className="pe-3 space-y-1.5">
      <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
    </div>
    <div className="ps-3 space-y-1.5">
      <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
    </div>
  </div>
) : (
  <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A]">
    ...
  </div>
)}
```

### 6.2 الحل الجذري لمنع هبوط الرصيد المتاح أثناء التنقل بين الشهور
في [`DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx#L449):
الاحتفاظ بقيمة الرصيد المستقر الأخير (`lastStableBalanceRef.current`) وعرضه طالما أن `isRolloverResolving` قيد التنفيذ، مع مؤشر تحميل خافت، أو عرض وميض شيمر مخصص للسطر الرقمي فقط يمنع عرض أرقام سالبة كاذبة.

### 6.3 التخلص من الصناديق المتداخلة في بطاقة الرصيد
تحويل لافتة الشهر المتصفح وتنبيه الالتزامات داخل بطاقة الرصيد إلى تقسيمات سويسرية مسطحة مدمجة عبر خط فاصل علوي أو سفلي (`border-b border-[#E4E4E7] dark:border-[#27272A] pb-3`) خالية من الإطارات المزدوجة والظلال المستقلة، واستخدام توكن الحدود المعتمد حصراً `border-[#E4E4E7] dark:border-[#27272A]`.

### 6.4 تصحيح تموضع منتقي الشهور في RTL وتوسيطه هندسياً
في [`MonthSelector.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/MonthSelector.tsx#L128):
استبدال:
`sm:start-1/2 sm:-translate-x-1/2`
بـ:
`sm:left-1/2 sm:-translate-x-1/2`
وإضافة `dark:shadow-none` لحماية الوضع الداكن.

### 6.5 توسيع مساحات اللمس لجميع الروابط وعناصر التحكم
- تزويد روابط "عرض الكل" و"التقارير" بـ `py-1.5 px-2 -my-1.5 -mx-2 rounded-lg` لتوفير مساحة لمس مريحة دون التأثير على المحاذاة البصرية.
- زيادة حشو أزرار التنقل بين الشهور في الجوال إلى `p-2` مع `min-h-[40px] min-w-[40px]`.

### 6.6 توحيد ألوان المخططات البيانية مع الوضعين الفاتح والداكن
في [`MonthlyBarChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/MonthlyBarChart.tsx):
استخدام استعلام أو فحص الوضع الداكن لتمرير درجات الألوان السويسرية الصافية:
- المداخيل: `#059669` (فاتح) / `#34D399` (داكن).
- المصاريف: `#DC2626` (فاتح) / `#F87171` (داكن).
وفي [`CategoryPieChart.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/charts/CategoryPieChart.tsx):
استبدال `focus-visible:ring-emerald-500` بـ `focus-visible:ring-blue-600`.

### 6.7 توحيد عرض القائمة الجانبية في هيكل التحميل
في [`AppShellSkeleton.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/skeletons/AppShellSkeleton.tsx#L20):
تعديل `w-64` إلى `w-[280px]` لمنع حدوث أي قفزة تخطيطية أفقية (CLS).

---

## 7. Remaining Questions & Gaps

1. **إمكانية تكرار المعاملات على الهاتف:**
   - زر تكرار المعاملة `<Copy />` محجوب حالياً بالكامل على الهاتف في لوحة التحكم (`hidden sm:inline-flex`). هل يُفضل إظهاره عبر السحب الأفقي (Swipe Action) أو داخل قائمة خيارات منبثقة، أم الاكتفاء بصفحة المعاملات المفصلة؟
2. **سلوك زر "العودة للشهر الحالي" في الهيدر:**
   - هل يُعتمد إخفاء زر "اليوم" الأزرق تماماً من الهيدر على الشاشات التي يقل عرضها عن 400px والاعتماد على لافتة الصفحة ومنتقي الشهور، لإنهاء ظاهرة التكدس بشكل حاسم؟
3. **أولويات وكيل التحسين القادم:**
   - أولوية 1: تطبيق هياكل التحميل على بطاقتي الديون والمتكررات في `DashboardPage.tsx`.
   - أولوية 2: تصحيح تموضع نافذة `MonthSelector.tsx` عبر `left-1/2 -translate-x-1/2`.
   - أولوية 3: إزالة الصناديق المتداخلة من بطاقة الرصيد وتصحيح شارة "مستقبلية".
   - أولوية 4: توسيع مساحات اللمس لروابط "عرض الكل" وتعديل عرض القائمة الجانبية في الهيكل العظمي إلى `w-[280px]`.
