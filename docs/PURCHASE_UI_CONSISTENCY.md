# Purchase UI Consistency Rules

Source of truth for **Purchase module** frontend look & feel.  
Goal: one enterprise Dynamics / Business Central voice — **not** a collage of one-off “AI demo” screens.

When docs and code disagree, **code wins**, then update this file.

Related: [`UI_VIEW_PAGE_STANDARD.md`](UI_VIEW_PAGE_STANDARD.md) · [`purchase-workflow-map.md`](purchase-workflow-map.md)

---

## 1. North star

| Do | Don’t |
|----|--------|
| Flat white surfaces, navy suite bar, `#0078d4` primary | Purple / indigo / neon gradients |
| Dense 13px UI, tight rows, BC-style FastTabs | Huge padding, “marketing card” grids |
| Reuse purchase shells & CRM register patterns | Invent a new page chrome per screen |
| Status from shared labels (`purchaseStatusLabels` / domain labels) | Ad-hoc badge colors and copy per page |
| `appConfirm` / `appPromptNote` | `window.alert` / `confirm` / `prompt` |

Visual system = **Dynamics tokens** in `frontend/src/styles/dynamics-tokens.css` + existing ERP button/table classes.

---

## 2. Allowed shells (pick one — never invent a fourth)

| Screen type | Shell / pattern | Examples |
|-------------|-----------------|----------|
| Module dashboard | `OperationalPageShell` `variant="dynamics"` + KPI strip (same chrome as registers) | `/purchase` |
| Registers (lists) | `OperationalPageShell` `variant="dynamics"` + `EnterpriseRegisterTableShell` + KPI strip + filter drawer | PR list, PO list, Approvals |
| Document create/edit | `PurchaseCardFormShell` | PR/RFQ/PO/GRN editors |
| Document **view** | `PurchaseCardFormShell` + `detailMode` **or** dynamics `OperationalPageShell` + command bar | RFQ/PO detail; PR domain detail |
| Masters | Purchase master pages / linked master hub | `/purchase/masters/*` |
| Confirm / notes | `ConfirmDialog` via `appConfirm` / `appPromptNote` | Reject, send-back |

**Forbidden:** raw `PageHeader` + handmade card stacks on new purchase pages; one-off gradient hero banners; glassmorphism panels.

---

## 3. Page chrome checklist

Every purchase **list**:

1. Breadcrumbs: `Home › Purchase › {Register}`
2. Title + short description (one line)
3. KPI strip (same enterprise component as CRM/PO register)
4. Filters in drawer / smart filter bar — not a second custom filter UI
5. Primary CTA top-right (`+ Create …`)
6. **Purpose guide width:** set `pageGuide={null}` on the shell and render `ErpPageGuide` inside the **left register column** (same width as the table), not full-bleed above the side rail
7. **Register insights:** `PurchaseRegisterContextPanel` with `placement="split"` → **insights right**, table left (Comparison, RFQ, PO, Invoice)

Every purchase **view**:

1. Breadcrumbs: `Purchase › {Register} › {DocNo}`
2. **In-page Back** via `backLink` / `PageBackLink` at top of content (e.g. “Back to RFQs”) — **not** in command bar or footer
3. Title = document number; status visible in header
4. Command order: `[Edit?] [Print?] [Related…] …… [Primary next action]`
5. Smart context / FactBox on the right when vendor/related/approval facts exist — label it **Smart context / Details**, not “FactBox”

Every purchase **edit**:

1. Sticky record header (doc no + status + key facts)
2. FastTabs: General / Lines first; Commercial & Remarks **collapsed by default**
3. Lines: empty + Add line (no giant empty grid)
4. Validation: summary + field highlight (PR/PO pattern), not toast-only when shell supports it

---

## 4. Visual anti-patterns (AI smell — reject in review)

Do **not** introduce on Purchase screens:

- Purple-to-indigo or multi-stop decorative gradients on cards/KPIs
- Soft glow / blur glass panels
- `rounded-2xl` / `rounded-3xl` marketing cards when siblings use `rounded-md` / D365 radius
- Stacked shadows (`shadow-xl` + colored glow)
- Pill clouds of unrelated chips in the header
- Emoji in labels, titles, or empty states
- Duplicate titles (workspace tab + page H1 + eyebrow all saying the same thing)
- Mixed vocabulary on one page (“FactBox” vs “Smart context”, “Submit” vs “Send for approval” for the same action)

