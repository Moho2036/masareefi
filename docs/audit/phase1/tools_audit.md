# تقرير التدقيق الشامل لمركز الأدوات المالية (Tools Page & Components Audit Report)
> **Baseer (بَصير) UI/UX, Design System, AI Slop, and Mobile/Desktop Audit**  
> **Target Scope**: `ToolsPage` (`src/pages/ToolsPage.tsx`) ومكوناتها التابعة في `src/components/tools/`  
> **Audited Files**:
> 1. `src/pages/ToolsPage.tsx`
> 2. `src/components/tools/MoneyCirclesManager.tsx`
> 3. `src/components/tools/circles/CircleCard.tsx`
> 4. `src/components/tools/circles/CircleTurnBanners.tsx`
> 5. `src/components/tools/circles/CircleMembersSchedule.tsx`
> 6. `src/components/tools/circles/CircleInstallmentsHistory.tsx`
> 7. `src/components/tools/circles/CircleFormModal.tsx`
> 8. `src/components/tools/circles/CircleCategorySelectors.tsx`
> 9. `src/components/tools/circles/CircleMembersListInput.tsx`
> 10. `src/components/tools/circles/CircleConfirmationModals.tsx`
> 11. `src/components/tools/circles/CircleSwapTurnsModal.tsx`
> 12. `src/components/tools/circles/circleMembersBuilder.ts`
> 13. `src/components/tools/circles/saveCircleSubmit.ts`
> 14. `src/components/tools/circles/useMoneyCirclesFormState.ts`
> 15. `src/components/tools/circles/useMoneyCirclesActions.ts`
> 16. `src/components/tools/circles/useCirclePayoutSync.ts`
> 17. `src/components/tools/WorkHoursCalculator.tsx`
> 18. `src/components/tools/workHours/WorkHoursInputsCard.tsx`
> 19. `src/components/tools/workHours/WorkHoursVisualResultCard.tsx`
> 20. `src/components/tools/workHours/WorkHoursDecisionInsightCard.tsx`
> 21. `src/components/tools/workHours/workHoursPrefs.ts`

---

## 1. الملخص التنفيذي (Executive Summary)

تم إجراء فحص سطري دقيق وتدقيق معماري شامل لشاشة مركز الأدوات المالية (`ToolsPage`) وكافة مكوناتها الفرعية المتخصصة في إدارة الجمعيات والصناديق المشتركة (`MoneyCirclesManager`) وحاسبة ساعات العمل والقرار الشرائي (`WorkHoursCalculator`)، بالاستناد الحرفي إلى:
1. الدستور البصري ولغة التصميم السويسرية الموحدة (`DESIGN_SYSTEM.md` - Swiss Carbon & Sapphire Clarity).
2. قائمة المحرمات البصرية العشرين المطلقة (`Visual Taboos [TABOO-01]` إلى `[TABOO-20]`).
3. الدستور الهندسي وضوابط التفكير العميق ومنع الترقيع السطحي (`AGENTS.md`).

أسفر التدقيق السطري الصارم عن اكتشاف **21 ملاحظة وخللاً موثقاً** موزعة على المحاور الأربعة الإلزامية:
- **المحور الأول (دستور التصميم والمحرمات البصرية - 7 انتهاكات):** انتهاك متكرر وصريح للمحرمة `[TABOO-20]` بوجود أزرار "إلغاء" زائدة في أسفل كافة النوافذ المنبثقة الـ 4، وانتهاك واسع لـ `[TABOO-01]` بتكديس الصناديق داخل الصناديق في بطاقات الجمعيات وبصيرة الشراء، وانتهاك حرج لـ `[TABOO-06]` بتعدد أشرطة التمرير الرأسية المتداخلة (4 أشرطة تمرير في نافذة واحدة)، وانتهاك `[TABOO-02]` و `[TABOO-03]` باستخدام شارات وأيقونات ملونة بدلاً من الحياد السويسري، وانتهاك `[TABOO-07]` بازدواجية الترويسات الفرعية، وانتهاك `[TABOO-09]` بتكرار مؤشر أجر الساعة ورمز العملة، ومخالفات في درجات استدارة الأزرار (`rounded-2xl` بدلاً من `rounded-xl`).
- **المحور الثاني (الاحتكاك وتجربة المستخدم UX Friction - 5 معوقات):** تصادم خطير بين زري تعديل وحذف الجمعية بمقاييس لمس ضئيلة (32×32px) دون مسافة أمان، ورابط "إلغاء الإيداع" المالي الخطر بارتفاع 14 بكسل فقط، ووقوع المستخدم في مصيدة التكبير القسري لمتصفح Safari على هواتف iPhone بسبب استخدام `text-xs` على حقول أسماء الأعضاء، وعقم النقر على بطاقات دليل الأدوات، وتعطيل الإغلاق الصامت بالنقر خارج النافذة بمجرد كتابة حرف واحد.
- **المحور الثالث (الحشو والنصوص المولدة بالذكاء الاصطناعي AI Slop - 5 أنماط):** صياغات إنشائية حوارية وأسئلة خطابية مصطنعة ("اتخذت قرارك النهائي بشراء هذه السلعة؟")، وحقن وسوم وعلامات مائية برمجية في ملاحظات المعاملات المالية الحقيقية للمستخدم، وفقرات شرح بديهية من سطرين تحت مفاتيح التبديل (Toggles)، وتكرار عبارات حماسية بعلامات التعجب، وأخطاء لغوية في صياغة حالات التحميل بالأزرار ("جاري الحفظ...").
- **المحور الرابع (التكافؤ بين الهاتف والحاسوب Mobile/Desktop Parity - 4 فجوات):** تشوه وقص حاد في شبكة اختيار التصنيفات على شاشات الهاتف الضيقة (≤ 390px)، وتناقض شريط الراتب المطوي على الهاتف مع التخطيط الموسع مما يكرر مؤشر أجر الساعة، وتفتت ترويسة بطاقة الجمعية على الهاتف إلى 4 صفوف غير متناسقة الارتفاع، وتمدد حقول الإدخال البسيطة أفقياً بشكل فارغ على الشاشات العريضة.

---

## 2. فهرس ومطابقة المكونات الخاضعة للتدقيق (Component Inventory)

