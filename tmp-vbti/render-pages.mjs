import { chromium } from 'playwright'
import fs from 'fs'

fs.mkdirSync('pages', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#444} #c{display:block;margin:0 auto;background:#fff}
</style></head><body>
<canvas id="c"></canvas>
<script type="module">
import * as pdfjs from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
const doc = await pdfjs.getDocument('http://127.0.0.1:8765/vbti.pdf').promise;
window.__doc = doc;
window.__pdfjs = pdfjs;
window.__ready = true;
window.__pages = doc.numPages;
</script></body></html>`

await page.setContent(html, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 })
const numPages = await page.evaluate(() => window.__pages)
console.log('pages', numPages)

for (let i = 1; i <= numPages; i++) {
  await page.evaluate(async (pageNum) => {
    const pdfPage = await window.__doc.getPage(pageNum)
    const viewport = pdfPage.getViewport({ scale: 1.4 })
    const canvas = document.getElementById('c')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  }, i)
  await page.waitForTimeout(200)
  const out = `pages/page-${String(i).padStart(2, '0')}.png`
  await page.locator('#c').screenshot({ path: out })
  console.log('wrote', out)
}

await browser.close()
