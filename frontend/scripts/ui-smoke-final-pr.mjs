import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', '_ui_smoke_shortage_out')
mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:5173'
const API = 'http://127.0.0.1:5000/api/v1'
const TENANT = 'vasant-trailers'
const WO = 'WO-000045'

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

async function main() {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@vasant-trailers.com', password: 'Admin@123', tenantSlug: TENANT },
  })
  const token = login.json.data.accessToken

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const shot = async (n) => page.screenshot({ path: join(OUT, `${n}.png`), fullPage: true })
  const results = []

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#email')
  await page.locator('#tenantSlug').fill(TENANT)
  await page.locator('#email').fill('admin@vasant-trailers.com')
  await page.locator('#password').fill('Admin@123')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 })
  await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {})
  await page.getByText(/CRM Command Center/i).first().waitFor({ timeout: 60000 })
  results.push({ step: 'login', ok: true })

  await page.locator('a[href="/inventory"]').first().click()
  await page.getByText(/Store Home/i).first().waitFor({ timeout: 30000 })
  await page.getByText(/^Issue Stock$/i).first().click()
  await page.getByRole('button', { name: /Assign to production/i }).click()
  await page.waitForTimeout(2000)
  const search = page.getByPlaceholder(/search/i).first()
  await search.fill(WO)
  await page.waitForTimeout(1500)
  await shot('final-01-wo-filter')

  // Clear selection then select only No stock rows for this WO
  const headerCb = page.locator('thead input[type="checkbox"]').first()
  if (await headerCb.count()) await headerCb.uncheck({ force: true }).catch(() => {})
  const shortRows = page.locator('tbody tr').filter({ hasText: /No stock/i })
  const count = await shortRows.count()
  for (let i = 0; i < count; i++) {
    const row = shortRows.nth(i)
    const text = await row.innerText()
    if (text.includes('PR-')) continue // skip already PR'd
    const cb = row.locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check({ force: true })
  }
  await page.waitForTimeout(400)
  await shot('final-02-selected-short')
  const createBtn = page.getByRole('button', { name: /Create PR for short|Create 1 PR/i }).first()
  const enabled = !(await createBtn.isDisabled())
  const label = await createBtn.innerText()
  results.push({ step: '1.select_short', ok: enabled, detail: label })
  if (!enabled) {
    console.log(JSON.stringify({ results }, null, 2))
    await browser.close()
    return
  }
  await createBtn.click()
  await page.waitForTimeout(500)
  const confirm = page.getByRole('button', { name: /Create PR|Create 1 PR|Confirm/i })
  if (await confirm.count()) await confirm.last().click()
  await page.waitForTimeout(4000)
  await shot('final-03-after-create')
  const body = await page.locator('body').innerText()
  const failed = /Validation failed|Could not create/i.test(body)
  const prMatch = body.match(/PR[-/]?\d{5,}/i)
  results.push({ step: '1.create_pr_ui', ok: !failed && Boolean(prMatch), detail: `${prMatch?.[0] ?? 'none'} failed=${failed}` })

  // Find latest PR for this WO via API
  let prId = null
  let prNumber = prMatch?.[0]
  const mats = await api(`/t/${TENANT}/manufacturing/work-orders/1d6842bf-7be9-4022-802c-6cf693a3a2ce/materials`, { token })
  const list = Array.isArray(mats.json.data) ? mats.json.data : mats.json.data?.materials ?? []
  const withPr = list.find((m) => m.purchaseRequisitionId)
  if (withPr) {
    prId = withPr.purchaseRequisitionId
  }
  if (!prId) {
    const prs = await api(`/t/${TENANT}/purchase/requisitions?pageSize=20&sort=createdAt:desc`, { token })
    const rows = prs.json?.data?.items ?? prs.json?.data ?? []
    const hit = (Array.isArray(rows) ? rows : [])[0]
    prId = hit?.id
    prNumber = hit?.documentNumber ?? hit?.requisitionNumber ?? prNumber
  }

  if (prId) {
    // SPA navigate via procurement
    await page.locator('a[href="/purchase"], a[href^="/purchase/"]').first().click().catch(async () => {
      await page.goto(`${BASE}/purchase/requisitions/${prId}`, { waitUntil: 'domcontentloaded' })
    })
    await page.waitForTimeout(1000)
    // Direct go may lose session if backend flaps — prefer evaluate history only if already authed
    if (!page.url().includes(`/purchase/requisitions/${prId}`)) {
      await page.goto(`${BASE}/purchase/requisitions/${prId}`, { waitUntil: 'domcontentloaded' })
      await page.getByText(/Loading data from server/i).waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    }
    await page.waitForTimeout(2000)
    await shot('final-04-pr-detail')
    if (page.url().includes('/login')) {
      results.push({ step: '2.pr_detail', ok: false, detail: 'redirected to login' })
    } else {
      const submit = page.getByRole('button', { name: /^Submit$/i })
      if (await submit.count()) {
        await submit.click()
        await page.waitForTimeout(2000)
      }
      const approve = page.getByRole('button', { name: /^Approve$/i })
      if (await approve.count()) {
        await approve.click()
        await page.waitForTimeout(2000)
      }
      await shot('final-05-pr-after-actions')
      const prGet = await api(`/t/${TENANT}/purchase/requisitions/${prId}`, { token })
      const st = prGet.json?.data?.status
      prNumber = prGet.json?.data?.documentNumber ?? prNumber
      results.push({ step: '2.approve_pr', ok: String(st).toLowerCase() === 'approved', detail: `${prNumber} status=${st}` })
    }
  } else {
    results.push({ step: '2.approve_pr', ok: false, detail: 'no prId' })
  }

  console.log(JSON.stringify({ results, prId, prNumber }, null, 2))
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