| الملف | السطور | الدور الوظيفي | التوافق مع السقف الهندسي (≤ 350 / 450 سطر) |
| :--- | :--- | :--- | :--- |
| `src/pages/ToolsPage.tsx` | 146 | بوابة مركز الأدوات والتنقل بين حاسبة ساعات العمل والجمعيات | ✅ متوافق (146 سطر) |
| `src/components/tools/MoneyCirclesManager.tsx` | 372 | الحاوية المركزية لإدارة الجمعيات، الأرشيف، والتنسيق | ✅ متوافق (372 سطر) |
| `src/components/tools/circles/CircleCard.tsx` | 445 | بطاقة الجمعية المستقلة، شريط التقدم، وأزرار التحكم | ✅ متوافق (445 سطر) |
| `src/components/tools/circles/CircleTurnBanners.tsx` | 399 | لافتات إعلان الأدوار، إيداع الصافي، وحالة الجدولة | ✅ متوافق (399 سطر) |
| `src/components/tools/circles/CircleMembersSchedule.tsx` | 214 | جدول دفعات الأعضاء لنمط المدير وتبديل الأدوار | ✅ متوافق (214 سطر) |
| `src/components/tools/circles/CircleInstallmentsHistory.tsx` | 181 | سجل أقساط المستخدم الشهرية وجدول استلام الأدوار | ✅ متوافق (181 سطر) |
| `src/components/tools/circles/CircleFormModal.tsx` | 434 | نافذة إنشاء وتعديل الجمعية، الأسهم، والتصنيفات | ✅ متوافق (434 سطر) |
| `src/components/tools/circles/CircleCategorySelectors.tsx` | 123 | شبكة اختيار تصنيفات المصاريف والإيداع | ✅ متوافق (123 سطر) |
| `src/components/tools/circles/CircleMembersListInput.tsx` | 58 | شبكة إدخال أسماء الأعضاء في نمط المدير | ✅ متوافق (58 سطر) |
| `src/components/tools/circles/CircleConfirmationModals.tsx` | 104 | نوافذ تأكيد الحذف النهائي وإنهاء الجمعية | ✅ متوافق (104 سطر) |
| `src/components/tools/circles/CircleSwapTurnsModal.tsx` | 67 | نافذة تبديل الأدوار بين الأعضاء | ✅ متوافق (67 سطر) |
| `src/components/tools/circles/circleMembersBuilder.ts` | 135 | بناء وترتيب مصفوفة الأعضاء ومعالجة الحالات الحدية | ✅ متوافق (135 سطر) |
| `src/components/tools/circles/saveCircleSubmit.ts` | 321 | تنسيق حفظ الجمعية، ربط الجدولة، ومعالجة الدفعات | ✅ متوافق (321 سطر) |
| `src/components/tools/circles/useMoneyCirclesFormState.ts` | 335 | إدارة حالة نموذج الجمعية وتعديل الأسهم والأعضاء | ✅ متوافق (335 سطر) |
| `src/components/tools/circles/useMoneyCirclesActions.ts` | 309 | إدارة أحداث الجمعيات، الإيداع، الحذف، والتبديل | ✅ متوافق (309 سطر) |
| `src/components/tools/circles/useCirclePayoutSync.ts` | 122 | مزامنة إيداعات الصافي مع سجل المعاملات المالية | ✅ متوافق (122 سطر) |
| `src/components/tools/WorkHoursCalculator.tsx` | 308 | الحاوية المركزية لحاسبة ساعات العمل والقرار الشرائي | ✅ متوافق (308 سطر) |
| `src/components/tools/workHours/WorkHoursInputsCard.tsx` | 253 | بطاقة مدخلات الراتب، الدوام، والسلعة | ✅ متوافق (253 سطر) |
| `src/components/tools/workHours/WorkHoursVisualResultCard.tsx` | 123 | بطاقة عرض ساعات العمل والنسبة من الراتب | ✅ متوافق (123 سطر) |
| `src/components/tools/workHours/WorkHoursDecisionInsightCard.tsx` | 196 | بطاقة بصيرة الأثر الشرائي على الميزانية وتسجيل المصروف | ✅ متوافق (196 سطر) |
| `src/components/tools/workHours/workHoursPrefs.ts` | 123 | إدارة التفضيلات المحلية والمقارنات المرجعية للعملات | ✅ متوافق (123 سطر) |

---

## 3. التدقيق التفصيلي حسب المحاور الأربعة الإلزامية

### المحور الأول: دستور التصميم والمحرمات البصرية (Design System & Visual Taboos Compliance)

#### [TOOLS-TABOO-01] حظر أزرار الإلغاء الزائدة في أسفل النوافذ المنبثقة
- **الموقع الدقيق:**
  1. `src/components/tools/circles/CircleFormModal.tsx`، الأسطر 414–420:
     ```tsx
     <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 ... flex items-center justify-end gap-2.5">
       <Button type="button" variant="ghost" onClick={onClose}>
         إلغاء
       </Button>
       <Button type="submit" variant="primary" disabled={submitting}>
         {submitting ? ... : ...}
       </Button>
     </div>
     ```
  2. `src/components/tools/circles/CircleConfirmationModals.tsx`، الأسطر 55–60:
     ```tsx
     <Button variant="ghost" onClick={onCloseDelete}>
       إلغاء
     </Button>
     ```
  3. `src/components/tools/circles/CircleConfirmationModals.tsx`، الأسطر 86–91:
     ```tsx
     <Button variant="ghost" onClick={onCloseComplete}>
       إلغاء
     </Button>
     ```
  4. `src/components/tools/circles/CircleSwapTurnsModal.tsx`، الأسطر 49–55:
     ```tsx
     <Button variant="ghost" onClick={onClose} disabled={isSwapping}>
       إلغاء
     </Button>
     ```
- **مرجع المحرمة البصرية:** `[TABOO-20]` (حظر أزرار الإلغاء الزائدة في أسفل النوافذ — `No Redundant Cancel Buttons in Modal Footers`).
- **الوصف الهندسي:** تنص القاعدة `[TABOO-20]` صراحةً على: *"يُحظر وضع زر "إلغاء" في شريط الإجراءات السفلي للنوافذ المنبثقة؛ فزر الإغلاق العلوي X وإيماءة السحب للأسفل والنقر خارج النافذة على الخلفية المعتمة تكفي تماماً وتلغي الحاجة لزر إلغاء يشوه البساطة السويسرية لشريط الحفظ"*. جميع النوافذ المنبثقة الأربعة في مجلد الجمعيات تخالف هذه القاعدة الصريحة بنسبة 100% وتضع زراً شبحياً مكرراً باسم "إلغاء".
- **أثر الحاسوب (Desktop):** ازدحام شريط الإجراءات السفلي وزيادة العبء الإدراكي (Cognitive Load) بوجود زرين متجاورين في حين أن زر الإغلاق القياسي `X` ومفتاح `Escape` يفيان بالغرض.
- **أثر الهاتف (Mobile):** يقتطع زر الإلغاء غير الضروري مساحة أفقية ثمينة من شريط الإجراءات السفلي المثبت في نافذة السحب السفلية (Bottom Sheet)، مما يقلص مساحة زر التأكيد الرئيسي للإبهام ويزيد من احتمالية النقر الخاطئ.
- **الأثر المباشر على المستخدم:** تشويه النقاء السويسري لشاشات الإدخال، وخلق تردد لدى المستخدم عند تأكيد العمليات المالية.

---

#### [TOOLS-TABOO-02] تكديس الصناديق داخل الصناديق في بطاقات الجمعيات وبصيرة الشراء
- **الموقع الدقيق:**
  1. `src/components/tools/circles/CircleTurnBanners.tsx`، الأسطر 81, 91, 108, 124, 157, 179, 288, 318, 358:
     ```tsx
     // مثال على أحد الصناديق المتراكمة داخل Card
     <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row ...">
     ```
  2. `src/components/tools/circles/CircleMembersSchedule.tsx`، السطر 73:
     ```tsx
     <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden bg-white dark:bg-[#121215]">
     ```
  3. `src/components/tools/circles/CircleInstallmentsHistory.tsx`، الأسطر 34 و 122.
  4. `src/components/tools/workHours/WorkHoursInputsCard.tsx`، السطر 169:
     ```tsx
     <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between ...">
     ```
  5. `src/components/tools/workHours/WorkHoursVisualResultCard.tsx`، السطر 109.
  6. `src/components/tools/workHours/WorkHoursDecisionInsightCard.tsx`، الأسطر 93, 111, 137.
