# تقرير التدقيق الهندسي الجراحي — الجولة الأولى (Pass 1)
## تدقيق هيكل النظام والتقنيات ونموذج البيانات والتخزين المحلي
### مقارنة `docs/PROJECT_BIBLE.md` (القسمين 1 و 2) مقابل الكود الفعلي للمشروع

> **تاريخ التدقيق:** 19 نوفمبر 2026  
> **مرجع الحقيقة الحصري:** الكود المصدري الفعلي تحت `src/`، `firestore.rules`، `package.json`، `vite.config.ts`.  
> **نطاق الجولة:** القسم (1) [نظرة عامة على النظام وهيكل المجلدات] والقسم (2) [نموذج البيانات وقواعد الأمان والتخزين المحلي].

---

## أولاً: المعلومات الخاطئة أو القديمة في البايبل (ما يقوله البايبل vs ما يفعله الكود فعلياً)

### 1.1 قفل المعاملات وحذفها المرتبط (`Transaction Locking & Cascading Deletion`)
* **ما يقوله البايبل (السطور 264-275):**  
  يزعم البايبل أن هناك سبعة أنواع من المعاملات المحددة حتمياً (`debt_init_`, `debt_entry_`, `debt_pay_`, `circle_payout_`, `circle_payout_..._t2`, `circle_..._m...`, `${recurringId}_${yyyy-MM-dd}`)، وأن هذه المعاملات السبع تُقفل حتمياً في `TransactionForm.tsx` و `TransactionsPage.tsx`؛ حيث «يُحظر تعديل المبلغ أو الحساب أو فك القفل يدوياً أو حذفها خارج مسارها المحاسبي المخصص (مثل شاشة الديون أو إدارة الجمعيات أو المعاملات المتكررة)».
