import fs from 'node:fs'
import path from 'node:path'

const files = [
  'src/components/TransactionForm.tsx',
  'src/pages/DashboardPage.tsx',
  'src/pages/TransactionsPage.tsx',
  'src/pages/RecurringPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/services/transactions.ts',
  'src/services/recurring.ts',
  'src/services/userProfile.ts',
  'src/services/seed.ts',
  'src/types/index.ts',
  'src/App.tsx',
]

// 1. Generate Markdown
let md = `# الملفات الـ 11 البرمجية الكاملة (Complete Code Content)

يحتوي هذا الملف على المحتوى البرمجي الكامل غير المقتطع للملفات الـ 11 الأخيرة التي سقطت تفاصيلها من ناتج Repomix، وذلك لتكون مرجعاً برمجياً شاملاً:

`

for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8')
  const ext = path.extname(f).slice(1)
  md += `## \`${f}\`\n\n\`\`\`${ext}\n${content}\n\`\`\`\n\n---\n\n`
}

fs.writeFileSync('docs/REMAINING_11_FILES.md', md, 'utf-8')

// 2. Generate XML
let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<repository>\n`
for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8')
  xml += `  <file path="${f}">\n<![CDATA[\n${content}\n]]>\n  </file>\n`
}
xml += `</repository>\n`

fs.writeFileSync('remaining-11-files.xml', xml, 'utf-8')

// 3. Generate Plain Text
let txt = `================================================================================\n`
txt += `REMAINING 11 FILES - COMPLETE SOURCE CODE\n`
txt += `================================================================================\n\n`

for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8')
  txt += `================================================================================\n`
  txt += `FILE: ${f}\n`
  txt += `================================================================================\n\n`
  txt += content + `\n\n`
}

fs.writeFileSync('remaining-11-files.txt', txt, 'utf-8')
console.log('Successfully generated docs/REMAINING_11_FILES.md, remaining-11-files.xml, remaining-11-files.txt')