- **مرجع المحرمة البصرية:** `[TABOO-01]` (حظر الصناديق داخل الصناديق — `No Box-in-Box Clutter`) والباب الرابع (§4.3) والباب السادس (§6.1).
- **الوصف الهندسي:** يُلزم الدستور بحظر وضع حاويات ذات حدود وخلفيات فرعية داخل البطاقات (`Card`)، ويشترط استخدام التقسيم السويسري بالخطوط الرفيعة (`Swiss Split Dividers: divide-x / divide-y`). في `CircleCard`، يتم وضع ما يصل إلى **4 صناديق ذات خلفيات وحدود رمادية وكهرمانية مستقلة** مكدسة رأسياً داخل البطاقة الواحدة! وفي بطاقة `WorkHoursDecisionInsightCard`، تم تقسيم المؤشرات الثلاثة إلى 3 صناديق محاطة بإطارات وظلال داخل البطاقة، بدلاً من شبكة موحدة مفصولة بخط فاصل `divide-x`.
- **أثر الحاسوب (Desktop):** ظهور طبقات بصرية كثيفة ومربكة (Nested Containers) تجعل الواجهة تبدو ككتل إسمنتية متراكمة بدلاً من السلاسة السويسرية المسطحة.
- **أثر الهاتف (Mobile):** التكديس يلتهم هوامش الشاشة الداخلية (Padding Nesting)، مما يدفع النصوص نحو المنتصف ويقلص المساحة المتاحة لعرض الأرقام وتفاصيل الجمعية.
- **الأثر المباشر على المستخدم:** شعور بالتكدس البصري والإرهاق اللوني، وصعوبة قراءة بيانات الأقساط والأدوار بسلاسة.

---

#### [TOOLS-TABOO-03] تعدد أشرطة التمرير الرأسية المتداخلة داخل نافذة إنشاء وتعديل الجمعية
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleCategorySelectors.tsx`، السطور 34 و 80:
    ```tsx
    <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-0.5">
    ```
  - `src/components/tools/circles/CircleMembersListInput.tsx`، السطر 26:
    ```tsx
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
    ```
  - `src/components/tools/circles/CircleFormModal.tsx`، السطر 109: النافذة الرئيسية الحاوية ذات شريط التمرير الخارجي.
- **مرجع المحرمة البصرية:** `[TABOO-06]` (حظر التمرير الداخلي المتداخل — `No Nested Scrollbars`).
- **الوصف الهندسي:** تنص القاعدة `[TABOO-06]` على: *"يُمنع وضع قوائم ذات `max-h-* overflow-y-auto` متتالية داخل نافذة منبثقة (Modal) قابلة للتمرير أصلاً"*. نافذة `CircleFormModal` تجمع في وقت واحد:
  1. شريط تمرير النافذة العام.
  2. شريط تمرير شبكة تصنيف المصاريف (`max-h-36 overflow-y-auto`).
  3. شريط تمرير شبكة تصنيف الدخل (`max-h-36 overflow-y-auto`).
  4. شريط تمرير قائمة أسماء الأعضاء (`max-h-48 overflow-y-auto`).
  ما مجموعه **4 مناطق تمرير عمودية متزامنة** داخل نفس النافذة!
- **أثر الحاسوب (Desktop):** عند تحريك عجلة الفأرة للتمرير إلى أسفل الفورم، تعلق الفأرة داخل مصفوفة التصنيف أو قائمة الأعضاء فيبدأ الصندوق الصغير بالتمرير ويتوقف الفورم كاملاً، مما يجبر المستخدم على نقل مؤشر الفأرة إلى أطراف النافذة.
- **أثر الهاتف (Mobile):** كارثة تفاعلية بصرية تسمى "مصيدة التمرير" (Scroll Trap)؛ حيث يعلق إبهام المستخدم في سحب صندوق الأعضاء أو التصنيفات ويعجز عن التمرير لأعلى أو لأسفل النافذة لإيجاد زر الحفظ أو مراجعة الحقول العلوية.
- **الأثر المباشر على المستخدم:** شعور شديد بالإحباط والعجز عن التمرير السلس، ومغادرة الفورم دون إتمام الحفظ.

---

#### [TOOLS-TABOO-04] استخدام كبسولات وخلفيات ملونة على الشارات ومربعات الأيقونات والسطور
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleCard.tsx`، الأسطر 363–366 و 414:
    ```tsx
    <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
      ({circle.membersCount - paidMembersCount} متأخر)
    </span>
    // والسطر 414:
    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
      ({unpaidUserMonths.length} غير مسدد)
    </span>
    ```
  - `src/components/tools/circles/CircleMembersSchedule.tsx`، الأسطر 124–131:
    ```tsx
    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-800">
      معلّق يدوياً
    </span>
    ```
  - `src/components/tools/workHours/WorkHoursVisualResultCard.tsx`، الأسطر 41–50:
    ```tsx
    impactTier === 'medium' && 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    impactTier === 'heavy' && 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
    ```
  - `src/components/tools/workHours/WorkHoursVisualResultCard.tsx`، السطر 111:
    ```tsx
    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ...">
    ```
  - `src/components/tools/circles/CircleCard.tsx`، السطر 188: حاوية أيقونة التاج `bg-blue-600 text-white`.
  - `src/components/tools/circles/CircleMembersSchedule.tsx` (السطر 101) و `CircleInstallmentsHistory.tsx` (السطور 49 و 147): تلوين خلفيات الصفوف بـ `bg-amber-50/30` و `bg-blue-50/40`.
- **مرجع المحرمة البصرية:** `[TABOO-02]` (حظر الكبسولات الملونة) و `[TABOO-03]` (حظر مهرجان الألوان — `No Color Carnival`) وقاعدة الحياد 90/10 في الباب الأول (§1.2).
- **الوصف الهندسي:** يُلزم الدستور بأن تظل كافة الشارات والأفاتار ومربعات الأيقونات محايدة تماماً (`bg-zinc-100 dark:bg-zinc-800`) مع اقتصار التلوين الدلالي على نصوص الأرقام المالية الصريحة أو لون الأيقونة فقط. الكود هنا ينتهك هذه القاعدة بإدخال خلفيات ملونة حمراء وكهرمانية وزرقاء ووردية على الشارات ومربعات الأيقونات، وخلفيات صفوف الجداول.
- **أثر الحاسوب (Desktop):** تشتت هيبة الأرقام المالية المجاورة نتيجة جذب العين نحو الكبسولات الملونة الصارخة بدلاً من البيانات الأساسية.
- **أثر الهاتف (Mobile):** تصبح البطاقات مشحونة ببقع لونية غير متجانسة تخل بمظهر التطبيق الكربوني المصقول.
- **الأثر المباشر على المستخدم:** تلوث بصري وضعف في التمييز بين البيانات الإلزامية والحالات الإرشادية.

---

#### [TOOLS-TABOO-05] ازدواجية الترويسات الفرعية في واجهة الجمعيات
- **الموقع الدقيق:**
  - `src/pages/ToolsPage.tsx`، الأسطر 43–46:
    ```tsx
    <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-[#E4E4E7] dark:border-[#27272A]">
      <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <span>أداة الجمعيات والصناديق المشتركة</span>
    </div>
    ```
  - يليه مباشرة في `src/components/tools/MoneyCirclesManager.tsx`، الأسطر 145–151:
    ```tsx
    <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      <span>نظام الجمعيات والصناديق المشتركة</span>
    </h3>
    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
      متابعة تحصيل الاشتراكات، الأقساط الشهرية، وسجل سداد الأعضاء بكل شفافية
    </p>
    ```
- **مرجع المحرمة البصرية:** `[TABOO-07]` (حظر الترويسات المزدوجة — `No Double Headers`) و `[TABOO-08]`.
- **الوصف الهندسي:** يعرض المكونان في نفس الشاشة وبشكل رأسي متتابع ترويستين مكررتين: الأولى كبسولة علوية تحمل أيقونة المستخدمين ونص «أداة الجمعيات والصناديق المشتركة»، وتحتها مباشرة ترويسة رئيسية `<h3>` بنفس أيقونة المستخدمين ونص «نظام الجمعيات والصناديق المشتركة».
- **أثر الحاسوب (Desktop):** مظهر غير احترافي يوحي بتركيب واجهتين فوق بعضهما دون تنقيح معماري.
- **أثر الهاتف (Mobile):** حجز مساحة رأسية باهظة في أعلى الشاشة لعناوين مكررة بدلاً من التركيز على بطاقات الجمعيات الفعالة.
- **الأثر المباشر على المستخدم:** تشويش بصري وتكرار لا معنى له لنفس العبارة في مساحة بصرية واحدة.

