# CRM UAT — Browser Sign-off Checklist

**Prerequisites (verified):**
- Backend: `http://localhost:5000` (`cd backend && npx tsx src/server.ts`)
- Frontend: `http://localhost:5173` (`cd trailer-erp && npm run dev`)
- `.env`: `VITE_USE_API=true`, `VITE_TENANT_SLUG=vasant-trailers`
- Login: `admin@vasant-trailers.com` / `Admin@123`

**API verification:** run `npm run test:uat-manual-signoff` — see `UAT_MANUAL_SIGNOFF_REPORT.md`

---

## UAT-01 Authentication

- [ ] `/login` — split layout, demo credentials button works
- [ ] Sign in — lands on CRM dashboard
- [ ] Refresh (F5) — session persists, no re-login
- [ ] Sign out — returns to login; `/crm` redirects when unauthenticated
- [ ] Shop-floor role (role switch): `/crm` → Access Denied
- [ ] Sales manager: `/crm` loads dashboard

## UAT-02 Lead lifecycle

- [ ] Create lead at `/crm/leads/new` — new lead number assigned
- [ ] Blank prospect/owner — inline errors before save
- [ ] Edit lead — stage chip; converted lead read-only
- [ ] List search/filter/sort
- [ ] 360 view — stage matches list
- [ ] Dashboard funnel + Reports → Lead Stage labels match
- [ ] Stage progression: New → Contacted → Requirement → Qualified
- [ ] Duplicate lead — `(Copy)` prospect, stage reset to New
- [ ] Reassign owner — list + 360 update
- [ ] Archive/delete — modal; converted lead blocked

## UAT-03 Opportunity lifecycle

- [ ] Standalone create at `/crm/opportunities/new`
- [ ] Convert from lead — prefill; repeat convert blocked
- [ ] Contact filtered by company on edit
- [ ] Kanban drag — lost reason / won approval prompts
- [ ] Value, probability, close date — forecast updates
- [ ] Reassign owner — list + 360 + reports
- [ ] Mark lost/won — timeline events linked
- [ ] API mode: Opportunity History panel (stage/assignment/amount/status tabs)

## UAT-04 Activities & follow-ups

- [ ] Log call on lead 360 → timeline
- [ ] Meeting follow-up on opportunity → pipeline Follow-ups tab
- [ ] Task activity (API mode)
- [ ] Complete follow-up → `follow_up_completed` in timeline
- [ ] Overdue past-due badge on dashboard
- [ ] Dashboard due-today / overdue counters match panel
- [ ] Refresh — activities persist
- [ ] Navigate away/back — no orphan records

## UAT-05 Quotation lifecycle

- [ ] Create quotation from opportunity
- [ ] Line items, tax, discount, grand total
- [ ] Draft — editable, no convert button
- [ ] Submit for approval (>₹50L or discount >10%)
- [ ] Approve (sales manager); shop-floor blocked
- [ ] Reject → revision — rev increments, old locked
- [ ] **Latest** badge on current revision
- [ ] Approve latest → Convert to SO button
- [ ] Second convert blocked

## UAT-06 Sales Order conversion

- [ ] Approved quotation → Create Sales Order
- [ ] SO form prefills customer, lines, terms
- [ ] Save → SO 360 with unique `SO-…` number
- [ ] Quotation shows **Converted** + View SO link
- [ ] Refresh — linkage persists
- [ ] Second conversion blocked
- [ ] CRM has no MRP/production actions; Sales module owns execution

## UAT-07 Navigation

- [ ] Sidebar — each CRM item lands correctly
- [ ] Dashboard KPIs / quick actions / next-actions links
- [ ] List row View/Edit/Convert routes
- [ ] Lead 360 customer link → Entity 360 (`/entity360/customers/:id`)
- [ ] Breadcrumbs CRM → dashboard → list
- [ ] Browser Back/Forward — filter state
- [ ] F5 on detail/editor deep links
- [ ] New tab: `/crm/opportunities/:id`, quotation editor `?doc=`
- [ ] Invalid `/crm/unknown` → redirects to `/crm`

## UAT-09 Edge cases

- [ ] Blank required fields — inline errors
- [ ] Invalid email on contact form
- [ ] Zero/negative qty on opportunity lines
- [ ] Rapid double-click Save — one record only
- [ ] Rapid double-click Convert — one opportunity only
- [ ] F5 mid-form — draft/autosave or clear message
- [ ] Back after conversion — no duplicate convert
- [ ] Clear `fos-erp-auth` in DevTools → Save redirects to login
- [ ] Stop backend → Save shows toast (not silent)
- [ ] Empty filter / nonsense search — empty state, no crash

---

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| QA | | | |
| Product | | | |
