# مصاريفي — Engineering Conventions (binding for every agent)

Read `docs/PLAN.md` (architecture, data model) and `docs/UI_DESIGN.md` + `docs/design/*.jpg` (visual reference) before working.

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
- All user-facing text in Arabic. Numbers in Western digits (0-9) for readability: use `Intl.NumberFormat('ar-JO', { numberingSystem: 'latn' })`.

## Money & dates
- Store money as **integer fils** (`amountFils`, 1 JOD = 1000 fils). Never store floats. Display e.g. `12.500 د.أ`.
- Dates stored as Firestore `Timestamp`. Month boundaries respect the user's `monthStartDay` (1–28).

## Code structure
- Follow the tree in `docs/PLAN.md`. All Firestore access lives in `src/services/*`; components never import `firebase/firestore` directly.
- Pure logic (`src/lib/*`) must have Vitest unit tests next to it (`*.test.ts`).
- No `any`. No unused code. Keep components small.

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
