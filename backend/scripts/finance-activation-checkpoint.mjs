const BASE = 'http://localhost:5000/api/v1';
const SLUG = 'vasant-trailers';
const MANDATORY_KEYS = [
  'CUSTOMER_RECEIVABLE','VENDOR_PAYABLE','SALES_REVENUE','PURCHASE',
  'GST_INPUT_CGST','GST_INPUT_SGST','GST_INPUT_IGST',
  'GST_OUTPUT_CGST','GST_OUTPUT_SGST','GST_OUTPUT_IGST','RETAINED_EARNINGS',
];
const SERIES_TYPES = ['JOURNAL','RECEIPT','PAYMENT','CONTRA','CREDIT_NOTE','DEBIT_NOTE','OPENING_BALANCE','REVERSAL'];
const KEY_TYPES = {
  CUSTOMER_RECEIVABLE: ['CUSTOMER_RECEIVABLE'],
  VENDOR_PAYABLE: ['VENDOR_PAYABLE'],
  SALES_REVENUE: ['SALES','OTHER_INCOME'],
  PURCHASE: ['PURCHASE'],
  GST_INPUT_CGST: ['GST_INPUT'],
  GST_INPUT_SGST: ['GST_INPUT'],
  GST_INPUT_IGST: ['GST_INPUT'],
  GST_OUTPUT_CGST: ['GST_OUTPUT'],
  GST_OUTPUT_SGST: ['GST_OUTPUT'],
  GST_OUTPUT_IGST: ['GST_OUTPUT'],
  RETAINED_EARNINGS: ['RETAINED_EARNINGS'],
};

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function pickAccount(accounts, types, used) {
  for (const t of types) {
    const hit = accounts.find((a) => !a.isGroup && a.isActive !== false && a.accountType === t && !used.has(a.id));
    if (hit) return hit;
  }
  return null;
}

(async () => {
  const steps = [];
  const login = await req('POST', '/auth/login', null, {
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: SLUG,
  });
  steps.push({ step: 'POST /auth/login', status: login.status, ok: login.status === 200 });
  const token = login.json?.data?.accessToken;
  if (!token) {
    console.log(JSON.stringify({ steps, blocker: 'login failed', login: login.json }, null, 2));
    process.exit(1);
  }
  const prefix = `/t/${SLUG}/accounting`;
  const code = `CK${String(Date.now()).slice(-6)}`;
  const le = await req('POST', `${prefix}/legal-entities`, token, {
    code,
    legalName: 'Checkpoint Legal Entity Pvt Ltd',
    displayName: 'Checkpoint LE',
    gstin: '27AABCU9603R1ZM',
  });
  steps.push({ step: 'POST /accounting/legal-entities', status: le.status });
  const legalEntityId = le.json?.data?.id;
  if (!legalEntityId) {
    console.log(JSON.stringify({ steps, blocker: 'legal entity create failed', body: le.json }, null, 2));
    process.exit(1);
  }

  const fy = await req('POST', `${prefix}/financial-years`, token, {
    legalEntityId,
    name: 'FY Checkpoint 2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isCurrent: true,
  });
  steps.push({ step: 'POST /accounting/financial-years', status: fy.status });
  const financialYearId = fy.json?.data?.id;
  const fyAct = await req('POST', `${prefix}/financial-years/${financialYearId}/activate`, token, {});
  steps.push({ step: 'POST /accounting/financial-years/:id/activate', status: fyAct.status });

  const tmpl = await req('POST', `${prefix}/accounts/apply-template`, token, { legalEntityId, templateId: 'TRADING' });
  steps.push({ step: 'POST /accounting/accounts/apply-template', status: tmpl.status });

  const accts = await req('GET', `${prefix}/accounts?legalEntityId=${legalEntityId}&limit=100`, token);
  steps.push({ step: 'GET /accounting/accounts', status: accts.status, count: accts.json?.data?.length ?? 0 });
  const accounts = accts.json?.data ?? [];
  const used = new Set();
  const mappings = [];
  for (const key of MANDATORY_KEYS) {
    const acc = pickAccount(accounts, KEY_TYPES[key], used);
    if (acc) {
      used.add(acc.id);
      mappings.push({ mappingKey: key, accountId: acc.id });
    }
  }
  const map = await req('PUT', `${prefix}/default-mappings`, token, { legalEntityId, mappings });
  steps.push({ step: 'PUT /accounting/default-mappings', status: map.status, mapped: mappings.length });

  const series = SERIES_TYPES.map((documentType) => ({ documentType, prefix: documentType.slice(0, 3), padLength: 5 }));
  const ns = await req('PUT', `${prefix}/number-series`, token, { legalEntityId, series });
  steps.push({ step: 'PUT /accounting/number-series', status: ns.status });

  const setup = await req('GET', `${prefix}/setup-status?legalEntityId=${legalEntityId}`, token);
  steps.push({ step: 'GET /accounting/setup-status', status: setup.status, ready: setup.json?.data?.ready, missing: setup.json?.data?.missing });

  const activate = await req('POST', `${prefix}/activate`, token, { legalEntityId });
  steps.push({
    step: 'POST /accounting/activate',
    status: activate.status,
    financeActivated: activate.json?.data?.financeActivated,
    ready: activate.json?.data?.ready,
    missing: activate.json?.data?.missing,
    message: activate.json?.message,
  });

  console.log(JSON.stringify({ legalEntityId, financialYearId, steps }, null, 2));
})().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