---

#### [TOOLS-TABOO-06] تكرار مؤشر أجر الساعة الصافي ورمز العملة في نفس المكون
- **الموقع الدقيق:** `src/components/tools/workHours/WorkHoursInputsCard.tsx`:
  - الأسطر 71–76 (شريط الملخص للهاتف):
    ```tsx
    الراتب: {salaryStr || '0'} {config.symbol} • أجر الساعة:{' '}
    <span className="font-bold text-blue-600 dark:text-blue-400">
      <FormattedMoney amountFils={hourlyWageFils} maskAmount={false} />
    </span>
    ```
  - والأسطر 169–174 (الصندوق السفلي في وضع التمدد):
    ```tsx
    <span className="font-medium">صافي أجرك في الساعة الواحدة:</span>
    <span className="font-bold text-blue-600 dark:text-blue-400">
      <FormattedMoney amountFils={hourlyWageFils} maskAmount={false} /> / ساعة
    </span>
    ```
- **مرجع المحرمة البصرية:** `[TABOO-09]` (حظر تكرار المعلومة والمؤشر المالي — `No Metric/Chart Duplication`).
- **الوصف الهندسي:** تنص القاعدة `[TABOO-09]` صراحةً على: *"ويُمنع تكرار "أجرك في الساعة" أو رمز العملة مرتين في نفس المكون"*. في هذا المكون، عند فتح الهاتف وتوسيع حقول الراتب (`isSalaryExpanded = true`)، يظهر مؤشر أجر الساعة في شريط الملخص العلوي، ويظهر مرة أخرى في الصندوق السفلي لنفس البطاقة! بالإضافة إلى ذلك، يتم كتابة `/ ساعة` مكررة ورمز العملة مكرراً بجانب تنسيق `FormattedMoney`.
- **أثر الحاسوب (Desktop):** وجود نص مكرر لنفس المؤشر المالي في بطاقة واحدة.
- **أثر الهاتف (Mobile):** عند النقر على "تعديل" لتوسيع الحقول، يشاهد المستخدم رقم أجر الساعة معروضاً مرتين في شاشة واحدة متقاربة جداً.
- **الأثر المباشر على المستخدم:** ارتباك بصري وتكرار رقمي ينافي الإيجاز السويسري.

---

#### [TOOLS-TABOO-07] مخالفة تدرج استدارة الحواف وتوكنز الوضع الداكن
- **الموقع الدقيق:**
  - `src/pages/ToolsPage.tsx`، الأسطر 37 و 62:
    ```tsx
    className="press-scale inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#121215] ..."
    ```
  - `src/components/tools/MoneyCirclesManager.tsx`، الأسطر 170–174 و 248:
    ```tsx
    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 ..."
    // والسطر 248:
    className="... bg-zinc-100/80 dark:bg-zinc-900 ..."
    ```
  - `src/components/tools/MoneyCirclesManager.tsx`، السطر 193:
    ```tsx
    icon={<Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
    ```
- **مرجع المحرمة البصرية:** الباب الأول (§1.1 جدول التوكنز)، والباب الثالث (§3.2)، والباب الرابع (§4.2 تدرج استدارة الحواف).
- **الوصف الهندسي:**
  1. تم إعطاء أزرار العودة في `ToolsPage` استدارة `rounded-2xl`، بينما ينص الدستور على أن الأزرار تكون حصراً `rounded-xl` أو `rounded-lg`، وأن `rounded-2xl` محجوزة للبطاقات والنوافذ.
  2. استخدام صنف `dark:bg-zinc-900` بدلاً من التوكن الحصري للأسطح والبطاقات في الوضع الداكن `dark:bg-[#121215]` (`carbon-card`).
  3. تمرير أيقونة مستخدمين ملونة ضخمة `w-8 h-8 text-blue-600` في الحالة الفارغة (`EmptyState`) بدلاً من الحاوية الرمادية المحايدة `w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400`.
- **أثر الحاسوب والهاتف:** تباين غير متسق في استدارة الأزرار عن بقية أزرار النظام، وظهور رمادي ساطع غير كربوني في الوضع الداكن يشوه التجربة البصرية الكلية.
- **الأثر المباشر على المستخدم:** انكسار الانسجام البصري الموحد لتطبيق بَصير.

---

### المحور الثاني: معوقات الاستخدام والاحتكاك التفاعلي (UX Friction & Usability Hurdle Detection)

