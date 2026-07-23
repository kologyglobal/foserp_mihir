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
  console.log('login', page.url())

  await page.locator('a[href="/inventory"], a[href^="/inventory/"]').first().click()
  await page.getByText(/Store Home|Issue Stock/i).first().waitFor({ timeout: 30000 })
  await shot('click-01-inventory')
  console.log('inventory', page.url())

  // Click Issue Stock tab (SPA Link or tab button)
  const issueTab = page.getByRole('link', { name: /Issue Stock/i }).or(page.getByRole('tab', { name: /Issue Stock/i })).or(page.getByText(/^Issue Stock$/i))
  await issueTab.first().click({ timeout: 15000 })
  await page.waitForTimeout(1500)
  await page.getByText(/Issue Stock|Assign to production|Posted issues/i).first().waitFor({ timeout: 45000 })
  await shot('click-02-issues')
  console.log('issues', page.url())

  const assign = page.getByRole('button', { name: /Assign to production/i })
  if (await assign.count()) await assign.click()
  await page.waitForTimeout(2500)
  await shot('click-03-assign')

  const search = page.getByPlaceholder(/search/i).first()
  if (await search.count()) {
    await search.fill('WO-000045')
    await page.waitForTimeout(2000)
  }
  await shot('click-04-filtered')
  const body = await page.locator('body').innerText()
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        hasIssueStock: /Issue Stock/i.test(body),
        hasAssign: /Assign to production/i.test(body),
        hasWo: body.includes('WO-000045'),
        hasFasteners: body.includes('BO-FASTENERS'),
        emptyMsg: /Nothing waiting|No open material|No material lines/i.test(body),
        snippet: body.replace(/\s+/g, ' ').slice(0, 700),
      },
      null,
      2,
    ),
  )

  const row = page.locator('tbody tr').filter({ hasText: /WO-000045|BO-FASTENERS/ }).first()
  if (await row.count()) {
    const cb = row.locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check({ force: true })
    const btn = page.getByRole('button', { name: /Create (shortage )?PR|Create PR/i }).first()
    console.log('row_found', 'btn', await btn.count())
    if (await btn.count()) {
      await btn.click()
      await page.waitForTimeout(600)
      const confirm = page.getByRole('button', { name: /Create PR|Create 1 PR|Confirm/i })
      if (await confirm.count()) await confirm.last().click()
      await page.waitForTimeout(3000)
      await shot('click-05-pr')
      const t = await page.locator('body').innerText()
      console.log('after_pr', t.match(/PR[-/A-Z0-9]+/i)?.[0], t.includes('Could not create'))
    }
  } else {
    console.log('no_row')
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
