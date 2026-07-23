import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', '_ui_smoke_shortage_out')
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const shot = async (n) => page.screenshot({ path: join(OUT, `${n}.png`), fullPage: true })

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#email', { timeout: 20000 })
  await page.locator('#tenantSlug').fill('vasant-trailers')
  await page.locator('#email').fill('admin@vasant-trailers.com')
  await page.locator('#password').fill('Admin@123')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
  await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {})
  await page.getByText(/CRM Command Center/i).first().waitFor({ timeout: 60000 })

  await page.locator('a[href="/inventory"], a[href^="/inventory/"]').first().click()
  await page.getByText(/Store Home|Issue Stock/i).first().waitFor({ timeout: 30000 })
  const issueTab = page
    .getByRole('link', { name: /Issue Stock/i })
    .or(page.getByRole('tab', { name: /Issue Stock/i }))
    .or(page.getByText(/^Issue Stock$/i))
  await issueTab.first().click({ timeout: 15000 })
  await page.getByRole('button', { name: /Assign to production/i }).waitFor({ timeout: 45000 })
  await page.getByRole('button', { name: /Assign to production/i }).click()
  await page.waitForTimeout(2000)

  // Prefer shortage view
  const shortageView = page.getByRole('button', { name: /^Shortage$/i }).or(page.getByText(/^Shortage$/i))
  if (await shortageView.count()) await shortageView.first().click().catch(() => {})
  await page.waitForTimeout(800)

  const search = page.getByPlaceholder(/search/i).first()
  if (await search.count()) {
    await search.fill('BO-FASTENERS')
    await page.waitForTimeout(1500)
  }
  await shot('pr-01-shortage-filter')

  // Uncheck header if all selected, then select short rows
  const headerCb = page.locator('thead input[type="checkbox"]').first()
  if (await headerCb.count()) {
    // clear then select all visible (shortage view)
    await headerCb.uncheck({ force: true }).catch(() => {})
    await page.waitForTimeout(200)
    await headerCb.check({ force: true }).catch(() => {})
  }

  // Also select any No stock rows explicitly
  const shortRows = page.locator('tbody tr').filter({ hasText: /No stock|BO-FASTENERS/i })
  const n = await shortRows.count()
  for (let i = 0; i < Math.min(n, 20); i++) {
    const cb = shortRows.nth(i).locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check({ force: true }).catch(() => {})
  }
  await page.waitForTimeout(500)
  await shot('pr-02-selected')

  const createBtn = page.getByRole('button', { name: /Create PR for short|Create 1 PR|Create PR/i })
  const label = (await createBtn.first().innerText().catch(() => '')).trim()
  console.log('create_btn', label, 'disabled', await createBtn.first().isDisabled())
  if (await createBtn.first().isDisabled()) {
    console.log('BODY', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 800))
    await browser.close()
    return
  }
  await createBtn.first().click()
  await page.waitForTimeout(600)
  const confirm = page.getByRole('button', { name: /Create PR|Create 1 PR|Confirm/i })
  if (await confirm.count()) await confirm.last().click()
  await page.waitForTimeout(3500)
  await shot('pr-03-created')
  const body = await page.locator('body').innerText()
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        pr: body.match(/PR[-/]?\d[\w/-]*/i)?.[0] ?? null,
        toast: /created|Could not create|error/i.test(body),
        snippet: body.replace(/\s+/g, ' ').slice(0, 500),
      },
      null,
      2,
    ),
  )
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