#### [TOOLS-UX-01] تصادم الأزرار الدقيقة وعجز مقاييس اللمس وخطر الحذف العرضي
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleCard.tsx`، الأسطر 264–280:
    ```tsx
    <button
      type="button"
      onClick={() => handleOpenEditModal(circle)}
      className="p-2 rounded-xl text-zinc-400 hover:text-blue-600 ... cursor-pointer"
      title="تعديل الجمعية"
    >
      <Pencil className="w-4 h-4" />
    </button>
    <button
      type="button"
      onClick={() => setDeleteCircleId(circle.id)}
      className="p-2 rounded-xl text-zinc-400 hover:text-red-500 ... cursor-pointer"
      title="حذف الجمعية"
    >
      <Trash2 className="w-4 h-4" />
    </button>
    ```
  - `src/components/tools/circles/CircleMembersSchedule.tsx`، السطر 168: زر تبديل الدور (`p-1.5` مع `w-3.5 h-3.5` بمساحة 26×26px).
  - `src/components/tools/circles/CircleTurnBanners.tsx`، السطور 171–175, 231, 248, 275: رابط "إلغاء الإيداع" (`text-[11px] underline` بارتفاع 14px).
  - `src/components/tools/workHours/WorkHoursInputsCard.tsx`، الأسطر 125–156: مبدل `شهرياً / أسبوعياً` (`px-1.5 py-0.5 text-[10px]` بارتفاع 19px).
  - `src/components/tools/circles/CircleMembersSchedule.tsx` (السطر 42) و `CircleInstallmentsHistory.tsx` (السطر 91): أزرار الشهور والدفعات (`py-1 text-xs` بارتفاع ~28px).
- **الوصف الهندسي:** تنص معايير إمكانية الوصول والتصميم اللمسي (Apple HIG & Material Guidelines والباب الرابع §4.1) على ألا يقل مقاس أي عنصر قابل للنقر باللمس عن **44×44 بكسل**. في بطاقة الجمعية، تم وضع زري التعديل والحذف بمقاس 32×32 بكسل فقط ملتصقين ببعضهما تماماً دون مسافة فاصلة آمنة.
- **أثر الحاسوب (Desktop):** صعوبة النقر بدقة على روابط إلغاء الإيداع وأزرار التبديل الدقيقة.
- **أثر الهاتف (Mobile):** أثناء محاولة المستخدم الضغط على زر القلم لتعديل الجمعية أثناء المشي أو الاستخدام بيد واحدة، يصطدم إبهامه بزر سلة المحذوفات المجاور فوراً، مما يفتح نافذة تأكيد حذف الجمعية ويثير ذعر المستخدم! ورابط إلغاء الإيداع يكاد يكون مستحيل النقر دون تكبير الشاشة.
- **الأثر المباشر على المستخدم:** احتكاك لمسي شديد، خطر وقوع حوادث حذف غير مقصودة، وصعوبة بالغة في التحكم الدقيق.

---

#### [TOOLS-UX-02] مصيدة التكبير القسري لمتصفحات الهواتف الذكية (iOS Safari Auto-Zoom Trap)
- **الموقع الدقيق:** `src/components/tools/circles/CircleMembersListInput.tsx`، السطر 40:
  ```tsx
  <Input
    type="text"
    className="py-1.5 text-xs flex-1"
    value={customMembers[i] ?? defaultVal}
    onChange={...}
    placeholder={`اسم العضو رقم ${turn}`}
  />
  ```
- **الوصف الهندسي:** يفرض نظام تشغيل iOS في متصفح Safari و WebKit تكبيراً قسرياً مفاجئاً للشاشة بنسبة 20% تقريباً بمجرد تركيز المستخدم على أي حقل إدخال (`<input>`) يقل حجم خطه عن 16 بكسل (`text-base`). المكون هنا يطبق صراحة فئة `text-xs` (12 بكسل).
- **أثر الحاسوب (Desktop):** لا يوجد تكبير، لكن الخط يبدو ضئيلاً داخل الحقل.
- **أثر الهاتف (Mobile):** بمجرد أن ينقر المستخدم على اسم العضو 1 لكتابة اسمه، يقفز المتصفح مكبراً الشاشة ويزيح حواف التطبيق خارج إطار الرؤية، ويضطر المستخدم بعد كتابة كل اسم إلى استخدام إصبعيه لتصغير الصفحة (`Pinch-to-Zoom Out`) للوصول للاسم التالي!
- **الأثر المباشر على المستخدم:** تجربة إدخال معيبة ومزعجة للغاية عند إدارة أسماء أعضاء الجمعية.

---

#### [TOOLS-UX-03] بطاقات دليل الأدوات غير قابلة للنقر (Dead Card Click Trap)
- **الموقع الدقيق:** `src/pages/ToolsPage.tsx`، الأسطر 89–114 والأسطر 117–142:
  ```tsx
  <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs dark:shadow-none hover:border-blue-500/40 transition-all group">
    {/* المحتوى الداخلي والأيقونة والعنوان يتفاعلون مع التحويم group-hover */}
    ...
    <div className="pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => handleOpenTool('circles')}
        ...
      >
        <span>فتح أداة الجمعيات</span>
      </button>
    </div>
  </div>
  ```
- **الوصف الهندسي:** تعطي البطاقة إشارات بصرية واضحة للمستخدم بأنها قابلة للنقر بالكامل؛ فالإطار يتحول للأزرق الفاتح عند التحويم (`hover:border-blue-500/40`)، وخلفية الأيقونة تتلون (`group-hover:bg-blue-50`)، وعنوان الأداة يتحول للأزرق (`group-hover:text-blue-600`). ومع ذلك، فإن حدث النقر `onClick` مقيد فقط بالزر السفلي الصغير، في حين أن مساحة 80% من البطاقة ميتة تفاعلياً (`Dead Click Zone`).
- **أثر الحاسوب (Desktop):** ينقر المستخدم بداهة على متن البطاقة أو العنوان، فلا يحدث أي شيء.
- **أثر الهاتف (Mobile):** يضغط المستخدم بإبهامه على أيقونة الأداة أو اسمها وسط البطاقة، ولا تفتح الأداة، مما يجعله يظن أن الصفحة معلقة حتى يلاحظ الزر السفلي.
- **الأثر المباشر على المستخدم:** انكسار التوقع التفاعلي (Affordance Violation) واحتكاك غير مبرر في التنقل.

---

#### [TOOLS-UX-04] عزل التنقل بين الأدوات وفقدان ترويسة الصفحة
- **الموقع الدقيق:** `src/pages/ToolsPage.tsx`، الأسطر 30–77.
- **الوصف الهندسي:** عند فتح أي أداة فرعية (`activeTool === 'circles'` أو `activeTool === 'work_hours'`)، تختفي ترويسة الصفحة الأساسية `PageHeader`، ويتم استبدالها بشريط مخصص يحمل زراً للرجوع إلى قائمة الأدوات. هذا النمط يعزل الأداتين في مسارين مغلقين؛ فالمستخدم الراغب في التبديل بين الجمعيات وحاسبة العمل يجب عليه النقر على "العودة لقائمة الأدوات"، ثم الانتظار وتحميل القائمة، ثم النقر على الأداة الأخرى.
- **أثر الحاسوب (Desktop):** غياب التبويب المباشر السلس (`SegmentedControl` أو Tabs) الذي يسمح بالتنقل اللحظي بين الأداتين.
- **أثر الهاتف (Mobile):** قفزة في التخطيط الرأسي واختفاء ترويسة الصفحة، وإجبار المستخدم على رحلة نقر دائرية غير ضرورية.
- **الأثر المباشر على المستخدم:** شعور بالانفصال بين أدوات التطبيق، وصعوبة المقارنة بين الأدوات في جلسة العمل الواحدة.

---

#### [TOOLS-UX-05] تعطيل الإغلاق الصامت بالنقر خارج النافذة
- **الموقع الدقيق:** `src/components/tools/circles/CircleFormModal.tsx`، السطر 113:
  ```tsx
  closeOnBackdropClick={Boolean(!editingCircle && !name.trim())}
  ```
- **الوصف الهندسي:** يتم قفل خاصية إغلاق النافذة عند النقر على الخلفية المعتمة (`Backdrop`) بصورة صامتة إذا كان المستخدم في وضع التعديل أو إذا كتب حرفاً واحداً في اسم الجمعية.
- **أثر الحاسوب (Desktop):** عندما ينقر المستخدم خارج النافذة لإغلاقها، لا تستجيب إطلاقاً دون إظهار أي تلميح أو اهتزاز توضيحي.
- **أثر الهاتف (Mobile):** المستخدم على الهاتف معتاد على لمس خلفية التعتيم العلوية لإغلاق درج السحب؛ إبطالها هنا يجعله يشعر بأن التطبيق تجمد.
- **الأثر المباشر على المستخدم:** إحساس بفقدان السيطرة على الواجهة والارتباك التفاعلي.

---

### المحور الثالث: الحشو والنصوص المولدة بالذكاء الاصطناعي (AI Slop & Superficial Decor Pattern Detection)

#### [TOOLS-SLOP-01] الصياغة الإنشائية الحوارية والأسئلة الخطابية المصطنعة
- **الموقع الدقيق:**
  - `src/components/tools/workHours/WorkHoursDecisionInsightCard.tsx`، السطور 154–156 و 164:
    ```tsx
    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
      اتخذت قرارك النهائي بشراء هذه السلعة؟
    </span>
    <Button ...>
      تسجيل كمصروف الآن
    </Button>
    ```
  - `src/components/tools/circles/CircleConfirmationModals.tsx`، السطر 66:
    ```tsx
    {isDeleting ? 'جاري الحذف...' : 'نعم، حذف الجمعية'}
    ```
- **مرجع المحرمة البصرية:** `[TABOO-08]` (حظر الحشو النصي والشرح البديهي الزائد — `No AI Verbosity & Filler Copy`).
- **الوصف الهندسي:** يُحظر في الدستور السويسري استخدام لغة حوارية عاطفية أو طرح أسئلة إنشائية على المستخدم قبل تنفيذ الإجراءات المالية. عبارة `"اتخذت قرارك النهائي بشراء هذه السلعة؟"` هي نمط كلاسيكي من نصوص الذكاء الاصطناعي الترويجية المفتعلة. كما أن إضافة كلمة `"الآن"` في الأزرار ("تسجيل كمصروف الآن") وصياغة التأكيد الودي ("نعم، حذف الجمعية") تخالف معايير الصياغة الوظيفية المباشرة ("تسجيل المصروف"، "حذف الجمعية").
- **أثر الحاسوب والهاتف:** إهدار للمساحة وتشتيت لتركيز المستخدم بلغة خطابية مبتذلة.
- **الأثر المباشر على المستخدم:** انخفاض الثقة المهنية في رصانة النظام المالي لتطبيق بَصير.

---

#### [TOOLS-SLOP-02] حقن وسوم وعلامات مائية برمجية في معاملات المستخدم المالية
- **الموقع الدقيق:** `src/components/tools/workHours/WorkHoursDecisionInsightCard.tsx`، السطر 184:
  ```tsx
  duplicateFrom={{
    id: '',
    type: 'expense',
    amountFils: itemPriceFils,
    title: itemName || 'مشتريات جديدة',
    note: `شراء ${itemName || 'سلعة'} (محسوبة من حاسبة ساعات العمل)`,
    ...
  }}
  ```
- **مرجع المحرمة البصرية:** `[TABOO-08]` وقواعد نزاهة البيانات المالية في `AGENTS.md`.
- **الوصف الهندسي:** عند نقر المستخدم على زر تسجيل المصروف، يقوم النظام بحقن عبارة نظام ترويجية زائدة داخل حقل ملاحظات المعاملة الصريح: `(محسوبة من حاسبة ساعات العمل)`. المعاملة المالية ملك للمستخدم، وحقن جمل توضح من أين أتى بالمعاملة يلوث دفتر اليومية ببيانات وصفية متطفلة تظهر لاحقاً في كشوفات الحساب وتقارير التصدير و CSV!
- **أثر الحاسوب والهاتف:** تلوث سجل المعاملات التاريخي بنصوص مكررة لا معنى لها للمستخدم.
- **الأثر المباشر على المستخدم:** اضطرار المستخدم لمسح الجملة يدوياً في كل مرة يسجل فيها مصروفاً عبر الحاسبة، أو بقاؤها كعلامة مائية مشوهة في تقاريره.

---

#### [TOOLS-SLOP-03] جمل وعظية وشروحات مفرطة تحت مفاتيح التبديل (Toggles)
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleFormModal.tsx`، السطور 352–354 والسطور 396–398:
    ```tsx
    <Toggle
      checked={autoSchedule}
      ...
      label="جدولة القسط في المعاملات المتكررة"
      description={`يخصم القسط شهرياً تلقائياً، مع تخطي الخصم تلقائياً في شهر استلامك (الشهر ${myTurnMonth})`}
    />
    // ومفتاح المدير:
    <Toggle
      checked={isManager}
      ...
      label="أنا مدير الجمعية (تتبع أسماء ودفعات جميع الأعضاء)"
      description="فعّل هذا الخيار إذا كنت أنت من يدير الجمعية وترغب بتسجيل أسماء جميع المشتركين ومتابعة من دفع ومن لم يدفع كل شهر."
    />
    ```
  - `src/components/tools/circles/CircleConfirmationModals.tsx`، السطور 49–51.
