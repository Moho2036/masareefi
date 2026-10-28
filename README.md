# بَصير (Baseer) — Personal Finance Progressive Web App

> تطبيق ويب تقدمي (PWA) للإدارة المالية الشخصية، بواجهة عربية كاملة وتجربة استخدام تركز على الخصوصية والسرعة ودقة الحسابات المحاسبية.

[![React](https://img.shields.io/badge/React-19.2.8-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3.0-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38B2AC.svg)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-12.19.0-orange.svg)](https://firebase.google.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0.3-green.svg)](https://vitest.dev/)

---

## نظرة عامة (Overview)

**بَصير (Baseer)** هو نظام لإدارة المصاريف والمدخرات والالتزامات المالية، مبني بمعمارية الرصيد المالي الموحد ومحرك التوقع الرياضي، ليعمل بسرعة فائقة مع التخزين المحلي والتشغيل دون اتصال (Offline-First)، مع المزامنة اللحظية في السحابة عبر Firebase Cloud Firestore.

---

## الميزات الأساسية (Core Features)

* **الرصيد الموحد وترحيل الفائض والعجز (`Rollover Balance`):** احتساب دقيق للسيولة النقدية المتاحة متضمناً الرصيد الافتتاحي والفائض أو العجز المرحل من الأشهر السابقة دون تزييف دخل الشهر الحالي.
* **محرك التوقع المالي وحد الصرف اليومي الآمن (`Safe Daily Spend`):** احتساب آلي للميزانية اليومية المتاحة للصرف المرن بعد عزل الفواتير المجدولة، دفعات الديون، وأقساط الجمعيات، مع تنبيهات ذكية لتفادي العجز قبل نهاية الشهر.
* **محرك المعاملات المتكررة بالترددات السبعة (`7-Frequency Recurring Engine`):** دعم كامل للتكرار (يومي، أسبوعي، كل أسبوعين، شهري، ربع سنوي، نصف سنوي، سنوي) مع إمكانية الترحيل التلقائي أو طلب التأكيد اليدوي (`requireConfirmation`).
* **نظام الديون والمطالبات المالية (`Debts & Obligations`):** إدارة شاملة للديون (لك أو عليك) مع سجل دفعات مفصل، إمكانية ضغط الدفعات (`compactDebtPayments`)، ودمج ديون الشخص الواحد (`mergePersonDebts`).
* **إدارة الجمعيات والصناديق المشتركة (`Money Circles Manager`):** جدولة أدوار القبض، تتبع أقساط الأعضاء ومزامنة الإيداعات والاستقطاعات تلقائياً مع سجل المعاملات المالية.
* **حاسبة تكلفة المشتريات بساعات العمل (`Work Hours Calculator`):** تحويل فوري لأسعار السلع إلى ساعات وأيام عمل فعلية بناءً على الراتب الصافي للمستخدم للمساعدة في ترشيد قرارات الشراء.
* **مركز التنبيهات الداخلي اللحظي (`Notification Center`):** متابعة الاستحقاقات المالية وتذكيرات الفواتير وتنبيهات الميزانية عبر خمسة أقسام مفلترة.
* **أمان وخصوصية متقدمة (`PIN Lock Gate & Biometrics`):** قفل التطبيق برمز مرور مشفر بـ SHA-256 محلياً مع دعم الفتح بالبصمة البيومترية ووضع إخفاء الأرقام في الأماكن العامة.
* **تصدير وطباعة التقارير:** تصدير المعاملات المفلترة إلى ملفات CSV، وطباعة كشوفات المصاريف والتقارير الشهرية كملفات PDF منسقة.

---

## حزمة التقنيات (Tech Stack)

| المكون | التقنية |
| :--- | :--- |
| **واجهة المستخدم** | React 19 + TypeScript (Strict Mode) |
| **أداة البناء** | Vite 8 + Rolldown |
| **التنسيق والتصميم** | Tailwind CSS v4 (`@tailwindcss/vite` + `@theme`) |
| **التوجيه** | React Router v8 (`react-router`) |
| **الرسوم البيانية** | Recharts v3 |
| **معالجة التواريخ** | `date-fns` مع الحزمة العربية `date-fns/locale/ar` |
| **السحابة والمصادقة** | Firebase JS SDK v12 (Cloud Firestore + Firebase Auth) |
| **التطبيق التقدمي** | `vite-plugin-pwa` (Service Worker & Cache-first) |
| **الاختبارات** | Vitest + Testing Library |

---

## البدء والتثبيت (Getting Started)

### المتطلبات الأساسية
- Node.js (إصدار 20 فأحدث)
- npm (أو أي مدير حزم متوافق)

### خطوات التثبيت والتشغيل المحلي

1. **استنساخ المستودع وتثبيت التبعيات:**
   ```bash
   git clone https://github.com/Mohanad-Abu-Dabbous/masareefi.git
   cd masareefi
   npm install
   ```

2. **إعداد متغيرات البيئة:**
   انسخ ملف `.env.example` إلى `.env.local` وأدخل مفاتيح مشروع Firebase الخاص بك:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

3. **تشغيل خادم التطوير المحلي:**
   ```bash
   npm run dev
   ```

4. **بناء نسخة الإنتاج:**
   ```bash
   npm run build
   ```

5. **معاينة نسخة الإنتاج محلياً:**
   ```bash
   npm run preview
   ```

---

## الفحوصات الهندسية واختبارات الجودة (Quality Verification)

لضمان سلامة الكود واستقراره، يتم تشغيل الفحوصات الإلزامية الأربعة:

```bash
# 1. فحص الأنواع الصارم في TypeScript
npm run typecheck

# 2. فحص جودة الكود والالتزام بالمعايير
npm run lint

# 3. تشغيل كافة اختبارات الوحدة والتكامل
npm run test

# 4. بناء نسخة الإنتاج والتحقق من سلامة الحزم
npm run build
```

لتشغيل اختبارات قواعد أمان Firestore مع محاكي Firebase المحلي:
```bash
npm run test:rules
```

---

## المرجع الهندسي الشامل

للاطلاع على المواصفات الفنية التفصيلية، نماذج البيانات، قواعد الأمان الصارمة، والمعادلات الخوارزمية، راجع:
👉 [`docs/PROJECT_BIBLE.md`](docs/PROJECT_BIBLE.md)
