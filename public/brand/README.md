# بَصير (Baseer) — حزمة التسليم الرسمية للهوية والشعار (Logo Handover Kit v1.0)

حزمة إنتاج متكاملة متوافقة 100% مع دستور التصميم `DESIGN_SYSTEM.md` (**Swiss Carbon & Sapphire Clarity**).

## محتويات الحزمة

- **`01-svg-masters/`**: 9 ملفات Vector أصلية (`viewBox="0 0 256 256"`) مبنية بـ 33 نقطة تثبيت (Anchors) نظيفة تماماً، خالية من النصوص الحية والصور والفلاتر والتدرجات.
  - تتضمن النسخ الفاتحة والداكنة والأحادية (`Mono`) والأيقونة التطبيقية ونسخة **`baseer-favicon-small.svg`** المصقولة بصرياً للمقاسات الصغيرة (`16px–32px`).
- **`02-png-exports/`**: صور PNG عالية الدقة (`512px` و `1024px`) بخلفية شفافة للرموز، ومولّدة مباشرة من معادلات الـ Vector (Supersampling 4x).
- **`03-web-and-pwa/`**: ملفات جاهزة للنسخ مباشرة إلى مجلد `public/` في مشروع Vite/React (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, أيقونات PWA القياسية والـ `Maskable`, `site.webmanifest`, `head-snippet.html`).
- **`04-react-component/`**: مكون `BaseerLogo.tsx` الجاهز للدمج في React + Tailwind، يدعم التبديل التلقائي بين Light/Dark Mode ونسخة `app-icon` ونسخة `mono` والقفل الأفقي مع اسم «بَصير».
- **`05-guidelines-and-handover/`**:
  - `BRAND_GUIDELINES.md`: الدليل البصري المعتمد (الألوان، التباين، مساحة الأمان، المقاسات الدنيا، الممنوعات).
  - `HANDOVER_NOTES.md`: تقرير التدقيق الفني والهندسي وقائمة خطوات الدمج والملاحظات القانونية.
- **`06-qa-verification/`**: لوحة التحقق البصري `baseer-qa-sheet.png` التي تستعرض الوضعين الفاتح والداكن والمقاسات المصغرة ونطاق أمان `Maskable`.