- **مرجع المحرمة البصرية:** `[TABOO-08]` (حظر كتابة جمل وعظية من سطرين تحت كل مفتاح Toggle).
- **الوصف الهندسي:** تنص القاعدة `[TABOO-08]` صراحةً على: *"يُمنع كتابة جمل وعظية من سطرين تحت كل مفتاح Toggle"*. الوصف الموضوع تحت خيار المدير يكرر نفس عنوان الخيار حرفياً بإسهاب مدرسي بديهي: "فعّل هذا الخيار إذا كنت أنت من يدير الجمعية وترغب بتسجيل أسماء جميع المشتركين...".
- **أثر الحاسوب والهاتف:** استهلاك مساحة رأسية في نوافذ الإدخال دون أي قيمة مضافة.
- **الأثر المباشر على المستخدم:** إجهاد قراءة وبطء في ملء استمارة الجمعية.

---

#### [TOOLS-SLOP-04] نصوص إعلانية وعاطفية مكررة بعلامات التعجب
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleTurnBanners.tsx`:
    - السطر 94: `"اكتملت جميع التزامات وأدوار هذه الجمعية! يمكنك الآن نقلها إلى الأرشيف (مكتملة)."`
    - السطور 128 و 131: `"هذا الشهر هو دورك في الاستلام! ستقبض ... حان موعد استلام حصتك من الجمعية! الصافي بعد حسم قسطك لهذا الشهر ..."`
    - السطر 292: تكرار عبارة `"حان موعد استلام حصتك من الجمعية!"` مرة أخرى في نفس المكون!
  - `src/components/tools/MoneyCirclesManager.tsx`، السطر 150: `"متابعة تحصيل الاشتراكات، الأقساط الشهرية، وسجل سداد الأعضاء بكل شفافية"`.
  - `src/components/tools/circles/CircleInstallmentsHistory.tsx`، السطر 120: وسم `"للاطلاع والشفافية"`.
  - `src/components/tools/circles/CircleCard.tsx`، السطر 427: نص زر الإجراء المحشو بالشرح الإرشادي: `'سجل أقساطي الشهرية (تسجيل / إلغاء الدفع)'`.
- **مرجع المحرمة البصرية:** `[TABOO-08]` (حظر الحشو النصي والشرح البديهي).
- **الوصف الهندسي:** استخدام مفرط لعلامات التعجب (!) والعبارات الترويجية الاستعراضية مثل "بكل شفافية" و "للاطلاع والشفافية"، وتضمين تعليمات الاستخدام بين أقواس داخل نصوص الأزرار (`تسجيل / إلغاء الدفع`).
- **أثر الحاسوب والهاتف:** هبوط في المستوى المهني للواجهة وتطويل لنصوص الأزرار والبطاقات.
- **الأثر المباشر على المستخدم:** شعور بأن الواجهة غير مصقولة وتكثر من الملاحظات التوجيهية الزائدة.

---

#### [TOOLS-SLOP-05] أخطاء لغوية في صياغة حالات التحميل بالأزرار
- **الموقع الدقيق:**
  - `src/components/tools/circles/CircleFormModal.tsx`، الأسطر 424–425: `'جاري الحفظ...'` و `'جاري الإنشاء...'`.
  - `src/components/tools/circles/CircleConfirmationModals.tsx`، الأسطر 66 و 97: `'جاري الحذف...'` و `'جاري الإنهاء...'`.
  - `src/components/tools/circles/CircleSwapTurnsModal.tsx`، السطر 61: `'جاري التبديل...'`.
- **الوصف الهندسي:** خطأ لغوي ونحوي شائع في نصوص واجهات الذكاء الاصطناعي يتمثل في إثبات الياء في الاسم المنقوص النكرة في موضع رفع ("جاري") والصواب النحوي "جارٍ"، أو الأفضل معمارياً وسويسرياً هو استخدام أيقونة دوران ناعمة بجانب النص المباشر.
- **أثر الحاسوب والهاتف:** ضعف الصياغة اللغوية لواجهة عربية فصيحة.
- **الأثر المباشر على المستخدم:** انخفاض مصداقية الصياغة اللغوية للتطبيق.

---

### المحور الرابع: التكافؤ بين الهاتف والحاسوب (Desktop & Mobile Cross-Platform Parity)

#### [TOOLS-RESP-01] تشوه وقص حاد في شبكة التصنيفات على شاشات الهاتف الضيقة
- **الموقع الدقيق:** `src/components/tools/circles/CircleCategorySelectors.tsx`، الأسطر 29–120:
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {/* كل تصنيف يحتوي على شبكة من 3 أعمدة */}
    <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-0.5">
  ```
- **الوصف الهندسي:** يتم عرض التصنيفات في شبكة ثابتة من 3 أعمدة (`grid-cols-3`). على شاشات الهواتف المحمولة الضيقة (مثل iPhone SE أو Galaxy A بعرض 360px إلى 390px)، يصبح عرض العمود الواحد أقل من 75 بكسل، مما يؤدي إلى:
  1. ضغط الأيقونة والنص وعلامة الصح في مساحة مجهرية.
  2. قص اسم التصنيف بالكامل (مثال: "سداد الديون والأقساط" تظهر "سـ..." فقط).
  3. تداخل علامة `<Check />` الزرقاء مباشرة فوق الحرف الأول من اسم التصنيف.