Prefer:

- `border border-erp-border` / `var(--dyn-border)`
- `bg-white` / `var(--dyn-bg-card)`
- Status via `StatusDot` / shared status label maps
- `ErpButton` / `ErpCommandBar` only for actions

---

## 5. Copy & status language

| Use | Avoid |
|-----|--------|
| Shared `*_STATUS_LABELS` from domain / `purchaseStatusLabels` | Hardcoded `"Pending"` that doesn’t match domain enums |
| Short operational descriptions | Marketing fluff (“Unlock powerful procurement…”) |
| One primary verb per status action | Three buttons that do the same thing |

Dialogs for reject / send-back: mandatory notes via `appPromptNote` — never browser `prompt`.

---

## 6. Module tab strip

Workspace tabs under the suite bar:

- Use shared `DynamicsTabs` / module nav band only
- No vertical scrollbar on the tab row (`overflow-y: hidden`)
- No thick OS scrollbar chrome (theme scrollbars / hidden on tab strips)
- Do not add a second in-page tab bar that duplicates module routes

---

## 7. Registers must feel like one family

**Gold path:** [`PURCHASE_LIST_PAGE_STANDARD.md`](PURCHASE_LIST_PAGE_STANDARD.md) — reference page `/purchase/orders`.

When polishing a list, mirror that standard:

- `EnterpriseRegisterTableShell` + embedded `CrmListFilterBar`
- `CrmFilterDrawer` (sectioned fields) — not ad-hoc hero selects
- Saved view + Save view on operational registers
- Columns show/hide **and** reorder
- KPI chips that drive filters
- Right overview / suggestions rail where those pages have it (`placement="split"`)
- Same empty state tone (icon + one sentence + one CTA)

RFQ / GRN / Invoice / Return / VQ lists should converge to this — not stay on older flat `DataTable` + inline `SmartFilterBar` shells when touched.

---

## 8. Density & spacing

- Page content padding: workspace default (`d365-workspace-content`) — don’t add extra `p-8`/`p-10` wrappers
- Section gaps: ~16px (`--dyn-space-section`)
- Row height target ~40px
- Collapse optional FastTabs by default on create

---

## 9. Agent / PR checklist (Purchase UI)

Before merging Purchase UI work:

- [ ] Uses an **allowed shell** from §2  
- [ ] View page has **in-page Back** (`backLink` / `PageBackLink`) per [`UI_VIEW_PAGE_STANDARD.md`](UI_VIEW_PAGE_STANDARD.md)  
- [ ] No new gradient / glow / purple theme  
- [ ] No `window.prompt` / `confirm` / `alert` (use `appConfirm` / `appPromptNote`)  
- [ ] List pages follow [`PURCHASE_LIST_PAGE_STANDARD.md`](PURCHASE_LIST_PAGE_STANDARD.md) when touched  
- [ ] Status labels from shared maps  
- [ ] Command bar has no Back (actions only)  
- [ ] Smart context naming consistent  
- [ ] Demo mode still works (`VITE_USE_API=false`)

---

## 10. Known debt (fix when touching the file)

| Area | Issue |
|------|--------|
| PR domain detail | Still `OperationalPageShell` while RFQ/PO prefer `PurchaseCardFormShell` — converge when editing PR view |
| RFQ KPI tiles on detail | One tile uses `bg-gradient-to-br` — flatten to solid border card when next edited |
| Invoice / Return / VQ lists | Older register chrome vs PR/PO |
| Legacy `PurchaseDocumentPages` / `PurchasePages` hub bits | Prefer domain detail routes; don’t extend legacy |

---

## Related code

| Piece | Path |
|-------|------|
| Tokens | `frontend/src/styles/dynamics-tokens.css` |
| Purchase shell | `frontend/src/components/purchase/PurchaseCardFormShell.tsx` |
| Document FactBox | `frontend/src/components/purchase/PurchaseDocumentFactBox.tsx` |
| Confirm dialog | `frontend/src/components/ui/ConfirmDialog.tsx` |
| Routes | `frontend/src/routes/purchaseRoutes.tsx` |
| Status labels | `frontend/src/utils/purchaseStatusLabels.ts` |
