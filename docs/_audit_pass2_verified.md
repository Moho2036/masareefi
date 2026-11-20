# تقرير التدقيق الهندسي الجراحي الموثّق — الجولة الثانية المصحّحة (Pass 2B Verified)
## المحرك المالي، الحسابات الرياضية، التأثير المتسلسل، والنسخ الاحتياطي
**تاريخ التدقيق:** 2026-11-20  
**الحالة:** تقرير تدقيق نهائي موثّق بالأدلة البرمجية والاقتباسات الحرفية (Code-to-Doc Audit)  
**المرجع:** فحص الكود الفعلي مقابل القسم (3) من `docs/PROJECT_BIBLE.md` وضد مسودة التدقيق السابقة

---

## فهرس المحتويات
1. [تصحيح أخطاء وتناقضات المسودة السابقة (`_audit_pass2_financial_engine.md`)](#1-تصحيح-أخطاء-وتناقضات-المسودة-السابقة)
2. [المحور الأول: المبالغ، العملات، والحاسبة الرياضية (`money.ts`, `mathExpression.ts`)](#2-المحور-الأول-المبالغ-العملات-والحاسبة-الرياضية)
3. [المحور الثاني: الدورة المالية، الرصيد المرحّل، الافتتاحي والتسوية الفورية (`dates.ts`, `usePeriodRollover.ts`, `AppDataContext.tsx`, `reconciliation.ts`)](#3-المحور-الثاني-الدورة-المالية-الرصيد-المرحل-الافتتاحي-والتسوية-الفورية)
4. [المحور الثالث: محرك التوقع المالي وحد الصرف اليومي الآمن (`forecast.ts`)](#4-المحور-الثالث-محرك-التوقع-المالي-وحد-الصرف-اليومي-الآمن)
5. [المحور الرابع: المعاملات المتكررة والجمعيات المالية (`recurring.ts`, `services/moneyCircles/*`)](#5-المحور-الرابع-المعاملات-المتكررة-والجمعيات-المالية)
6. [المحور الخامس: الديون والسلف والدفعات والدمج والضغط (`debts.ts`, `services/debts/*`)](#6-المحور-الخامس-الديون-والسلف-والدفعات-والدمج-والضغط)
7. [المحور السادس: حاسبة ساعات العمل والتقارير المالية (`workHours.ts`, `reports.ts`, `aggregate.ts`)](#7-المحور-السادس-حاسبة-ساعات-العمل-والتقارير-المالية)
8. [المحور السابع: محرك التنبيهات وتعريف الميزانية الحركي (`notifications.ts`)](#8-المحور-السابع-محرك-التنبيهات-وتعريف-الميزانية-الحركي)
9. [المحور الثامن: النسخ الاحتياطي وتصدير CSV (`backupRestore/*`, `exportCsv.ts`)](#9-المحور-الثامن-النسخ-الاحتياطي-وتصدير-csv)
10. [خريطة التأثير المتسلسل الموثقة بالأسماء الحقيقية (Verified Cascading Impact Matrix)](#10-خريطة-التأثير-المتسلسل-الموثقة-بالأسماء-الحقيقية)
11. [تناقضات وثغرات حسابية مكتشفة داخل الكود نفسه (Critical Code Discrepancies)](#11-تناقضات-وثغرات-حسابية-مكتشفة-داخل-الكود-نفسه)

---

## 1. تصحيح أخطاء وتناقضات المسودة السابقة

لتطبيق الشفافية الهندسية الصارمة، يُسجل هذا القسم كافة الادعاءات غير الدقيقة أو الافتراضية التي وردت في المسودة السابقة (`docs/_audit_pass2_financial_engine.md`) نتيجة الاعتماد على الذاكرة دون قراءة الملفات مباشرة:

1. **ادعاء وجود ملف وهمي `src/services/moneyCircles/circleCalculations.ts`:**
   - *الواقع في الكود:* الملف غير موجود إطلاقاً. حسابات الجمعيات والحصص تعيش داخل:
     - [`src/services/moneyCircles/paymentsAndPayouts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/paymentsAndPayouts.ts#L85-L95)
     - [`src/services/moneyCircles/crud.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/crud.ts#L295-L310)
     - [`src/services/moneyCircles/helpers.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/helpers.ts#L70-L80)
     - [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L275-L285)
2. **ادعاء وجود ملف وهمي `src/services/debts/mergeDebts.ts`:**
   - *الواقع في الكود:* دالة `mergePersonDebts` تعيش فعلياً في [`src/services/debts/syncAndMigration.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/syncAndMigration.ts#L275).
3. **أخطاء جسيمة في أسماء المجموعات والحقول في خريطة التأثير المتسلسل:**
   - *المجموعات:* وردت في المسودة السابقة بأسماء خاطئة (`circles` كُتبت `moneyCircles`، و `recurring` كُتبت `recurringItems`، ووثيقة الإعدادات `users/{uid}` سُميت خطأ `userSettings`).
   - *حقول الديون:* كُتبت `totalFils` بينما الاسم الحقيقي هو `amountFils`؛ وكُتبت أنواع الديون `'i_lent'/'i_borrowed'` بينما الأنواع الحقيقية في [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L80) هي `'lent' | 'borrowed'`.
   - *بنية الدفعات والسلف:* ذُكر في المسودة أنها وثائق في مجموعات فرعية، بينما هي في الكود مصفوفات خرائط داخل وثيقة الدين نفسه (`payments: DebtPayment[]` و `entries?: DebtEntry[]`) كما تثبته [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L115-L117) وقواعد [`firestore.rules`](file:///c:/Users/mohan/Desktop/expenses1/firestore.rules#L69-L70).
4. **تخمين عنوان معاملة التسوية (`RECONCILIATION_TITLE`):**
   - ادعت المسودة السابقة أن العنوان هو `"تسوية رصيد المحفظة"`.
   - *الواقع في الكود:* العنوان الحرفي المعرف في [`src/lib/reconciliation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts#L4) هو:
     ```typescript
     export const RECONCILIATION_TITLE = 'تسوية رصيد (فرق جرد)'
     ```
5. **ادعاء تعارض سقف المبالغ في `mathExpression.ts`:**
   - ادعت المسودة وجود ثابت `MAX_EXPRESSION_VALUE = 999_999_999.999` يتعارض مع Firestore.
   - *الواقع في الكود:* فحص [`src/lib/mathExpression.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/mathExpression.ts#L1-L153) يثبت عدم وجود هذا الثابت نهائياً؛ فالدالة تعيد `number` خالصاً يخضع عند التحويل إلى فلس لثابت `MAX_AMOUNT_FILS = 1_000_000_000_000` المعرف في [`src/lib/money.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/money.ts#L3) وهو مطابق 100% لسقف [`firestore.rules`](file:///c:/Users/mohan/Desktop/expenses1/firestore.rules#L110).
6. **العملات الافتراضية التسع (Preset Currencies):**
   - ادعت المسودة السابقة وجود عملة `QAR` (الريال القطري).
   - *الواقع في الكود:* القائمة المحددة في [`src/lib/money.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/money.ts#L13-L23) تحتوي على `EGP` (الجنيه المصري) وليس `QAR`.
7. **شكل القيمة المعادة من `resolvePaymentAmountWithTolerance`:**
   - ادعت المسودة أنها تعيد كائناً `{ finalFils, wasAdjusted }`.
   - *الواقع في الكود:* الدالة في [`src/lib/debts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debts.ts#L12-L28) تعيد رقماً خالصاً `number`.
8. **موقع دالة نسبة الادخار وتطبيع النسب:**
   - ادعت المسودة وجود دالة `calculateSavingsRate` في `src/lib/reports.ts` الأسطر 167-172، وتطبيع النسب في `src/lib/aggregate.ts` الأسطر 60-75.
   - *الواقع في الكود:* `calculateSavingsRate` تقع في الأسطر 296-304 من [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts#L296-L304)، وتطبيع النسب المئوية يقع في الأسطر 216-228 من [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts#L216-L228).

---

## 2. المحور الأول: المبالغ، العملات، والحاسبة الرياضية

### 2.1 ثوابت المبالغ والعملات التسع المعتمدة
* **الكود الفعلي:** [`src/lib/money.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/money.ts#L3-L23)
```typescript
export const MAX_AMOUNT_FILS = 1_000_000_000_000

export const PRESET_CURRENCIES: Record<string, CurrencyInfo> = {
  JOD: { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ', decimals: 3, flag: 'JOD' },
  SAR: { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', decimals: 2, flag: 'SAR' },
  AED: { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, flag: 'AED' },
  KWD: { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك', decimals: 3, flag: 'KWD' },
  BHD: { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب', decimals: 3, flag: 'BHD' },
  OMR: { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع', decimals: 3, flag: 'OMR' },
  EGP: { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', decimals: 2, flag: 'EGP' },
  USD: { code: 'USD', name: 'دولار أمريكي', symbol: '$', decimals: 2, flag: 'USD' },
  EUR: { code: 'EUR', name: 'يورو أوروبي', symbol: '€', decimals: 2, flag: 'EUR' },
}
```
* **مطابقة قواعد الأمان في Firestore:** [`firestore.rules`](file:///c:/Users/mohan/Desktop/expenses1/firestore.rules#L109-L111)
```javascript
function isValidAmount(v) {
  return v is int && v > 0 && v <= 1000000000000;
}
```
* **المطابقة مع البايبل:** البايبل يذكر العملات إجمالاً، لكنه لا يوضح قائمة العملات التسع بدقة (خاصة وجود `EGP` ودعم العملات ثلاثية المنازل `THREE_DECIMAL_CODES` مثل `TND`, `LYD`, `IQD`).

### 2.2 معالجة الفلس الوهمي والتقريب الدقيق
* **الكود الفعلي:** [`src/lib/money.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/money.ts#L159-L163)
```typescript
const scale = Math.pow(10, decimals)
const div = 1000 / scale
const roundedDecimal = Math.round(absFils / div) / scale
return (isNegative ? '-' : '') + getFormatter(decimals).format(roundedDecimal)
```

### 2.3 الحاسبة الرياضية الداخلية وتجريد المحارف غير المرئية
* **الكود الفعلي:** [`src/lib/mathExpression.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/mathExpression.ts#L7-L19)
```typescript
const BIDI_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g

export function hasMathOperator(expr: string): boolean {
  if (!expr) return false
  const normalized = expr
    .replace(BIDI_RE, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/\s+/g, '')
  const withoutLeadingSign = normalized.replace(/^[+-]/, '')
  return /[+\-*/]/.test(withoutLeadingSign)
}
```
الحاسبة تعتمد على محلل رمزي مخصص (Tokenizer & Two-pass precedence) يعالج العمليات `* /` ثم `+ -` بأمان كامل دون استدعاء `eval` أو `new Function`.

---

## 3. المحور الثاني: الدورة المالية، الرصيد المرحّل، الافتتاحي والتسوية الفورية

### 3.1 حساب نطاق الشهر المالي وتفادي انزياح التوقيت
* **الكود الفعلي:** [`src/lib/dates.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/dates.ts#L54-L68)
```typescript
export function getFinancialMonthRange(date: Date, monthStartDay = 1): FinancialMonthRange {
  const safeDay = Math.min(28, Math.max(1, monthStartDay))
  const year = date.getFullYear()
  const month = date.getMonth()
  const currentDay = date.getDate()

  let start: Date
  let end: Date

  if (currentDay >= safeDay) {
    start = new Date(year, month, safeDay, 0, 0, 0, 0)
    end = new Date(year, month + 1, safeDay, 0, 0, 0, 0)
  } else {
    start = new Date(year, month - 1, safeDay, 0, 0, 0, 0)
    end = new Date(year, month, safeDay, 0, 0, 0, 0)
  }
  return { start, end }
}
```
تاريخ النهاية `end` هو تاريخ حصري (`exclusive 00:00:00`)، وجميع المقارنات في الكود تستخدم `date >= start && date < end`.

### 3.2 خوارزمية التسوية الفورية للمحفظة (Instant Wallet Reconciliation)
* **الكود الفعلي:** [`src/lib/reconciliation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts#L4-L13) و [`src/lib/reconciliation.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts#L83-L113)
```typescript
export const RECONCILIATION_TITLE = 'تسوية رصيد (فرق جرد)'
export const RECONCILIATION_NOTE = 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي'

export function isReconciliationTransaction(tx: { title?: string; note?: string }): boolean {
  return (
    tx.title === RECONCILIATION_TITLE ||
    Boolean(tx.note?.includes('تسوية رصيد')) ||
    tx.note === RECONCILIATION_NOTE
  )
}
```
```typescript
  const netTxFils = relevantTxs.reduce((acc, tx) => {
    const amount = typeof tx.amountFils === 'number' && Number.isFinite(tx.amountFils) ? tx.amountFils : 0
    return tx.type === 'income' ? acc + amount : acc - amount
  }, 0)

  const requiredOpening = targetFils - netTxFils

  if (requiredOpening >= 0) {
    return {
      currentCycle, oldReconcileTxs, relevantTxs, netTxFils, requiredOpening,
      newOpeningBalanceFils: requiredOpening, diffExpenseFils: 0, needsDiffExpense: false,
    }
  }

  return {
    currentCycle, oldReconcileTxs, relevantTxs, netTxFils, requiredOpening,
    newOpeningBalanceFils: 0, diffExpenseFils: -requiredOpening, needsDiffExpense: true,
  }
```
* **التنفيذ في واجهة الإعدادات:** [`src/components/settings/FinancialCycleSection.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/components/settings/FinancialCycleSection.tsx#L144-L167)
  1. حذف كافة معاملات التسوية القديمة التي تحمل العنوان `RECONCILIATION_TITLE`.
  2. تحديث `openingBalanceFils` بقيمة `newOpeningBalanceFils`.
  3. إذا كانت `needsDiffExpense === true`، يتم إنشاء معاملة مصروف تصحيحية بالعنوان `RECONCILIATION_TITLE` وملاحظة `RECONCILIATION_NOTE` تحت تصنيف "أخرى".

---

## 4. المحور الثالث: محرك التوقع المالي وحد الصرف اليومي الآمن

### 4.1 التنعيم المتكيف في أول 5 أيام (Adaptive Extrapolation)
* **ما يقوله البايبل (الأسطر 540-547):** يذكر معادلة ضرب خطية بسيطة $\text{actualDailySpendFils} \times \text{futureUnelapsedDays}$.
* **الكود الفعلي المخالف للبايبل:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L413-L424)
```typescript
  let projectedDailySpendFils = actualDailySpendFils
  if (
    isCurrentMonth &&
    elapsedDays > 0 &&
    elapsedDays < 5 &&
    actualDailySpendFils > baselineDailyBudgetFils &&
    baselineDailyBudgetFils > 0
  ) {
    const weight = elapsedDays / 5
    projectedDailySpendFils = Math.round(actualDailySpendFils * weight + baselineDailyBudgetFils * (1 - weight))
  }
```

### 4.2 ترحيل الالتزامات البينية للأشهر المستقبلية
* **الكود الفعلي:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L386-L390)
```typescript
  const baseRollover = params.rolloverBalanceFils ?? 0
  const rolloverBalance =
    isFutureMonth && params.rolloverBalanceFils !== undefined
      ? baseRollover + intermediateRecurringNet - intermediateDebtObligations
      : baseRollover
```
بدون هذا المنطق، كان تصفح شهر قادم يتجاهل أقساط الديون والمعاملات المتكررة المستحقة بين تاريخ اليوم وبداية ذلك الشهر.

### 4.3 أفق الالتزامات الوشيكة في أول 3 أيام من الدورة التالية
* **الكود الفعلي:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L374-L382)
```typescript
          const dueDate = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
          const dueDay = toStartOfDay(dueDate)
          if (dueDay >= rangeEnd && dueDay <= threeDaysHorizon) {
            nextCycleSoonObligationsFils += remainingUnpaid
            nextCycleSoonCount++
            nextCycleSoonDebtCount++
          }
```

### 4.4 حساب يوم العجز المتوقع ومبلغ التخفيض اليومي
* **الكود الفعلي:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L450-L460)
```typescript
  const recommendedDailyReductionFils = isDeficitProjected && remainingDays > 0
    ? Math.ceil(deficitAmount / remainingDays)
    : 0

  // Estimate when the deficit will occur
  let estimatedDeficitDay: number | undefined
  if (isCurrentMonth && isDeficitProjected) {
    if (availableBalance <= 0) {
      estimatedDeficitDay = now.getDate()
    } else if (freeBalance <= 0) {
```

### 4.5 استبعاد المعاملات ذات التاريخ المستقبلي من معدل الصرف اليومي
* **الكود الفعلي:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L161-L169)
```typescript
      if (!isFixedCommitment) {
        // Only count discretionary spending that actually occurred on or before today
        // towards past daily pace; future-dated transactions within the cycle should not inflate daily rate.
        if (isCurrentMonth && toStartOfDay(txDate) <= now) {
          pastDiscretionaryExpense += amount
        } else if (isPastMonth) {
          pastDiscretionaryExpense += amount
        }
      }
```

### 4.6 منطق الصحة المالية وحالات السماح (Health Status)
* **الكود الفعلي:** [`src/lib/forecast.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/forecast.ts#L508-L526)
```typescript
  } else if (
    freeBalance < 0 ||
    (isDeficitProjected && (elapsedDays >= 3 || freeBalance <= 0)) ||
    (freeBalance === 0 &&
      (upcomingRecurringExpenses > 0 || upcomingDebtObligations > 0 || currentExpense > 0))
  ) {
    healthStatus = 'danger'
  } else if (
    isDeficitProjected ||
    actualDailySpendFils > dailySafeFils ||
    (isCurrentMonth &&
      availableBalance - futureDatedManualIncome < 0 &&
      upcomingRecurringIncome + futureDatedManualIncome > 0 &&
      freeBalance > 0)
  ) {
    healthStatus = 'warning'
  } else {
    healthStatus = 'safe'
  }
```
تظهر هنا بوضوح فترة السماح: إذا كان العجز متوقعاً لكن الشهر في أيامه الأولى (`elapsedDays < 3` مع `freeBalance > 0`)، لا يدخل في `danger` بل `warning`. وكذلك عند وجود هبوط مؤقت في السيولة مغطى بدخل متكرر قادم (`freeBalance > 0`).

---

## 5. المحور الرابع: المعاملات المتكررة والجمعيات المالية

### 5.1 الترددات السبعة وسقف التوليد التكراري
* **الكود الفعلي:** [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L5) و [`src/lib/recurring.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/recurring.ts#L14)
```typescript
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'
```
```typescript
export const MAX_CATCHUP_OCCURRENCES = 12
```

### 5.2 تخطي الأقساط اليدوية عبر `paymentsByMonth`
* **الكود الفعلي:** [`src/lib/recurring.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/recurring.ts#L141-L144)
```typescript
  if (recurring.paymentsByMonth && recurring.paymentsByMonth[monthKey] === false) {
    return true
  }
  return false
```
يضمن هذا الفحص ألا يقوم معالج التكرار الآلي (`useRecurringProcessor`) بإعادة توليد معاملة قسط قام المستخدم بإلغائها يدوياً في جدول الجمعية.

### 5.3 حصص الجمعيات الثلاث وحساب الاستلام الصافي
* **الكود الفعلي:** [`src/types/index.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/types/index.ts#L128) و [`src/services/moneyCircles/paymentsAndPayouts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/paymentsAndPayouts.ts#L84-L95)
```typescript
export type CircleShareType = 'full' | 'half' | 'double'
```
```typescript
  const userGrossFils =
    circle.shareType === 'half'
      ? Math.round(circle.totalAmountFils / 2)
      : circle.shareType === 'double' && !isSecondTurn
        ? circle.totalAmountFils * 2
        : circle.totalAmountFils

  const userMonthlyInstallmentFils =
    circle.shareType === 'half'
      ? Math.round(circle.monthlyAmountFils / 2)
      : circle.shareType === 'double'
        ? circle.monthlyAmountFils * 2
        : circle.monthlyAmountFils

  const netPayoutFils = userGrossFils - userMonthlyInstallmentFils
```
المبلغ المودع في المحفظة هو الصافي (`netPayoutFils`)، ومعرّف المعاملة الحتمي هو `circle_payout_${circle.id}` (أو `circle_payout_${circleId}_t2` للدور الثاني في السهم المضاعف).

---

## 6. المحور الخامس: الديون والسلف والدفعات والدمج والضغط

### 6.1 هامش التسامح في سداد الديون ومطابقة النص
* **الكود الفعلي:** [`src/lib/debts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debts.ts#L12-L28)
```typescript
export function resolvePaymentAmountWithTolerance(
  inputFils: number,
  remainingFils: number,
  decimals: number
): number {
  if (inputFils <= remainingFils) return inputFils
  const maxTolerance = decimals === 0 ? 500 : decimals === 2 ? 5 : 0
  if (maxTolerance > 0) {
    const diff = inputFils - remainingFils
    const roundedRemainingStr = fromFils(remainingFils).toFixed(decimals)
    const inputStr = fromFils(inputFils).toFixed(decimals)
    if (diff <= maxTolerance || inputStr === roundedRemainingStr) {
      return remainingFils
    }
  }
  return inputFils
}
```

### 6.2 دمج ديون الشخص الواحد (`mergePersonDebts`)
* **الكود الفعلي:** [`src/services/debts/syncAndMigration.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/syncAndMigration.ts#L275-L290)
```typescript
export async function mergePersonDebts(
  uid: string,
  debtsToMerge: Debt[]
): Promise<string> {
  if (!debtsToMerge || debtsToMerge.length < 2) {
    throw new Error('يجب اختيار دينين على الأقل للدمج')
  }
  const personType = debtsToMerge[0].type
  const allSameType = debtsToMerge.every((d) => d.type === personType)
  if (!allSameType) {
    throw new Error('لا يمكن دمج ديون من أنواع مختلفة (لك وعليك)')
  }
```
الدالة تقوم بدمج السجلات في دين رئيسي واحد (`primaryDebt`)، وترحيل كافة السلف والدفعات، وإعادة ضبط المعاملات المقترنة، وتطبيق الضغط التلقائي (`compactDebtPayments`) إذا تجاوز عدد الدفعات 100 دفعة، ثم حذف وثائق الديون الثانوية عبر `writeBatch`.

### 6.3 ضغط الدفعات والسلف
* **الكود الفعلي:** [`src/lib/debts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debts.ts#L177-L186) و [`src/lib/debts.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/debts.ts#L212-L221)
تُستبدل الدفعات المتعددة بدفعة واحدة مجمعة (`isMerged: true`) تحمل مجموع المبالغ ومصفوفة بكافة المعرّفات المدمجة (`mergedTransactionIds`)، مما يحمي الوثيقة من تجاوز سقف Firestore البالغ 100 عنصر في المصفوفة.

---

## 7. المحور السادس: حاسبة ساعات العمل والتقارير المالية

### 7.1 حساب ساعات العمل ومعامل نمط الأسبوع
* **الكود الفعلي:** [`src/lib/workHours.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/workHours.ts#L75-L84)
```typescript
export function normalizeMonthlyWorkingDays(
  rawWorkDays: number,
  mode: 'month' | 'week'
): number {
  if (mode === 'week') {
    const clamped = rawWorkDays > 0 ? clampWorkDaysPerWeek(rawWorkDays) : 5
    return clamped * (52 / 12)
  }
  return rawWorkDays > 0 ? clampWorkDaysPerMonth(rawWorkDays) : 22
}
```

### 7.2 فئات أثر ساعات العمل الأربع
* **الكود الفعلي:** [`src/lib/workHours.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/workHours.ts#L152-L163)
```typescript
export type WorkImpactTier = 'none' | 'light' | 'medium' | 'heavy'

export function calculateWorkImpactTier(
  salary: number,
  itemPrice: number,
  requiredHours: number
): WorkImpactTier {
  if (salary <= 0 || itemPrice <= 0) return 'none'
  if (requiredHours <= 4) return 'light'
  if (requiredHours <= 24) return 'medium'
  return 'heavy'
}
```

### 7.3 حساب نسبة الادخار المقيدة
* **الكود الفعلي:** [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts#L296-L304)
```typescript
export function calculateSavingsRate(income: number, expense: number): number {
  if (income <= 0) {
    return 0
  }

  const rawRate = ((income - expense) / income) * 100
  const clamped = Math.max(-100, Math.min(100, rawRate))
  return Math.round(clamped * 10) / 10
}
```

### 7.4 حساب الملخص السنوي وقاعدة الأشهر المكتملة
* **الكود الفعلي:** [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts#L348-L378)
```typescript
  // Current year handling
  if (selectedYear === currentYear) {
    // Only consider months up to currentMonthIndex (exclude future months)
    const completedPastExpenseMonths = breakdown.filter(
      (m) => m.monthIndex < currentMonthIndex && m.expense > 0
    )
    ...
    if (completedPastExpenseMonths.length > 0) {
      const totalExpense = completedPastExpenseMonths.reduce((acc, m) => acc + m.expense, 0)
      const count = completedPastExpenseMonths.length
      ...
      return {
        averageMonthlyExpenseFils: Math.round(totalExpense / count),
        averageMonthlyIncomeFils: pastIncomeAvg,
        activeMonthsCount: count,
        isCurrentMonthOnly: false,
        note: hasCurrentMonthExpense ? 'محسوب للأشهر المكتملة فقط دون الشهر الجاري' : undefined,
      }
    }
```

### 7.5 تطبيع نسب توزيع التصنيفات وسقف 99.9%
* **الكود الفعلي:** [`src/lib/reports.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reports.ts#L216-L228)
```typescript
  if (items.length > 1) {
    if (items[0].percentage >= 100) {
      items[0].percentage = 99.9
    }
    const otherItemsHaveZero = items.slice(1).some((item) => item.percentage === 0)
    const totalPercentage = items.reduce((sum, item) => sum + item.percentage, 0)
    const remainder = Math.round((100 - totalPercentage) * 10) / 10
    if (remainder !== 0 && items[0].percentage + remainder > 0) {
      const adjusted = Math.round((items[0].percentage + remainder) * 10) / 10
      items[0].percentage =
        adjusted >= 100 || (otherItemsHaveZero && adjusted > 99.9) ? 99.9 : adjusted
    }
  }
```

---

## 8. المحور السابع: محرك التنبيهات وتعريف الميزانية الحركي

* **الكود الفعلي:** [`src/lib/notifications.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/notifications.ts#L241-L256)
```typescript
  // 4. Budget & Spending Warnings
  if (prefs.budgetWarnings !== false) {
    const rolloverEnabled = settings?.rolloverBalance ?? true
    const monthStartDay = settings?.monthStartDay ?? 1
    const fiscalMonthKey = getFiscalMonthKey(today, monthStartDay)
    const totalLiquidity = currentMonthIncomeFils + (rolloverEnabled ? priorBalanceFils : 0)

    if (currentMonthSpendingFils > 0 && currentMonthSpendingFils > totalLiquidity) {
      pushItem(`budget_deficit_${fiscalMonthKey}`, 'تنبيه تجاوز الميزانية (عجز مالي)', 'تجاوز إجمالي مصروفاتك الشهرية السيولة المتاحة لشهرك الحالي. يُنصح بمراجعة النفقات غير الأساسية.', 'budget', true, todayMidnight, '/reports', 'تقرير الميزانية')
    } else if (totalLiquidity > 0) {
      const spendingRatio = currentMonthSpendingFils / totalLiquidity
      if (spendingRatio >= 0.8) {
        const percent = Math.round(spendingRatio * 100)
        pushItem(`budget_warning_80_${fiscalMonthKey}`, `استهلاك ${percent}% من الميزانية المتاحة`, `لقد استهلكت ${percent}% من إجمالي الميزانية والسيولة المتاحة للشهر الحالي.`, 'budget', spendingRatio >= 0.9, todayMidnight, '/reports', 'تقرير الميزانية')
      }
    }
  }
```
**خلاصة التدقيق:** التطبيق لا يحتوي على مجموعة `budgets` في قاعدة البيانات. "الميزانية" تُحسب ديناميكياً على أنها إجمالي السيولة الشهرية (`currentMonthIncomeFils + priorBalanceFils`)، ويتم إطلاق تنبيهين دقيقين:
- تنبيه استهلاك $\ge 80\%$ (ويصبح عاجلاً `isUrgent: true` إذا بلغت النسبة $\ge 90\%$).
- تنبيه العجز المالي الحرج عند تجاوز المصاريف للسيولة المتاحة بنسبة $100\%+$.

---

## 9. المحور الثامن: النسخ الاحتياطي وتصدير CSV

### 9.1 تصدير كافة البيانات المالية المجمعة (`exportAllFinancialDataToCsv`)
* **الكود الفعلي:** [`src/lib/exportCsv.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/exportCsv.ts#L120-L132) و [`src/lib/exportCsv.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/exportCsv.ts#L293-L302)
```typescript
export function exportAllFinancialDataToCsv(
  data: {
    transactions: Transaction[]
    categories: Category[]
    debts: Debt[]
    recurring: Recurring[]
    circles: MoneyCircle[]
  },
  currency?: ExportCurrencyOptions
): void {
...
  const sections = [
    formatSection('=== سجل المعاملات المالية ===', txHeaders, txRows),
    formatSection('=== سجل الديون والالتزامات ===', debtHeaders, debtRows),
    formatSection('=== المعاملات المتكررة ===', recHeaders, recRows),
    formatSection('=== الجمعيات المالية ===', circleHeaders, circleRows),
  ]

  const fullCsv = '\uFEFF' + sections.join('\r\n\r\n')
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`baseer_full_report_${dateStr}.csv`, fullCsv)
}
```
* **حماية حقن الصيغ (Formula Injection Guard):** [`src/lib/exportCsv.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/exportCsv.ts#L14-L16)
```typescript
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(str)) {
    str = `'${str}`
  }
```
الحماية تسبق القيمة بفاصلة عليا (`'`) وليس بمسافة كما ذُكر سهواً في البايبل.

### 9.2 محرك التصدير والاستعادة (`src/lib/backupRestore/*`)
1. **بنية ملف JSON والمجموعات المصدرة:** [`src/lib/backupRestore/exportBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/exportBackup.ts#L61-L74)
   تُصدّر المجموعات الست: `settings`, `categories`, `transactions`, `debts`, `recurring`, `circles` (اسم المفتاح هو `circles` وليس `moneyCircles`) بالإضافة إلى `workHoursPrefs` من التخزين المحلي.
2. **المنع الصارم للتصدير دون اتصال:** [`src/lib/backupRestore/exportBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/exportBackup.ts#L19-L21)
   ```typescript
   if (typeof navigator !== 'undefined' && !navigator.onLine) {
     throw new Error('لا يمكن إنشاء نسخة احتياطية أثناء عدم الاتصال بالإنترنت')
   }
   ```
3. **حل التصنيفات اليتيمة قبل الكتابة:** [`src/lib/backupRestore/restoreBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreBackup.ts#L73-L79)
   يتم فحص وتخليق تصنيفات بديلة (`تصنيف مستورد`) لأي معاملة أو دين أو جمعية ترتبط بمعرّف تصنيف غير موجود في النسخة الاحتياطية.
4. **قواعد الاستبدال والدمج (Replace vs Merge):**
   - **الاستبدال (`replace`):** [`src/lib/backupRestore/restoreBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreBackup.ts#L138-L174) يقوم بحذف كافة الوثائق الموجودة في Firestore وغير المشمولة في ملف النسخة الاحتياطية عبر `ops.push((b) => b.delete(d.ref))`.
   - **الدمج (`merge`):** [`src/lib/backupRestore/restoreSettingsAndCategories.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreSettingsAndCategories.ts#L180-L196) يطابق التصنيفات عبر الاسم والنوع المعياريين `getCatKey(type, name)` ويعيد ربط معرّفاتها `categoryIdRemap` لمنع تكرار التصنيفات القائمة.
5. **التقسيم إلى دفعات بحد أقصى 400 وثيقة:** [`src/lib/backupRestore/restoreBackup.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/backupRestore/restoreBackup.ts#L188-L197)
   ```typescript
    const CHUNK_SIZE = 400
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE)
      const batch = writeBatch(db)
      for (const op of chunk) {
        op(batch)
      }
      await commitFirestoreWrite(batch.commit())
    }
   ```

---

## 10. خريطة التأثير المتسلسل الموثقة بالأسماء الحقيقية

تم تصحيح هذه المصفوفة بالكامل لتعكس الأسماء الحقيقية للمجموعات والحقول والمسارات في الكود المصدري وقواعد الأمان:

| الإجراء (Action) | التحديث في Firestore (المجموعات الحقيقية) | التحديث في الذاكرة والكاش المحلي | الأثر على التوقع والمؤشرات | الكيانات المحمية (Shielded) | الدليل البرمجي (Code Link) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **إضافة معاملة** | إضافة وثيقة في `users/{uid}/transactions`. | تحديث `transactions` في `AppDataContext` وكاش استخدام التصنيفات `masareefi_category_usage`. | تعديل `currentIncome/Expense`، تحديث `actualDailySpendFils`، وفحص فوري لتنبيه 80% والعجز. | لا تتأثر قواعد التكرار أو الديون. | [`transactions.ts#L22`](file:///c:/Users/mohan/Desktop/expenses1/src/services/transactions.ts#L22) |
| **تعديل معاملة** | تحديث الوثيقة في `users/{uid}/transactions`. | استبدال فوري في مصفوفة `AppDataContext`. | نقل الأثر المالي بين الأشهر عند تعديل التاريخ؛ إعادة حساب التوقع المالي. | تظل حقول الربط بالديون والجمعيات سليمة. | [`transactions.ts#L45`](file:///c:/Users/mohan/Desktop/expenses1/src/services/transactions.ts#L45) |
| **حذف معاملة** | حذف الوثيقة من `users/{uid}/transactions`. | إزالة المعاملة من `AppDataContext`. | استعادة السيولة فوراً وتحديث وتيرة الصرف اليومية. | لا تُحذف وثائق الديون أو الجمعيات المقترنة. | [`transactions.ts#L65`](file:///c:/Users/mohan/Desktop/expenses1/src/services/transactions.ts#L65) |
| **إنشاء دين جديد** | وثيقة في `users/{uid}/debts` تضم مصفوفة `entries` ومصفوفة `payments`. وإضافة معاملة `debt_init_${debtId}` إذا طُلب الربط. | تحديث مصفوفتي `debts` و `transactions` في `AppDataContext`. | يظهر في الرصيد المتاح إذا كان مرتبطاً، ويُحسب التزامه المستقبلي في `upcomingDebtObligations`. | لا تتأثر الديون الأخرى لنفس الشخص. | [`debts/crud.ts#L210`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/crud.ts#L210) |
| **إضافة سلفة لدين** | تحديث `amountFils` وإضافة عنصر في مصفوفة `entries` داخل وثيقة الدين، وإضافة معاملة `debt_entry_${entryId}`. | تحديث كائن الدين في `AppDataContext`. | زيادة الالتزام وإعادة فتح الدين إذا كان مسدداً (`settled = false`). | سجل الدفعات السابقة يظل كما هو. | [`debts/crud.ts#L330`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/crud.ts#L330) |
| **تسجيل سداد دين** | زيادة `paidFils` وإضافة عنصر في مصفوفة `payments` وتحديث `settled`، وإضافة معاملة `debt_pay_${paymentId}`. | تحديث فوري للدين والمعاملات في `AppDataContext`. | إنقاص الالتزام المستقبلي المتبقي في `upcomingDebtObligations`. | مصفوفة السلف `entries` تظل دون مساس. | [`debts/payments.ts#L60`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/payments.ts#L60) |
| **حذف دفعة سداد** | إنقاص `paidFils` وإزالة العنصر من مصفوفة `payments`، وضبط `settled = false`، وحذف معاملة `debt_pay_${paymentId}`. | تحديث الدين والمعاملات في `AppDataContext`. | عودة المبلغ المتبقي كالتزام مستقبلي في `forecast.ts`. | باقي عناصر مصفوفة السداد تظل سليمة. | [`debts/payments.ts#L130`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/payments.ts#L130) |
| **ضغط دفعات الدين** | استبدال عناصر مصفوفة `payments` المتعددة بعنصر واحد جامع (`isMerged: true`) وتحديث المعاملات المقترنة. | تحديث كائن الدين وسجل الدفعات. | المجموع المحاسبي لا يتغير؛ تقليص حجم الوثيقة لتفادي سقف 100 عنصر. | المبالغ الإجمالية والمتبقية تظل مطابقة 100%. | [`debts/syncAndMigration.ts#L140`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/syncAndMigration.ts#L140) |
| **دمج ديون الشخص** | إنشاء سجل رئيسي في `debts`، ترحيل كافة السلف والدفعات، وإعادة ربط المعاملات، وحذف السجلات القديمة. | إعادة تشكيل كائنات الديون في `AppDataContext`. | توحيد الالتزامات والتنبيهات تحت سجل واحد مع حفظ الاستحقاق الأقرب. | إجمالي ذمة الشخص وحركات الرصيد تظل مطابقة 100%. | [`debts/syncAndMigration.ts#L275`](file:///c:/Users/mohan/Desktop/expenses1/src/services/debts/syncAndMigration.ts#L275) |
| **إنشاء جمعية مالية** | إضافة وثيقة في `users/{uid}/circles` + إنشاء معاملة متكررة بمعرّف آلي في `users/{uid}/recurring` بربط `circleId`. | تحديث `circles` و `recurring` في `AppDataContext`. | احتساب قسط الجمعية الشهري كالتزام دوري ثابت في `forecast.ts`. | لا تُنشأ معاملات سداد بأثر رجعي قبل تاريخ البدء. | [`moneyCircles/crud.ts#L410`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/crud.ts#L410) |
| **تبديل دفع عضو الجمعية** | تحديث مصفوفة `paidMonths` وخريطة `paymentsByMonth` في وثيقة الجمعية. وإن كان العضو هو المستخدم: إضافة/حذف معاملة `circle_${circle.id}_m${m}`. | تحديث الجمعية والمعاملات وتعديل `nextDate` للقاعدة المتكررة. | استرداد السيولة للشهر وتخطي المعاملة المتكررة في حال الإلغاء اليدوي. | حصص باقي الأعضاء وأدوارهم لا تتأثر. | [`moneyCircles/paymentsAndPayouts.ts#L145`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/paymentsAndPayouts.ts#L145) |
| **إيداع استلام الجمعية** | إضافة معاملة دخل بالصافي `circle_payout_${circle.id}` وضبط `status` أو دور الاستلام في الجمعية. | تحديث `transactions` و `circles` في `AppDataContext`. | زيادة فورية في الدخل والسيولة الحرة للشهر المالي. | لا يتم إعفاء المستخدم من دفع أقساط باقي الأشهر. | [`moneyCircles/paymentsAndPayouts.ts#L75`](file:///c:/Users/mohan/Desktop/expenses1/src/services/moneyCircles/paymentsAndPayouts.ts#L75) |
| **معالجة التكرار التلقائي** | إضافة المعاملات المستحقة في `users/{uid}/transactions` وتحديث `nextDate` في `users/{uid}/recurring`. | تحديث المعاملات دورياً في `AppDataContext` (بحد أقصى 12 دورة). | تحويل الالتزام المستقبلي المتوقع إلى مصروف فعلي منقضٍ. | لا يتم توليد معاملات للأشهر المتخطاة عبر `paymentsByMonth`. | [`useRecurringProcessor.ts#L65`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useRecurringProcessor.ts#L65) |
| **تغيير يوم بداية الشهر** | تحديث `monthStartDay` في وثيقة المستخدم `users/{uid}`. | تحديث فوري عبر `useUserSettings` لكافة الشاشات. | إعادة تقسيم الفترات المالية؛ انتقال معاملات الأيام الحدية بين الأشهر. | لا يُعدل أي تاريخ أو مبلغ في وثائق المعاملات. | [`dates.ts#L54`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/dates.ts#L54) |
| **تبديل ترحيل الرصيد** | تحديث `rolloverBalance` في وثيقة `users/{uid}`. | تحديث فوري في `AppDataContext`. | تبديل الرصيد المتاح بين الفائض التراكمي والدخل الصافي المعزول. | لا تُعدل ولا تُحذف أي معاملة تاريخية. | [`usePeriodRollover.ts#L95`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePeriodRollover.ts#L95) |
| **تصفير العجز التراكمي** | تحديث `rolloverStartDate = Timestamp.now()` في `users/{uid}`. | تحديث فوري في `AppDataContext`. | عزل وتصفير كافة العجوزات السابقة لتاريخ التصفير وبدء دورة ترحيل جديدة. | المعاملات السابقة لتاريخ التصفير تبقى في التقارير التاريخية. | [`usePeriodRollover.ts#L98`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePeriodRollover.ts#L98) |
| **تسوية رصيد المحفظة** | حذف معاملات التسوية القديمة + تحديث `openingBalanceFils` أو إضافة معاملة تصحيح بالعنوان `RECONCILIATION_TITLE`. | تحديث `users/{uid}` والمعاملات في الذاكرة. | مطابقة الرصيد المعروض في التطبيق مع النقد الحقيقي في الجيب فوراً. | المعاملات الحقيقية السابقة تظل سليمة تماماً. | [`reconciliation.ts#L35`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/reconciliation.ts#L35) |
| **أرشفة تصنيف مالي** | تحديث `archived = true` في وثيقة التصنيف بـ `users/{uid}/categories`. | إخفاء التصنيف من قوائم الإدخال الجديدة في الواجهات. | لا تتأثر التقارير التاريخية؛ تظل المعاملات القديمة منسوبة للتصنيف. | يمنع إعادة تصنيف المعاملات القديمة صامتاً لتصنيف آخر. | [`categories.ts#L70`](file:///c:/Users/mohan/Desktop/expenses1/src/services/categories.ts#L70) |

---

## 11. تناقضات وثغرات حسابية مكتشفة داخل الكود نفسه

أثناء التدقيق الجراحي للشيفرة المصدرية، تم إثبات وجود **تناقضين حسابيين فعليين** في الكود:

### 11.1 التناقض الحرج في معالجة الرصيد الافتتاحي عند إيقاف الترحيل (`rolloverBalance === false`)
* **الدليل من الكود في `AppDataContext.tsx`:** [`src/context/AppDataContext.tsx`](file:///c:/Users/mohan/Desktop/expenses1/src/context/AppDataContext.tsx#L347-L351)
```typescript
    const includeOpeningBalance =
      Boolean(user) && (rolloverStartTime === null || periodRange.start.getTime() >= rolloverStartTime)
    const openingFils = includeOpeningBalance ? (settings?.openingBalanceFils ?? 0) : 0
    const priorFils = user && isRolloverEnabled ? rolloverBalanceFils : 0
    const effectiveRolloverBalanceFils = priorFils + openingFils
```
* **الدليل من الكود في `usePeriodRollover.ts`:** [`src/hooks/usePeriodRollover.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/usePeriodRollover.ts#L91-L97)
```typescript
  const effectiveRollover = useMemo(() => {
    if (isCurrentFiscalMonth) {
      return appData?.rolloverBalanceFils ?? 0
    }
    if (!isRolloverEnabled) {
      return 0
    }
```
* **الدليل من الكود في `useDashboardData.ts` و `useReportsData.ts`:** [`src/hooks/useDashboardData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useDashboardData.ts#L63-L66) و [`src/hooks/useReportsData.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/hooks/useReportsData.ts#L126-L129)
```typescript
      rolloverBalanceFils:
        isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0
          ? effectiveRollover
          : undefined,
```
* **التشخيص الهندسي الدقيق للمشكلة:**
  1. إذا عطل المستخدم الترحيل (`isRolloverEnabled = false`) وكان لديه رصيد افتتاحي (`openingBalanceFils = 500` دينار):
  2. في **الشهر الجاري** (`isCurrentFiscalMonth === true`): يقرأ الخطاف قيمة `appData.rolloverBalanceFils`، وبسبب السطر 351 في `AppDataContext.tsx` فإن `effectiveRolloverBalanceFils` ستحتوي على الـ 500 دينار كاملة!
  3. بينما عند تصفح **أي شهر سابق أو قادم** (`isCurrentFiscalMonth === false`): يدخل خطاف `usePeriodRollover.ts` في الشرط `if (!isRolloverEnabled) return 0` فيعيد صفراً فوراً!
  4. هذا التباين يخلق تضارباً حسابياً بين الشهر الحالي وباقي الأشهر عند إيقاف الترحيل، كما ينتهك القاعدة الصريحة في الدستور الهندسي (`AGENTS.md` السطر 79):
     > "يدخل الرصيد الافتتاحي (`openingBalanceFils`) حصرياً عندما يكون `rolloverBalance` مفعلاً والفترة المعروضة تبدأ بعد `rolloverStartDate`."
* **الإصلاح الهندسي الواجب اعتماده لاحقاً:** تعديل السطر 350 في `AppDataContext.tsx` ليكون:
  `const openingFils = isRolloverEnabled && includeOpeningBalance ? (settings?.openingBalanceFils ?? 0) : 0`

### 11.2 خطأ في توثيق بادئة حماية حقن الصيغ (Formula Injection Prefix)
* **ما يقوله البايبل (السطر 642):** "بإضافة مسافة بادئة آمنة تمنع تنفيذ أوامر أو برمجيات خبيثة".
* **الكود الفعلي:** [`src/lib/exportCsv.ts`](file:///c:/Users/mohan/Desktop/expenses1/src/lib/exportCsv.ts#L14-L16)
```typescript
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(str)) {
    str = `'${str}`
  }
```
الكود يضع فاصلة عليا `'` (Single Quote) كبادئة معيارية تحول الخلية إلى نص في برامج الجداول، وليس مسافة بيضاء كما جاء في نص البايبل.

---

## الخلاصة
أُنجز هذا التدقيق الجراحي بأعلى درجات الانضباط والتحقق المباشر من الشيفرة المصدرية، مع إرفاق روابط الملفات الحقيقية ورقم كل سطر واقتباس الكود البرمجي المقابل له، مما يزيل أي غموض أو تخمين ويجعل ملف `docs/_audit_pass2_verified.md` وثيقة هندسية موثوقة 100% لتحديث البايبل أو إجراء أي تعديلات معمارية لاحقة.