- **أثر الحاسوب (Desktop):** المساحة كافية وتظهر التصنيفات بشكل مقبول.
- **أثر الهاتف (Mobile):** استحالة قراءة أسماء التصنيفات عند إنشاء أو تعديل الجمعية، واختيار التصنيف بالحظ أو التخمين من خلال لون الأيقونة فقط.
- **الأثر المباشر على المستخدم:** عجز تام عن اختيار التصنيف المالي الصحيح على الهاتف واختلال تصنيف المعاملات المربوطة بالجمعية.

---

#### [TOOLS-RESP-02] تناقض شريط الراتب المطوي على الهاتف مع التخطيط الموسع
- **الموقع الدقيق:** `src/components/tools/workHours/WorkHoursInputsCard.tsx`، الأسطر 68–91.
- **الوصف الهندسي:** على الهاتف، يحتوي المكون على شريط ملخص علوي مدمج للراتب وأجر الساعة لحفظ المساحة. ولكن المشكلة تكمن في أنه عند النقر على "تعديل" لفتح حقول الإدخال، يبقى الشريط العلوي ظاهراً في مكانه ولا يختفي! هذا يؤدي إلى:
  1. ظهور مؤشر "أجر الساعة" مرتين على شاشة الهاتف.
  2. دفع بطاقة النتيجة وحساب ساعات العمل بعيداً جداً إلى أسفل الشاشة، بحيث يحتاج المستخدم للتمرير المتكرر لأعلى وأسفل لرؤية أثر تعديل الراتب أو السلعة.
- **أثر الحاسوب (Desktop):** التخطيط يعرض المدخلات في عمود والنتائج في عمود مجاور متوازن.
- **أثر الهاتف (Mobile):** انفصال بصري وتكرار للمعلومة، واختفاء النتيجة التفاعلية المباشرة تحت طيّة الشاشة (`Below the Fold`).
- **الأثر المباشر على المستخدم:** فقدان ميزة الحساب التفاعلي الفوري (Instant Reactive Feedback) على الهاتف.

---

#### [TOOLS-RESP-03] تفتت ترويسة بطاقة الجمعية على الهاتف إلى صفوف غير متناسقة
- **الموقع الدقيق:** `src/components/tools/circles/CircleCard.tsx`، الأسطر 182–280:
  ```tsx
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
    <div className="flex items-center gap-3">...</div>
    <div className="flex items-center gap-2 self-end sm:self-auto">...</div>
  </div>
  ```
- **الوصف الهندسي:** تضم ترويسة بطاقة الجمعية عدداً كبيراً من العناصر: أيقونة الجمعية، اسم الجمعية، شارات السهم، قسط الشهر، عدد الأعضاء، زر إنهاء الجمعية، إجمالي المقبوض، زر التعديل، وزر الحذف. على شاشات الهاتف، ونظراً لاستخدام `flex-col` مع `self-end`، تتفتت الترويسة إلى 3 أو 4 أسطر متداخلة ومتباينة الارتفاع بين بطاقة وأخرى بناءً على طول اسم الجمعية أو وجود زر "إنهاء الجمعية".
- **أثر الحاسوب (Desktop):** تظهر الترويسة في صف أفقي واحد متناسق وموزع بين اليمين واليسار.
- **أثر الهاتف (Mobile):** قفزات مفاجئة في ارتفاع البطاقات وتشتت إجمالي المبلغ المقبوض على سطر منفصل في أقصى اليسار مع انعزال أزرار التعديل والحذف.
- **الأثر المباشر على المستخدم:** مظهر غير منظم وصعوبة في المسح البصري السريع للجمعيات المتعددة.

---

#### [TOOLS-RESP-04] تمدد حقول الإدخال البسيطة أفقياً على شاشات الحاسوب العريضة
- **الموقع الدقيق:** `src/components/tools/workHours/WorkHoursInputsCard.tsx` والشبكة في `WorkHoursCalculator.tsx` (الأسطر 250–291).
- **الوصف الهندسي:** تم تقسيم الصفحة على شاشات الحاسوب بنظام `grid-cols-12` (5 أعمدة للمدخلات و 7 للنتائج). على الشاشات الكبيرة (≥ 1440px)، تتمدد الحاوية إلى أقصى حد مما يجعل حقول إدخال الأرقام البسيطة (مثل خانة "ساعات الدوام = 8" وخانة "أيام العمل = 22") تتمدد أفقياً لأكثر من 220 بكسل لكل حقل رقمي مفرد، مما يخلق مساحات بيضاء فارغة ومفرطة داخل الحقول.
- **أثر الحاسوب (Desktop):** غياب التناسب المعماري بين طول الحقل وحجم البيانات المتوقعة بداخله.
- **أثر الهاتف (Mobile):** الحقول تشغل عرض الشاشة بالكامل وهو النمط الطبيعي للهاتف.
- **الأثر المباشر على المستخدم:** مظهر متمدد بصرياً يفتقر إلى الإحكام والتوازن السويسري على شاشات سطح المكتب الكبيرة.

---

## 4. مصفوفة كافة الملاحظات والخلل المكتشف (Consolidated Issues Matrix)

