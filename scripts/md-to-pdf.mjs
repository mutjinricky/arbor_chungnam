import { mdToPdf } from 'md-to-pdf'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const inputs = [
  { md: path.join(ROOT, 'PRODUCT.md'), pdf: path.join(ROOT, 'PRODUCT.pdf') },
  { md: path.join(ROOT, 'SCORING.md'), pdf: path.join(ROOT, 'SCORING.pdf') }
]

const cssPath = path.join(__dirname, 'pdf-style.css')

for (const { md, pdf } of inputs) {
  console.log(`변환: ${path.basename(md)} → ${path.basename(pdf)}`)
  try {
    await mdToPdf(
      { path: md },
      {
        dest: pdf,
        stylesheet: [cssPath],
        pdf_options: {
          format: 'A4',
          margin: {
            top: '18mm',
            right: '16mm',
            bottom: '18mm',
            left: '16mm'
          },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: `
            <div style="font-size:8pt; width:100%; padding:0 16mm; color:#94a3b8; display:flex; justify-content:space-between;">
              <span>DRYAD · 충남 AI 수목관리 의사결정 대시보드</span>
              <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
            </div>
          `
        },
        launch_options: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    )
    console.log(`  ✓ ${pdf}`)
  } catch (e) {
    console.error(`  ✗ ${e.message}`)
    process.exitCode = 1
  }
}
