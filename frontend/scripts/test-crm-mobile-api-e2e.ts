/**
 * P2-3 — Mobile CRM API-mode E2E
 * npm run test:crm-mobile-api-e2e
 *
 * Verifies mobile `/m/crm/*` wiring + live CRM APIs that hydrate those pages
 * (same endpoints as `syncAllCrmFromApi` / `useCrmApiSync`).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.CRM_E2E_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.CRM_E2E_PASSWORD ?? 'Admin@123'

let pass = 0
let fail = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

type ApiEnvelope<T> = {
  success?: boolean
  message?: string
  data?: T
  meta?: { total?: number; page?: number; totalPages?: number } | null
}

async function api<T>(
  method: string,
  pathSuffix: string,
  token?: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: ApiEnvelope<T> }> {
  const res = await fetch(`${BASE}${pathSuffix}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>
  return { ok: res.ok, status: res.status, json }
}

console.log('\nMobile CRM API-mode E2E (P2-3)\n')

// ─── Static wiring ────────────────────────────────────────────────────────────

const mobilePages = read('src/modules/mobile/MobileCrmPages.tsx')
const mobileRoutes = read('src/routes/mobileRoutes.tsx')
const pipelinePage = read('src/modules/mobile/MobileCrmPipelinePage.tsx')
const bridge = read('src/services/bridges/crmApiBridge.ts')
const store = read('src/store/crmStore.ts')
const hydration = read('src/bootstrap/apiHydration.ts')
const pipelineUtil = read('src/utils/mobileCrmPipeline.ts')

check(1, 'Mobile CRM hub route at /m/crm', mobileRoutes.includes("path: 'crm', element: <MobileCrmPipelinePage />"))
check(2, 'Mobile leads route wired', mobileRoutes.includes("path: 'crm/leads', element: <MobileCrmLeadsPage />"))
check(3, 'Mobile follow-ups route wired', mobileRoutes.includes("path: 'crm/follow-ups', element: <MobileCrmFollowUpsPage />"))
check(4, 'Mobile opportunities + activities + customers routes', [
  "path: 'crm/opportunities'",
  "path: 'crm/activities'",
  "path: 'crm/customers'",
].every((p) => mobileRoutes.includes(p)))
check(5, 'Mobile pages read salesStore leads', mobilePages.includes('useSalesStore') && mobilePages.includes('s.leads'))
check(6, 'Mobile follow-ups read crmStore', mobilePages.includes('useCrmStore') && mobilePages.includes('s.followUps'))
check(7, 'Mobile Mark done calls completeFollowUp', mobilePages.includes('completeFollowUp(f.id'))
check(8, 'completeFollowUp bridges to API in API mode', store.includes('isApiMode()') && store.includes('apiCompleteFollowUp'))
check(9, 'syncAllCrmFromApi hydrates leads + follow-ups', bridge.includes('syncAllCrmFromApi') && bridge.includes("'/crm/leads'") && bridge.includes("'/crm/follow-ups'"))
check(10, 'App hydration calls syncAllCrmFromApi', hydration.includes('syncAllCrmFromApi'))
check(11, 'Pipeline util points to /m/crm/leads + follow-ups', pipelineUtil.includes("'/m/crm/leads'") && pipelineUtil.includes("'/m/crm/follow-ups'"))
check(12, 'No separate mobile CRM API client in pages', !mobilePages.includes('fetch(') && !mobilePages.includes('crmApi'))
check(13, 'Pipeline hub uses shared metrics util', pipelinePage.includes('buildMobileCrmPipelineMetrics') || pipelinePage.includes('buildMobileCrmPipelineStages') || pipelinePage.includes('MobileCrmPipelineNav'))

// ─── Live API (same endpoints mobile sync uses) ───────────────────────────────

let token = ''
let userId = ''

try {
  const health = await fetch(`${BASE}/health`)
  check(14, 'Backend health', health.ok, `HTTP ${health.status}`)
  if (!health.ok) throw new Error('health failed')

  const login = await api<{
    accessToken: string
    refreshToken: string
    user: { id: string; email: string; permissions: string[] }
  }>('POST', '/auth/login', undefined, { email: EMAIL, password: PASSWORD, tenantSlug: TENANT })

  token = login.json.data?.accessToken ?? ''
  userId = login.json.data?.user?.id ?? ''
  check(15, 'Tenant admin login', Boolean(token && userId), login.json.data?.user?.email ?? login.json.message)
  if (!token) throw new Error('login failed')

  const t = `/t/${TENANT}`
  const [leads, followUps, opps, activities, companies] = await Promise.all([
    api<unknown[]>('GET', `${t}/crm/leads?page=1&limit=20`, token),
    api<unknown[]>('GET', `${t}/crm/follow-ups?page=1&limit=20`, token),
    api<unknown[]>('GET', `${t}/crm/opportunities?page=1&limit=20`, token),
    api<unknown[]>('GET', `${t}/crm/activities?page=1&limit=20`, token),
    api<unknown[]>('GET', `${t}/crm/companies?page=1&limit=20`, token),
  ])

  check(16, 'GET /crm/leads (MobileCrmLeadsPage source)', leads.ok && Array.isArray(leads.json.data), `count=${leads.json.data?.length ?? 0} total=${leads.json.meta?.total ?? '?'}`)
  check(17, 'GET /crm/follow-ups (MobileCrmFollowUpsPage source)', followUps.ok && Array.isArray(followUps.json.data), `count=${followUps.json.data?.length ?? 0}`)
  check(18, 'GET /crm/opportunities (mobile list source)', opps.ok && Array.isArray(opps.json.data), `count=${opps.json.data?.length ?? 0}`)
  check(19, 'GET /crm/activities (mobile list source)', activities.ok && Array.isArray(activities.json.data), `count=${activities.json.data?.length ?? 0}`)
  check(20, 'GET /crm/companies (mobile customers source)', companies.ok && Array.isArray(companies.json.data), `count=${companies.json.data?.length ?? 0}`)

  type LeadRow = { id: string; lifecycleStatus?: string; status?: string; stage?: string }
  const leadRows = (leads.json.data ?? []) as LeadRow[]
  const openLead = leadRows.find((l) => (l.lifecycleStatus ?? l.status) !== 'closed') ?? leadRows[0]
  check(21, 'At least one lead for mobile list / follow-up', Boolean(openLead?.id), openLead?.id?.slice(0, 8))

  if (openLead?.id) {
    const today = new Date().toISOString().slice(0, 10)
    const createFu = await api<{ id: string; status: string; dueDate: string; notes?: string }>(
      'POST',
      `${t}/crm/follow-ups`,
      token,
      {
        followUpType: 'call',
        leadId: openLead.id,
        assignedTo: userId,
        dueDate: today,
        dueTime: '17:00',
        priority: 'medium',
        notes: 'P2-3 mobile API E2E follow-up',
        reminder: false,
      },
    )
    check(22, 'POST /crm/follow-ups (mobile quick follow-up path)', createFu.ok && Boolean(createFu.json.data?.id), createFu.json.message ?? createFu.json.data?.id?.slice(0, 8))

    const fuId = createFu.json.data?.id
    if (fuId) {
      const dueOk =
        createFu.json.data?.status === 'pending' ||
        createFu.json.data?.status === 'overdue' ||
        createFu.json.data?.dueDate?.slice(0, 10) === today
      check(23, 'Created follow-up is due for mobile Today list', Boolean(dueOk), `status=${createFu.json.data?.status}`)

      const complete = await api<{ id: string; status: string }>(
        'POST',
        `${t}/crm/follow-ups/${fuId}/complete`,
        token,
        { outcome: 'Completed on mobile E2E' },
      )
      check(24, 'POST …/follow-ups/:id/complete (mobile Mark done)', complete.ok && complete.json.data?.status === 'completed', complete.json.data?.status ?? complete.json.message)

      const getFu = await api<{ id: string; status: string }>('GET', `${t}/crm/follow-ups/${fuId}`, token)
      check(25, 'Follow-up remains completed after refetch', getFu.ok && getFu.json.data?.status === 'completed', getFu.json.data?.status)
    } else {
      check(23, 'Created follow-up is due for mobile Today list', false, 'no id')
      check(24, 'POST …/follow-ups/:id/complete (mobile Mark done)', false, 'skipped')
      check(25, 'Follow-up remains completed after refetch', false, 'skipped')
    }
  } else {
    check(22, 'POST /crm/follow-ups (mobile quick follow-up path)', false, 'no lead')
    check(23, 'Created follow-up is due for mobile Today list', false, 'skipped')
    check(24, 'POST …/follow-ups/:id/complete (mobile Mark done)', false, 'skipped')
    check(25, 'Follow-up remains completed after refetch', false, 'skipped')
  }

  // Optional browser reachability of mobile routes (SPA shell)
  try {
    const fe = await fetch('http://127.0.0.1:5173/m/crm/leads', { redirect: 'manual' })
    check(26, 'Frontend serves /m/crm/leads', fe.status === 200 || fe.status === 302 || fe.status === 0, `HTTP ${fe.status}`)
  } catch (e) {
    check(26, 'Frontend serves /m/crm/leads', true, `skipped — FE unreachable (${e instanceof Error ? e.message : 'err'})`)
  }
} catch (e) {
  check(14, 'Live API section', false, e instanceof Error ? e.message : String(e))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
