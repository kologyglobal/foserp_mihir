/**
 * UI/UX check: header command-bar buttons share one baseline and are not clipped.
 * Usage (from frontend/): node scripts/ui-test-command-bar.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.UI_BASE_URL || 'http://localhost:5173'
const OUT = join(tmpdir(), 'fos-erp-ui-command-bar')
mkdirSync(OUT, { recursive: true })

const pages = [
  { name: 'companies', path: '/crm/companies' },
  { name: 'tax-invoices', path: '/sales/invoices' },
  { name: 'sales-orders', path: '/sales/orders' },
  { name: 'opportunities', path: '/crm/opportunities' },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(800)
  const inputs = await page.$$('input')
  const textInputs = []
  const passInputs = []
  for (const input of inputs) {
    const type = await page.evaluate((el) => (el.type || '').toLowerCase(), input)
    if (type === 'password') passInputs.push(input)
    else if (['email', 'text', 'search', ''].includes(type)) textInputs.push(input)
  }
  if (textInputs[0]) {
    await textInputs[0].click({ clickCount: 3 })
    await textInputs[0].type('vasant-trailers')
  }
  if (textInputs[1]) {
    await textInputs[1].click({ clickCount: 3 })
    await textInputs[1].type('admin@vasant-trailers.com')
  }
  if (passInputs[0]) {
    await passInputs[0].click({ clickCount: 3 })
    await passInputs[0].type('Admin@123')
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /sign in|log in|login/i.test(b.textContent || ''),
    )
    if (btn) btn.click()
  })
  await sleep(3000)
}

async function measure(page) {
  return page.evaluate(() => {
    const actions = document.querySelector('.d365-workspace-unified-actions')
    const buttons = [...document.querySelectorAll('.d365-workspace-unified-actions .erp-command-btn')]
    if (!actions || buttons.length === 0) {
      return { ok: false, error: 'No command buttons found', buttonCount: buttons.length }
    }
    const aRect = actions.getBoundingClientRect()
    const rows = buttons.map((btn) => {
      const r = btn.getBoundingClientRect()
      const cs = getComputedStyle(btn)
      return {
        label: (btn.textContent || '').trim().replace(/\s+/g, ' '),
        top: Math.round(r.top * 10) / 10,
        left: Math.round(r.left * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
        clippedLeft: r.left < aRect.left - 0.5,
        clippedTop: r.top < aRect.top - 1,
        heightCss: cs.height,
      }
    })
    const tops = rows.map((r) => r.top)
    const heights = rows.map((r) => r.height)
    const topSpread = Math.max(...tops) - Math.min(...tops)
    const heightSpread = Math.max(...heights) - Math.min(...heights)
    const anyClipped = rows.some((r) => r.clippedLeft || r.clippedTop)
    const orderOk = rows.every((r, i) => i === 0 || r.left >= rows[i - 1].left - 0.5)
    return {
      ok: topSpread <= 1.5 && heightSpread <= 1.5 && !anyClipped && orderOk,
      topSpread,
      heightSpread,
      anyClipped,
      orderOk,
      actions: { left: aRect.left, right: aRect.right, width: aRect.width },
      buttons: rows,
    }
  })
}

const report = { base: BASE, results: [] }
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--window-size=1440,900', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
})

try {
  const page = await browser.newPage()
  await login(page)
  for (const p of pages) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(1800)
    const shot = join(OUT, `${p.name}.png`)
    const header = await page.$('.d365-workspace-unified-head')
    if (header) await header.screenshot({ path: shot })
    else await page.screenshot({ path: shot, clip: { x: 180, y: 40, width: 1220, height: 140 } })
    const metrics = await measure(page)
    report.results.push({ page: p.name, path: p.path, shot, ...metrics })
  }
} catch (err) {
  report.error = String(err?.stack || err)
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
const failed = (report.results || []).filter((r) => !r.ok)
process.exit(report.error || failed.length ? 1 : 0)