* **ما يفعله الكود فعلياً:**  
  1. **حالات القفل الفعلية أربع حالات فقط وليست سبعاً:** في [`src/lib/transactionLocks.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/transactionLocks.ts#L5-L10) و [`resolveTransactionLockStatus`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/transactionLocks.ts#L274-L285)، النوع `TransactionLockReason` يقتصر حصراً على:
     ```typescript
     export type TransactionLockReason = 'debt_init' | 'debt_entry' | 'debt_payment_merged' | 'circle_payout'
     ```
     - معاملات دفعات الديون العادية غير المدمجة (`debt_pay_{paymentId}`) **ليست مقفلة** بواسطة `isLocked`.
     - معاملات الأقساط الشهرية للجمعيات (`circle_{circleId}_m{monthNum}`) **ليست مقفلة** بل تعرض شارة ربط بالجمعية فقط.
     - المعاملات المتكررة المتولدة آلياً (`${recurringId}_${yyyy-MM-dd}`) **ليست مقفلة نهائياً** ويمكن تعديل كافة بياناتها بحرية تامة.
  2. **فك القفل التلقائي عند غياب الأصل (`Orphaned Unlocking`):** في [`src/lib/transactionLocks.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/transactionLocks.ts#L268-L276)، إذا حُذف الدين أو الجمعية الأصلية، تصبح المعاملة يتيمة (`isSourceMissing = true`)، ويُلغى قفلها تلقائياً (`isLocked = false`) لتتيح للمستخدم تعديلها أو حذفها من شاشة المعاملات.
  3. **الحذف المباشر المتسلسل مدعوم بالكامل من شاشة المعاملات:** خلافاً لزعم البايبل بحظر حذفها خارج شاشات الديون والجمعيات، طوّر الكود خطافاً مخصصاً بالكامل [`src/hooks/useTransactionDeletion.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useTransactionDeletion.ts#L55-L140) يتيح للمستخدم حذف هذه المعاملات مباشرة من `TransactionsPage.tsx` مع تنفيذ التراجع المحاسبي المتسلسل تلقائياً:
     - حذف معاملة أصل الدين (`debt_init_`): يستدعي `deleteDebt(userId, debtId, { deleteTransactions: true })` ويحذف الدين بالكامل ذرياً.
     - حذف معاملة دفعة الدين (`debt_pay_`): يستدعي `removeDebtPayment` ويخصم المبلغ من `paidFils` ويعيد فتح الدين إن كان مسدداً.
     - حذف معاملة سلفة إضافية (`debt_entry_`): يستدعي `deleteDebtEntry` ويحدّث رصيد الدين.
     - حذف قسط جمعية شهري: يستدعي `removeCircleInstallmentPayment` ويلغي تسجيل السداد من مصفوفة العضو.
     - الحظر الحقيقي للحذف في شاشة المعاملات ينطبق فقط على: `isMergedDebtPayment` (الدفعة المدمجة) و `isLockedCircle` (معاملة استلام دور الجمعية طالما الجمعية قائمة) في [`src/components/transactions/TransactionRowItem.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionRowItem.tsx#L74).

### 1.2 بنية كائن دفعة الدين (`DebtPayment`)
* **ما يقوله البايبل (السطور 318-326):**  
  يسرد البايبل حقول كائن الدفعة `DebtPayment` كالتالي: (`id`, `amountFils`, `date`, `note`, `transactionId`, `isMerged`, `mergedTransactionIds`).
* **ما يفعله الكود فعلياً:**  
  حقل توقيت الإنشاء `createdAt: Date` موجود وإلزامي في تعريف النوع البرمجي [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L88)، ويُحوّل ويُخزن في Firestore عبر [`src/services/converters.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/converters.ts#L249) و [`tests/firestore.rules.test.ts`](file:///c:/Users/mohan/Desktop/expenses1/tests/firestore.rules.test.ts#L71). البايبل أسقط هذا الحقل تماماً من توثيق كائن الدفعة بينما وثّقه في كائن السلفة `DebtEntry`.

### 1.3 المفاتيح التوافقية القديمة للإشعارات (`Legacy Notification Storage Keys`)
* **ما يقوله البايبل (جدول 2.2، السطور 392-394):**  
  يضع البايبل علامة شرطة `—` أمام المفاتيح التوافقية القديمة لمفاتيح:
  - `baseer_notifications_history_{uid}`
  - `baseer_notifications_dismissed_{uid}`
  - `baseer_notifications_deleted_{uid}`  
  مدعياً عدم وجود مفاتيح قديمة مناظرة لها بنمط `masareefi_*`.
* **ما يفعله الكود فعلياً:**  
  الكود يقرأ ويمسح المفاتيح القديمة صراحة:
  - في [`src/hooks/useNotifications.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useNotifications.ts#L80-L81):
    ```typescript
    const dismissedStorageKey = uid ? `baseer_notifications_dismissed_${uid}` : null
    const legacyDismissedStorageKey = uid ? `masareefi_notifications_dismissed_${uid}` : null
    ```
  - في [`src/services/userProfile.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/userProfile.ts#L294-L297):
    ```typescript
    ;['history', 'read', 'dismissed', 'deleted'].forEach((s) => {
      localStorage.removeItem(`baseer_notifications_${s}_${uid}`)
      localStorage.removeItem(`masareefi_notifications_${s}_${uid}`)
    })
    ```
    المفاتيح `masareefi_notifications_dismissed_*` و `masareefi_notifications_history_*` و `masareefi_notifications_deleted_*` موجودة ومستخدمة فعلياً في الكود.

### 1.4 تبعيات وبنية الحزم البرمجية (`Tech Stack & package.json`)
* **ما يقوله البايبل (الجدول 1.1، السطور 19-34):**  
  يسرد جدول التقنيات 11 مكتبة فقط.
* **ما يفعله الكود فعلياً:**  
  - حزمة التحريك الأساسية **`motion` (إصدار `^14.14.0`)** منصبة في `dependencies` داخل [`package.json`](file:///c:/Users/mohan/Desktop/expenses1/package.json#L22) وتُستخدم في كامل شاشات ومكونات التطبيق وتعتمد عليها توكنز الحركة في [`src/lib/motionTokens.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/motionTokens.ts)، لكنها ساقطة تماماً من جدول البايبل.
  - مكتبة **`clsx` (إصدار `^2.1.1`)** منصبة وتُستخدم في دمج التنسيقات [`src/lib/cn.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/cn.ts) وساقطة من الجدول.

### 1.5 شجرة المجلدات والملفات الوظيفية (`src/ Directory Tree`)
* **ما يقوله البايبل (القسم 1.2، السطور 37-156):**  
  يعرض البايبل شجرة شبه مسطحة، متجاهلاً معظم المجلدات الفرعية والملفات الناتجة عن تطبيق الدستور الهندسي وقاعدة السقف الأقصى لحجم الملفات (Rule 0A).
* **ما يفعله الكود فعلياً:**  
  الكود يحتوي على **عشرات الملفات والمجلدات الفرعية** غير المسردة في الشجرة إطلاقاً (مفصلة بالكامل في القسم ثانياً أدناه).

---

## ثانياً: الميزات والملفات والحقول الموجودة في الكود وغير مذكورة في البايبل (Missing Docs)

### 2.1 حقول وخصائص جديدة في نموذج البيانات (`Data Model & Types`)
1. **خاصية إلغاء/تأكيد دفعات أقساط الجمعيات (`paymentsByMonth`):**
   - **الموقع:** [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L125) في واجهة `CircleMember`:
     ```typescript
     export interface CircleMember {
       id: string
       name: string
       turnMonth: number
       paidMonths: number[]
       paymentsByMonth?: Record<string, boolean>
     }
     ```
   - **الأهمية الفنية:** تُخزن خريطة بحالة دفع أو إلغاء كل شهر (`'1': true` أو `'2': false`). تُستخدم في [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L86-L91) لاستبعاد الأقساط الملغاة يدوياً من التوقع المالي، وتُستخدم في [`src/lib/recurring.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/recurring.ts#L160) و [`src/lib/notifications.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/notifications.ts#L139)، وتُحفظ وتُستعاد في النسخ الاحتياطي عبر [`src/lib/backupRestore/restoreRecords.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreRecords.ts#L70). لم يرد ذكرها مطلقاً في البايبل.
2. **تفاصيل قيود خريطة تفضيلات التنبيهات (`notificationPrefs`):**
   - **الموقع:** [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L50-L58) وقواعد الأمان [`firestore.rules`](file:///c:/Users/mohan/Desktop/expenses1/firestore.rules#L122-L132) في دالة `isValidNotificationPrefs`.
   - **الحقول غير الموثقة في البايبل:**
     * `debtReminderDaysBefore`: رقم صحيح محصور حتماً في `[0, 1, 3]`.
     * `circleAlerts`: boolean.
     * `budgetWarnings`: boolean (تنبيهات استهلاك 80% وتجاوز الميزانية).
     * `dailyReminder`: boolean.
     * `dailyReminderTime`: نص بطول 0..10 (مثل `'21:00'`).
3. **قيود أمان المعاملات المتكررة للجمعيات (`skipMonth` و `skipMonths`):**
   - **الموقع:** [`firestore.rules`](file:///c:/Users/mohan/Desktop/expenses1/firestore.rules#L198-L199) و [`src/services/converters.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/converters.ts#L124-L129).
   - **القيود غير الموثقة في البايبل:** `skipMonth` محصور بين `1` و `50`، و `skipMonths` مصفوفة لا تتجاوز 10 عناصر وقيمها بين `1` و `50`.

---

### 2.2 مفاتيح تخزين محلي وجلسة وأحداث نافذة غير موثقة (`Storage & Events`)
1. **مفاتيح `sessionStorage` غير الموثقة:**
   - `baseer_sw_reload`: في [`src/main.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/main.tsx#L27-L38)، حارس لمنع حلقات إعادة التحميل اللانهائية عند ترقية وتنشيط Service Worker عبر `controllerchange`.
   - `baseer_pin_lockout_until_${uid}` / `baseer_pin_lockout_until`: في [`src/components/security/PinLockGate.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/PinLockGate.tsx#L41,L73)، يخزن توقيت انتهاء فترة الحظر المؤقت بعد تكرار إدخال رمز PIN الخاطئ.
   - `baseer_pin_failed_attempts_${uid}` / `baseer_pin_failed_attempts`: في [`src/components/security/PinLockGate.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/PinLockGate.tsx#L42,L68)، يعد المحاولات الخاطئة المتتالية لرمز PIN.
2. **أحداث التزامن اللحظية غير الموثقة:**
   - حدث المتصفح القياسي `storage`: مستمع إليه في [`src/components/security/PinLockGate.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/PinLockGate.tsx#L108) و [`src/hooks/useNotifications.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useNotifications.ts#L261) لمزامنة قفل PIN وحالة قراءة وأرشفة التنبيهات بين ألسنة التبويب المفتوحة في آن واحد (`Cross-Tab Instant Sync`).
   - أحداث الطباعة `beforeprint` و `afterprint`: في [`src/hooks/useWindowFocusAndPrint.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useWindowFocusAndPrint.ts#L16-L17)، لتبديل المظهر تلقائياً أثناء تصدير كشوف الحسابات كـ PDF.
   - أحداث تثبيت PWA `beforeinstallprompt` و `appinstalled`: في [`src/hooks/usePWAInstall.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePWAInstall.ts#L47-L48).
   - حدث التعافي من انقطاع الشبكة `online` / `offline`: في [`src/hooks/useOnlineStatus.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useOnlineStatus.ts#L19-L20) و [`src/lib/firestoreOffline.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/firestoreOffline.ts#L60).

---

### 2.3 حصر المجلدات والملفات المجزأة والجديدة في الكود (غير المسردة في شجرة البايبل)

#### أ) مكونات الواجهة (`src/components/`)
1. **مجلد `src/components/categories/` (مجلد كامل مفقود من البايبل - 5 ملفات):**
   - [`ArchiveCategoryModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/categories/ArchiveCategoryModal.tsx): نافذة أرشفة التصنيفات والتحقق من العمليات النشطة.
   - [`ArchivedCategoriesSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/categories/ArchivedCategoriesSection.tsx): قسم استعراض واستعادة التصنيفات المؤرشفة.
   - [`CategoryItemRow.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/categories/CategoryItemRow.tsx): سطر التصنيف مع دعم السحب والترتيب اليدوي.
   - [`categoryUsageHelpers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/categories/categoryUsageHelpers.ts): دوال مساعدة لربط استخدام التصنيفات بالفرز.
   - [`DeleteCategoryModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/categories/DeleteCategoryModal.tsx): نافذة الحذف النهائي أو إعادة تعيين المعاملات لتصنيف آخر.

2. **مجلد `src/components/recurring/` (مجلد كامل مفقود من البايبل - 11 ملفاً):**
   - [`RecurringCategoryPicker.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringCategoryPicker.tsx): منتقي التصنيف المخصص للمتكررات.
   - [`RecurringCircleLinkSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringCircleLinkSection.tsx): قسم ربط القاعدة بجمعية قائمة.
   - [`RecurringConfirmModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringConfirmModal.tsx): نافذة تأكيد تسجيل المعاملة المستحقة.
   - [`RecurringDatesSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringDatesSection.tsx): محدد تواريخ البدء والانتهاء والاستحقاق القادم.
   - [`RecurringDeleteModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringDeleteModal.tsx): نافذة تأكيد حذف القاعدة المتكررة.
   - [`recurringFormHelpers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/recurringFormHelpers.ts): دوال التحقق وتجهيز بيانات نموذج التكرار.
   - [`RecurringFrequencySelector.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringFrequencySelector.tsx): محدد الترددات السبعة.
   - [`RecurringHistoryModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringHistoryModal.tsx): سجل المعاملات التاريخية المتولدة عن القاعدة.
   - [`RecurringItemCard.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringItemCard.tsx): بطاقة عرض بند المعاملة المتكررة وإجراءاتها.
   - [`RecurringKpiCards.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/RecurringKpiCards.tsx): بطاقات المؤشرات المالية لإجمالي الالتزامات الدورية.
   - [`useRecurringFormState.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/recurring/useRecurringFormState.ts): خطاف إدارة حالة نموذج المتكررات.

3. **مجلد `src/components/settings/` (مجلد كامل مفقود من البايبل - 11 ملفاً):**
   - [`AppearanceSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/AppearanceSection.tsx): قسم المظهر والسمات اللونية.
   - [`BackupExportSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/BackupExportSection.tsx): قسم النسخ الاحتياطي والاستعادة وتصدير CSV الشامل.
   - [`CurrencySection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/CurrencySection.tsx): قسم العملة والخانات العشرية المخصصة.
   - [`DangerZoneSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/DangerZoneSection.tsx): منطقة الخطر لتصفير البيانات أو حذف الحساب.
   - [`FinancialCycleSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/FinancialCycleSection.tsx): قسم يوم بداية الشهر وتسوية الرصيد وترحيل الفائض.
   - [`index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/index.ts): برميل تصدير أقسام الإعدادات.
   - [`NotificationsSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/NotificationsSection.tsx): تفضيلات الإشعارات والتنبيهات المسبقة.
   - [`PinModals.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/PinModals.tsx): نوافذ ضبط وتغيير وإلغاء رمز PIN.
   - [`ProfileSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/ProfileSection.tsx): قسم الملف الشخصي ولون الشعار والاسم.
   - [`PWAAndAboutSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/PWAAndAboutSection.tsx): قسم التثبيت كـ PWA ومعلومات التطبيق وإعادة الجولة.
   - [`SecuritySection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/SecuritySection.tsx): قسم الأمان والقفل برمز المرور والقياسات الحيوية.

4. **مجلد `src/components/transactions/` (مجلد كامل مفقود من البايبل - 14 ملفاً):**
   - [`DayGroupedTransactionList.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/DayGroupedTransactionList.tsx): قائمة المعاملات المجمعة يومياً.
   - [`debtPaymentSubmit.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/debtPaymentSubmit.ts): معالج تسجيل دفعات السداد عند ربطها بالمعاملة.
   - [`TransactionActionsBar.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionActionsBar.tsx): شريط إجراءات المعاملة وأزرار الحفظ والإلغاء.
   - [`TransactionAmountSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionAmountSection.tsx): حقل المبلغ الرياضي مع لوحة الحساب الفورية.
   - [`TransactionCategoryGrid.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionCategoryGrid.tsx): شبكة اختيار التصنيفات مع الترتيب الذكي.
   - [`TransactionDeleteModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionDeleteModal.tsx): نافذة تأكيد حذف المعاملة مع توضيح الارتباطات.
   - [`TransactionDetailsSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionDetailsSection.tsx): حقول التاريخ والعنوان والملاحظات.
   - [`TransactionFilterSummary.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionFilterSummary.tsx): شريط ملخص الفلاتر النشطة والمبالغ المفلترة.
   - [`TransactionFilterToolbar.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionFilterToolbar.tsx): شريط أدوات الفلترة والبحث المتقدم ونطاقات المبالغ.
   - [`TransactionLockBanners.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionLockBanners.tsx): لافتات تنبيه قفل المعاملة المرتبطة بدين أو جمعية.
   - [`TransactionRowItem.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/TransactionRowItem.tsx): سطر عرض المعاملة مع شارات القفل والإجراءات.
   - [`useTransactionDeleteHandler.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/useTransactionDeleteHandler.ts): خطاف تنسيق عمليات حذف المعاملات.
   - [`useTransactionFormState.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/useTransactionFormState.ts): خطاف إدارة حالة وتفاعل نموذج المعاملة.
   - [`useTransactionSubmitHandlers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/useTransactionSubmitHandlers.ts): معالجات حفظ وإرسال المعاملة مع القيود.
   - [`validateTransactionInput.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/transactions/validateTransactionInput.ts): منطق التحقق الصارم من مدخلات المعاملة والسقف المالي.

5. **ملفات مفقودة في المجلدات القائمة:**
   - في `src/components/dashboard/`: [`DashboardHeroSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/dashboard/DashboardHeroSection.tsx)، [`DashboardRecentTransactions.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/dashboard/DashboardRecentTransactions.tsx)، [`DashboardUpcomingSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/dashboard/DashboardUpcomingSection.tsx)، [`RecentTransactionRow.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/dashboard/RecentTransactionRow.tsx). (البايبل ذكر فقط `QuickFeatureHub.tsx`).
   - في `src/components/debts/`: [`DebtDeleteModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtDeleteModal.tsx)، [`DebtFormFields.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtFormFields.tsx)، [`DebtsFilterBar.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtsFilterBar.tsx)، [`DebtsMergeBanner.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtsMergeBanner.tsx)، [`DebtsMergeModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtsMergeModal.tsx)، [`DebtsSummaryCards.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/DebtsSummaryCards.tsx). بالإضافة إلى المجلد الفرعي `history/`: [`DebtHistoryActionBar.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/history/DebtHistoryActionBar.tsx)، [`DebtHistoryEntriesSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/history/DebtHistoryEntriesSection.tsx)، [`DebtHistoryPaymentsSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/history/DebtHistoryPaymentsSection.tsx)، [`DebtPrintReport.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/debts/history/DebtPrintReport.tsx).
   - في `src/components/layout/`: [`navConfig.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/navConfig.ts)، [`OverscrollBounceContainer.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/OverscrollBounceContainer.tsx).
   - في `src/components/onboarding/`: مجلد `steps/` متضمناً 4 ملفات: [`CategoriesSelectionStep.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/onboarding/steps/CategoriesSelectionStep.tsx)، [`FinancialCycleStep.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/onboarding/steps/FinancialCycleStep.tsx)، [`OpeningBalanceStep.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/onboarding/steps/OpeningBalanceStep.tsx)، [`WelcomeCurrencyStep.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/onboarding/steps/WelcomeCurrencyStep.tsx).
   - في `src/components/reports/`: [`AnnualSummaryTable.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/AnnualSummaryTable.tsx)، [`CategoryBreakdownSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/CategoryBreakdownSection.tsx)، [`CategoryTransactionsModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/CategoryTransactionsModal.tsx)، [`DailyExpenseSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/DailyExpenseSection.tsx)، [`ReportKpiCards.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/ReportKpiCards.tsx). ومجلد `safeSpend/` متضمناً 3 بطاقات متخصصة: [`CurrentMonthSpendCard.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/safeSpend/CurrentMonthSpendCard.tsx)، [`FutureMonthSpendCard.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/safeSpend/FutureMonthSpendCard.tsx)، [`PastMonthSpendCard.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/reports/safeSpend/PastMonthSpendCard.tsx).
   - في `src/components/security/`: [`pinCrypto.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/pinCrypto.ts)، [`PinForgotModal.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/PinForgotModal.tsx)، [`PinKeypad.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/security/PinKeypad.tsx).
   - في `src/components/tools/`: مجلد `circles/` (14 ملفاً لتفكيك إدارة الجمعيات) ومجلد `workHours/` (4 ملفات لتفكيك حاسبة ساعات العمل).
   - في `src/components/ui/`: [`BaseerLogo.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/BaseerLogo.tsx)، [`modalScrollLock.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/modalScrollLock.ts)، [`YearSelector.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/ui/YearSelector.tsx).

#### ب) خطافات React المفقودة من الشجرة (`src/hooks/` - 8 خطافات كاملة)
1. [`useDashboardData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useDashboardData.ts): خطاف تجميع بيانات لوحة التحكم (المؤشرات، آخر المعاملات، الالتزامات القادمة، التوقع المالي) مع مستمعات التركيز للواجهة.
2. [`useDebtEntriesHistory.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useDebtEntriesHistory.ts): خطاف إدارة وتصفية وترقيم سجل السلف الإضافية للدين.
3. [`useDebtPaymentsHistory.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useDebtPaymentsHistory.ts): خطاف إدارة وتصفية وترقيم سجل دفعات السداد للدين.
4. [`usePeriodRollover.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePeriodRollover.ts): خطاف حساب الرصيد التراكمي السابق والرصيد الافتتاحي لأي نطاق زمني مالي.
5. [`useReportsData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useReportsData.ts): خطاف تجميع بيانات التقارير السنوية والشهرية وتوزيعات التصنيفات.
6. [`useTransactionDeletion.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useTransactionDeletion.ts): خطاف إدارة حذف المعاملات المالية ومعالجة الآثار المتسلسلة على الديون والجمعيات.
7. [`useTransactionsData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useTransactionsData.ts): خطاف إدارة الفلترة المعقدة والبحث والنطاقات المالية لشاشة المعاملات.
8. [`useWindowFocusAndPrint.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useWindowFocusAndPrint.ts): خطاف رصد تركيز النافذة وتنسيق تبديل السمات أثناء طباعة التقارير.

#### ج) محركات ومكتبات المنطق الرياضي المفقودة (`src/lib/` - 7 ملفات + حزمة فرعية)
1. [`dashboard.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/dashboard.ts): دوال الدومين النظيفة للوحة التحكم (`getUpcomingItems`, `getRecentTransactions`, `computeTopExpenses`).
2. [`debtStatement.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debtStatement.ts): محرك توليد كشوف الحسابات الرسمية للديون مع جدول العمليات الزمني والرصيد التراكمي.
3. [`mathExpression.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/mathExpression.ts): محرك التحليل والتقييم الرياضي للحقول الرقمية المباشرة ودعم الأرقام المشرقية والعمليات الحسابية.
4. [`motionTokens.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/motionTokens.ts): توكنز وثوابت الحركة السويسرية والانتقالات الفيزيائية عبر Framer Motion.
5. [`reconciliation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts): خوارزمية تسوية الرصيد التراكمي وحساب فروق الجرد والرصيد الافتتاحي المطلوب.
6. [`reportYears.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reportYears.ts): استخراج وإدارة السنوات المالية المتوفرة في سجلات المستخدم.
7. [`transactionLocks.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/transactionLocks.ts): محرك التحقق من ارتباطات المعاملات بالديون والجمعيات وتحديد حالة القفل وسببه.
8. **حزمة النسخ الاحتياطي `src/lib/backupRestore/`:** متضمنة 6 ملفات فرعية تخصصية:
   - [`exportBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/exportBackup.ts)
   - [`index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/index.ts)
   - [`restoreBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreBackup.ts)
   - [`restoreRecords.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreRecords.ts)
   - [`restoreSettingsAndCategories.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreSettingsAndCategories.ts)
   - [`typesAndValidation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/typesAndValidation.ts)

#### د) خدمات Firestore المجزأة (`src/services/` - حزمتان فرعيتان)
1. **حزمة خدمات الديون `src/services/debts/` (4 ملفات):**
   - [`crud.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/crud.ts): عمليات إنشاء وتعديل وحذف الديون والسلف.
   - [`payments.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/payments.ts): تسجيل وحذف وضغط دفعات السداد.
   - [`syncAndMigration.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/syncAndMigration.ts): عمليات دمج ديون الشخص الواحد وضغط السلف والدفعات.
   - [`typesAndHelpers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/typesAndHelpers.ts): أدوات ومحولات الديون ومساعدات التحقق.
2. **حزمة خدمات الجمعيات `src/services/moneyCircles/` (3 ملفات):**
   - [`crud.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/crud.ts): إنشاء وتحديث وحذف الجمعيات مع تقسيم الدفعات الحجمية.
   - [`helpers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/helpers.ts): محول البيانات `circleConverter` ودوال حساب دور الشهر الحالي.
   - [`paymentsAndPayouts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/paymentsAndPayouts.ts): تسجيل دفعات الأعضاء ومزامنة معاملات استلام الأدوار.

---

## ثالثاً: تناقضات حرجة داخل الكود نفسه (Critical Code Discrepancies)

### 3.1 خلل زر "إعادة الجولة التعريفية" في صفحة الإعدادات (`Restart Tour Failure`)
* **الملفات المعنية:**
  - [`src/pages/SettingsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/SettingsPage.tsx#L105-L113)
  - [`src/components/layout/AppShell.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/layout/AppShell.tsx#L131-L144)
  - [`src/components/onboarding/SpotlightTour.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/onboarding/SpotlightTour.tsx#L90-L94)
* **وصف التناقض الجذري في الكود:**
  1. عند نقر المستخدم على زر "إعادة الجولة التعريفية" في صفحة الإعدادات، تستدعي الصفحة الدالة:
     ```typescript
     // SettingsPage.tsx: السطور 105-110
     const handleRestartTour = () => {
       try {
         localStorage.removeItem('baseer_tour_completed')
         localStorage.removeItem('has_seen_dashboard_tour')
         // ...
       }
     }
     ```
  2. بينما المفتاح الفعلي الذي يفحصه `AppShell.tsx` ويكتبه `SpotlightTour.tsx` هو:
     ```typescript
     // AppShell.tsx: السطور 131-133
     window.localStorage.getItem(`baseer_tour_shown_${uid}`) === 'true' ||
     window.localStorage.getItem(`masareefi_tour_shown_${uid}`) === 'true'
     ```
  3. بالإضافة إلى ذلك، وضع مهندس الواجهة مستمعاً لحدث مخصص في `AppShell.tsx`:
     ```typescript
     // AppShell.tsx: السطر 142
     window.addEventListener('baseer-start-tour', handleStartTour)
     ```
     لكن `SettingsPage.tsx` **لا يطلق هذا الحدث إطلاقاً** (`window.dispatchEvent(new CustomEvent('baseer-start-tour'))`)، ولا يمسح المفتاح الفعلي `baseer_tour_shown_${uid}`!
  4. **الأثر الواقعي:** زر "إعادة الجولة التعريفية" في الإعدادات معطل وظيفياً ولا يعيد تشغيل الجولة لمستخدم سبق له إتمامها.

### 3.2 اسم مشروع المحاكي القديم في أوامر `package.json` (`Legacy Emulator Project ID`)
* **الملف المعني:** [`package.json`](file:///c:/Users/mohan/Desktop/expenses1/package.json#L13-L14)
* **وصف التناقض:**
  أوامر تشغيل المحاكي واختبار قواعد الأمان ما زالت مشيرة لمشروع يحمل الاسم القديم `demo-masareefi`:
  ```json
  "test:rules": "firebase emulators:exec --only firestore --project demo-masareefi \"vitest run tests/firestore.rules.test.ts\"",
  "emulators": "firebase emulators:start --project demo-masareefi"
  ```
  بينما اسم المشروع الكامل وكافة المراجع الأخرى حُولت إلى `baseer`.

### 3.3 استبعاد مكتبة `motion` من تجزئة الحزم (`Vendor Chunking`) في `vite.config.ts`
* **الملفات المعنية:**
  - [`package.json`](file:///c:/Users/mohan/Desktop/expenses1/package.json#L22)
  - [`vite.config.ts`](file:///c:/Users/mohan/Desktop/expenses1/vite.config.ts#L133-L160)
* **وصف التناقض:**
  بينما قُسمت مكتبات `react-vendor` و `recharts-vendor` و `firebase-vendor` و `ui-vendor` بعناية فائقة، فإن مكتبة `motion` (Framer Motion v14) - وهي مكتبة ثقيلة نسبياً - لم تُدرج ضمن أي حزمة Vendor مخصصة، مما يؤدي لتوزيع أجزائها عشوائياً أو تضمينها في حزم الصفحات الكسولة دون كاش مستقل ومستقر طويل الأمد.

---

## رابعاً: قائمة الملفات المقترح فحصها في الجولة الثانية (المحرك المالي والشاشات)

تغطي الجولة الثانية التدقيق التفصيلي للقسمين (3) و (4) من البايبل، والمقارنة الرياضية والمحاسبية مع ملفات الكود الفعلية التالية:

### 1. دوال ومحركات الحسابات المالية (`src/lib/`):
- [`src/lib/money.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/money.ts): قواعد التحويل، العملات الـ 9، معالجة الفلس الوهمي (Phantom Fils)، والسقف المالي.
- [`src/lib/mathExpression.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/mathExpression.ts): محلل ومقيّم التعبيرات الرياضية والأرقام المشرقية.
- [`src/lib/dates.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/dates.ts): حساب دورات الأشهر المالية ويوم بداية الشهر (`monthStartDay`).
- [`src/lib/aggregate.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/aggregate.ts): تجميع المعاملات وحساب الفروقات ونسب التغير الشهرية.
- [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts): محرك التوقع المالي لنهاية الشهر وحد الصرف اليومي الآمن والأوزان المتكيفة.
- [`src/lib/recurring.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/recurring.ts): منطق الترددات السبعة وتخطي أشهر الاستلام ودورات الجمعيات.
- [`src/lib/debts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debts.ts) و [`src/lib/debtStatement.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debtStatement.ts): تدقيق حسابات الديون ومطابقة الأرصدة وكشوف الحسابات.
- [`src/lib/reconciliation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts): خوارزمية تسوية الرصيد التراكمي وتحديث الرصيد الافتتاحي.
- [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts) و [`src/lib/reportYears.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reportYears.ts): تجميع تقارير الإنفاق السنوي والشهر المقارن.
- [`src/lib/workHours.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/workHours.ts): حساب تكلفة المشتريات بساعات وأيام العمل.
- [`src/lib/notifications.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/notifications.ts): شروط استحقاق التنبيهات والأوزان والتبويب السداسي.
- [`src/lib/firestoreOffline.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/firestoreOffline.ts): استراتيجيات القراءة والكتابة الآمنة دون اتصال.

### 2. سياق البيانات وخطافات التزامن (`src/context/` & `src/hooks/`):
- [`src/context/AppDataContext.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/context/AppDataContext.tsx): إدارة الاشتراكات الموحدة وحساب الرصيد التراكمي السابق (`rolloverBalanceFils`).
- [`src/hooks/usePeriodRollover.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePeriodRollover.ts): مطابقة معادلات الترحيل بين لوحة التحكم والتقارير.
- [`src/hooks/useDashboardData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useDashboardData.ts): التحقق من المؤشرات المعروضة في لوحة التحكم وتحديث اليوم.
- [`src/hooks/useReportsData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useReportsData.ts): تدقيق حسابات الجداول والمقارنات الشهرية في التقارير.
- [`src/hooks/useRecurringProcessor.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useRecurringProcessor.ts): آلية المعالجة التلقائية للمعاملات المتكررة المستحقة عند فتح التطبيق.

### 3. الشاشات الرئيسية (`src/pages/`):
- [`src/pages/DashboardPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DashboardPage.tsx): مطابقة شاشة النبض المالي مع المواصفات السويسرية.
- [`src/pages/TransactionsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/TransactionsPage.tsx): فحص الفلاتر والبحث والحذف المباشر المتسلسل.
- [`src/pages/ReportsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/ReportsPage.tsx): تدقيق بطاقة الصرف اليومي الآمن ومخططات الإنفاق.
- [`src/pages/DebtsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/DebtsPage.tsx): تدقيق إدارة الديون والسداد الفردي والدمج والتصفية.
- [`src/pages/RecurringPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/RecurringPage.tsx): تدقيق جدولة الالتزامات الدورية والربط بالجمعيات.
- [`src/pages/CategoriesPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/CategoriesPage.tsx): تدقيق الترتيب الذكي واليدوي وإعادة التعيين والأرشفة.
- [`src/pages/SettingsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/SettingsPage.tsx): تدقيق الأمان والنسخ الاحتياطي وتصفير البيانات وتسوية الرصيد.
- [`src/pages/ToolsPage.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/pages/ToolsPage.tsx): تدقيق إدارة الجمعيات وحاسبة ساعات العمل.