| المعرف (ID) | المحور الإلزامي | الملف المصدر والسطور | مرجع المحرمة البصرية | أثر الحاسوب | أثر الهاتف | خطورة المشكلة |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`TOOLS-TABOO-01`** | المحور الأول | `CircleFormModal.tsx` (414), `CircleConfirmationModals.tsx` (55, 86), `CircleSwapTurnsModal.tsx` (49) | `[TABOO-20]` | ازدحام شريط الأزرار | تقليص مساحة زر التأكيد للإبهام | **حرجة (Critical)** |
| **`TOOLS-TABOO-02`** | المحور الأول | `CircleTurnBanners.tsx` (81-358), `CircleMembersSchedule.tsx` (73), `WorkHoursDecisionInsightCard.tsx` (93) | `[TABOO-01]` | كتل إسمنتية متراكمة | تآكل هوامش الشاشة وتكدس | **عالية (High)** |
| **`TOOLS-TABOO-03`** | المحور الأول | `CircleCategorySelectors.tsx` (34, 80), `CircleMembersListInput.tsx` (26) | `[TABOO-06]` | توقف تمرير الفورم بالعجلة | مصيدة تمرير وعجز عن النزول | **حرجة (Critical)** |
| **`TOOLS-TABOO-04`** | المحور الأول | `CircleCard.tsx` (188, 363, 414), `CircleMembersSchedule.tsx` (101, 124), `WorkHoursVisualResultCard.tsx` (41, 111) | `[TABOO-02]`, `[TABOO-03]` | تشتت هيبة الأرقام المالية | بقع لونية فاقعة متنافرة | **عالية (High)** |
| **`TOOLS-TABOO-05`** | المحور الأول | `ToolsPage.tsx` (43–46) مقابل `MoneyCirclesManager.tsx` (145–151) | `[TABOO-07]` | مظهر ترقيعي غير مصقول | استهلاك مساحة رأسية باهظة | **متوسطة (Medium)** |
| **`TOOLS-TABOO-06`** | المحور الأول | `WorkHoursInputsCard.tsx` (68–76 و 169–174) | `[TABOO-09]` | تكرار المؤشر المالي | ظهور أجر الساعة مرتين بالصفحة | **متوسطة (Medium)** |
| **`TOOLS-TABOO-07`** | المحور الأول | `ToolsPage.tsx` (37, 62), `MoneyCirclesManager.tsx` (170, 193) | §1.1, §3.2, §4.2 | استدارة أزرار شاذة ورمادي باهت | انكسار الانسجام اللوني والشكلي | **متوسطة (Medium)** |
| **`TOOLS-UX-01`** | المحور الثاني | `CircleCard.tsx` (264–280), `CircleMembersSchedule.tsx` (168), `CircleTurnBanners.tsx` (171) | إمكانية الوصول (§4.1) | صعوبة النقر الدقيق بالفأرة | خطر الحذف العرضي وعجز اللمس | **حرجة (Critical)** |
| **`TOOLS-UX-02`** | المحور الثاني | `CircleMembersListInput.tsx` (40) | §2.2 (البند 6) | خط صغير داخل الحقل | تكبير قسري 20% على Safari | **حرجة (Critical)** |
| **`TOOLS-UX-03`** | المحور الثاني | `ToolsPage.tsx` (89–114, 117–142) | مبادئ تجربة الاستخدام | نقر عقيم على متن البطاقة | نقر متكرر دون استجابة | **عالية (High)** |
| **`TOOLS-UX-04`** | المحور الثاني | `ToolsPage.tsx` (30–77) | هندسة الشاشات (§6.2) | غياب التبويب اللحظي | دورة نقر ورجوع إجبارية | **متوسطة (Medium)** |
| **`TOOLS-UX-05`** | المحور الثاني | `CircleFormModal.tsx` (113) | بنية النوافذ (§8.2) | عدم استجابة النقر بالخلفية | شعور بتجمد النافذة | **متوسطة (Medium)** |
| **`TOOLS-SLOP-01`** | المحور الثالث | `WorkHoursDecisionInsightCard.tsx` (154, 164), `CircleConfirmationModals.tsx` (66) | `[TABOO-08]` | لغة حوارية غير مهنية | نصوص دعائية تعيق الإيجاز | **متوسطة (Medium)** |
| **`TOOLS-SLOP-02`** | المحور الثالث | `WorkHoursDecisionInsightCard.tsx` (184) | نزاهة المعاملات المالية | علامة مائية تلوث التقارير | تشويه دفتر المعاملات اليومي | **عالية (High)** |
| **`TOOLS-SLOP-03`** | المحور الثالث | `CircleFormModal.tsx` (352, 396), `CircleConfirmationModals.tsx` (49) | `[TABOO-08]` | شرح مدرسي بديهي | إطالة فورم الإدخال رأسياً | **متوسطة (Medium)** |
| **`TOOLS-SLOP-04`** | المحور الثالث | `CircleTurnBanners.tsx` (94, 128, 292), `MoneyCirclesManager.tsx` (150), `CircleCard.tsx` (427) | `[TABOO-08]` | علامات تعجب ونصوص حماسية | إطالة نصوص الأزرار والبطاقات | **متوسطة (Medium)** |
| **`TOOLS-SLOP-05`** | المحور الثالث | `CircleFormModal.tsx` (424), `CircleConfirmationModals.tsx` (66, 97) | السلامة اللغوية | أخطاء نحوية في الاسم المنقوص | صياغة لغوية ركيكة بالأزرار | **منخفضة (Low)** |
| **`TOOLS-RESP-01`** | المحور الرابع | `CircleCategorySelectors.tsx` (29–120) | التجاوب والشاشات الضيقة | ظهور مقبول بمساحة واسعة | قص تام للأسماء وتداخل الصح | **حرجة (Critical)** |
| **`TOOLS-RESP-02`** | المحور الرابع | `WorkHoursInputsCard.tsx` (68–91) | تكافؤ شاشات اللمس | انعدام المشكلة على الشاشات الكبيرة | تكرار المؤشر ودفع النتيجة لأسفل | **عالية (High)** |
| **`TOOLS-RESP-03`** | المحور الرابع | `CircleCard.tsx` (182–280) | التناسق البصري العمودي | صف أفقي موحد | تفتت الترويسة لـ 4 أسطر متذبذبة | **عالية (High)** |
| **`TOOLS-RESP-04`** | المحور الرابع | `WorkHoursInputsCard.tsx` (107–167) | التوازن الشبكي للحاسوب | تمدد فارغ لحقول الأرقام | الحقول متجاوبة طبيعياً | **متوسطة (Medium)** |

---

## 5. التوصيات والمسار الهندسي المقترح (Architectural Recommendations)

1. **توحيد النوافذ المنبثقة وحذف أزرار الإلغاء الزائدة فوراً (`Eliminate Taboo-20`):**
   - حذف أزرار "إلغاء" من أسفل `CircleFormModal` و `CircleConfirmationModals` و `CircleSwapTurnsModal`، والاكتفاء الحصري بزر التأكيد الرئيسي الملون بالياقوتي أو الأحمر التدميري مع زر `X` العلوي وإيماءة السحب والإفلات السفلية.
2. **تفكيك الصناديق المتداخلة وتطبيق التقسيم السويسري (`Swiss Divider Refactor`):**
   - استبدال الصناديق الثلاثة في بطاقة `WorkHoursDecisionInsightCard` بشبكة موحدة مقسمة عبر `divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A]`.
   - دمج لافتات الجمعية المتعددة في `CircleTurnBanners` داخل خط حالة علوي موحد أو صف رقيق، وإلغاء خلفيات الإطارات المتراكمة داخل `CircleCard`.
3. **القضاء على مصيدة التمرير في نافذة الجمعية (`Modal Scroll Sanitization`):**
   - إلغاء أشرطة التمرير الداخلية (`max-h-36 overflow-y-auto`) في اختيار التصنيفات وإدراج أسماء الأعضاء؛ واعتماد نمط الشبكة القابلة للطي بزر "عرض كل التصنيفات" المعتمد في `TransactionForm`، وجعل قائمة الأعضاء تتدفق ضمن التمرير الطبيعي الموحد للنافذة دون مصائد.
4. **تأمين مقاييس اللمس وإصلاح أخطاء Safari (`Touch & Accessibility Hardening`):**
   - رفع مقاس زري التعديل والحذف في بطاقة الجمعية وزر تبديل الدور إلى ارتفاع 44 بكسل مع مسافة فاصلة (`gap-2`) لمنع الحذف العرضي.
   - تحويل حقول أسماء الأعضاء إلى `text-base sm:text-sm` لتفادي عقوبة التكبير القسري بنسبة 20% على هواتف آيفون.
   - جعل كامل مساحة بطاقات دليل الأدوات في `ToolsPage` قابلة للنقر (`cursor-pointer`) لفتح الأداة مباشرة.
5. **تنظيف الواجهة من الحشو والنصوص المولدة بالذكاء الاصطناعي (`AI Slop Purge`):**
   - حذف العلامة المائية المتطفلة `(محسوبة من حاسبة ساعات العمل)` عند تسجيل المصروف.
   - حذف الأسئلة الاستجوابية الإنشائية ("اتخذت قرارك النهائي...؟") وتبسيط نصوص الأزرار لتكون وظيفية ومباشرة ("تسجيل المصروف"، "حذف الجمعية").
   - اختصار فقرات الشرح المطولة تحت مفاتيح التبديل (Toggles) وحذف علامات التعجب المتكررة.
6. **معالجة تشوه شبكة التصنيفات وتناسق الهاتف (`Mobile Parity Fixes`):**
   - تحويل شبكة التصنيفات في شاشات الهاتف الضيقة إلى عمودين أو قائمة أفقية واضحة لمنع قص النصوص وتداخل علامات الصح.
   - إعادة هيكلة ترويسة بطاقة الجمعية على الهاتف لتوزيع الرصيد وأزرار الإجراءات في سطرين منظمين بثبات كامل.
