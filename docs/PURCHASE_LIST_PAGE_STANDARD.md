# Purchase List Page Standard

Canonical chrome for **Purchase register / list** screens.  
Reference implementation: **`/purchase/orders`** (`PurchaseOrderListPage` + `PurchaseOrdersTable`).

When docs and code disagree, **code wins** — then update this file.

Related: [`PURCHASE_UI_CONSISTENCY.md`](PURCHASE_UI_CONSISTENCY.md) · [`UI_VIEW_PAGE_STANDARD.md`](UI_VIEW_PAGE_STANDARD.md)

---

## 1. Required chrome (every list)

| Element | Rule |
|---------|------|
| Shell | `OperationalPageShell` `variant="dynamics"` |
| Table shell | `EnterpriseRegisterTableShell` |
| Grid | `ErpDataGrid` / `DataGrid` with **embedded** `registerBar` |
| Filter bar | `CrmListFilterBar` (search + Filters + Sort + Saved view) |
| Advanced filters | `CrmFilterDrawer` (right drawer) — **not** a second inline filter strip |
| KPI strip | Optional but preferred when the register has actionable queues |
| Purpose guide | `pageGuide={null}` on shell; `ErpPageGuide` inside the **left** column (same width as table) |
| Context rail | `PurchaseRegisterContextPanel` on `xl` when the register already has it |
| Confirms | `appConfirm` / `appPromptNote` / `ConfirmDialog` — **never** `window.confirm` / `alert` / `prompt` |

---

## 2. Filter bar layout (fixed order)

```text
Wide:   [ Search ………… ] [ Sort ▾ ] [ View ▾ ] [ Save view ] [ Columns ▾ ] [ Filters ▾ ]
Narrow: [ Search ………… ] [ Sort ▾ ]
        [ View ▾ ] [ Save view ] [ Columns ▾ ] [ Filters ▾ ]
```

Rules:

1. **One horizontal band** when width allows; otherwise **row 1 = Search + Sort**, **row 2 = View / Save / Columns / Filters** (never stagger controls in a vertical stack).
2. All toolbar controls share **36px height** and **8px border-radius** (search, selects, and buttons — no square selects next to rounded inputs).
3. Sort / View use **native** selects with fixed wrap widths (`shrink-0`) — never `w-full` in the toolbar.
4. **Filters** opens `CrmFilterDrawer` — last control on the right of the tools group.
5. Do **not** show a duplicate “Purchase Orders (N)” label in the register bar — pagination already shows totals.
6. **Never** show the ⌘K command-palette hint on Purchase pages (`showCommandPaletteHint` defaults to `false`; purchase tables force it off).
7. Active filters appear as **chips** under the bar; Clear removes them.

### Forbidden filter placements

| Don’t | Do instead |
|-------|------------|
| `SmartFilterBar` above the table with ad-hoc `<Select>`s | `CrmListFilterBar` / `PurchaseSimpleListFilterBar` (+ drawer when advanced filters exist) |
| Filters only in page hero / KPI row | Embedded register bar |
| Save view on some lists, missing on siblings | Add `useSavedViews` + `SaveViewDialog` |
| Duplicate search (toolbar + register bar) | `showCompactSearch={false}` when `registerBar` is set |
| ⌘K hint in list search | Forbidden on all Purchase lists |

---

## 3. Filter drawer content

- Title: `Filter {register}` (e.g. “Filter purchase orders”).
- Group fields with `{ type: 'section', label: '…' }`:
  - **Status & workflow**
  - **Parties & location** (or equivalent)
  - **Dates**
- Footer actions: **Reset** · **Apply** (short labels).
- Optional `savedViewsSlot` tip pointing users to **Save view** on the bar.
- Chip labels via a dedicated resolver (see `poFilterChipLabelResolver`).

---

## 4. Saved views

Use `useSavedViews({ pageId, filters, onApply, systemPresets })` + `SaveViewDialog`.

| Requirement | Detail |
|-------------|--------|
| `pageId` | Stable route key, e.g. `/purchase/orders` |
| Persist | localStorage via `savedViewsStore` |
| Presets | At least `My View` (empty / default filters) |
| Save | Captures **current filter snapshot** (not column order yet — column layout is session UI) |

---

## 5. Columns (show / reorder)

`DataGrid` **Columns** menu must support:

1. Toggle visibility (checkbox)
2. **Drag-and-drop** reorder (grip handle) — not up/down arrows

Pin row-actions columns with `enableHiding: false` so they stay at the end.

---

## 6. Unsaved changes (editors)

In-app navigation away from dirty editors uses:

```ts
appConfirm({
  title: 'Unsaved changes',
  description: 'You have unsaved changes. Leave this page and discard them?',
  confirmLabel: 'Leave page',
  cancelLabel: 'Keep editing',
  tone: 'danger',
})
```

via `useUnsavedChangesGuard` → **`ConfirmDialog`**. Never `window.confirm`.

Tab/window close may still show the browser beforeunload dialog — that is a browser limitation.

---

## 7. Migration checklist (other Purchase lists)

Bring each list to this standard when touched:

| List | Current gap (typical) | Target |
|------|----------------------|--------|
| Purchase Orders | **Reference** | Keep as gold path |
| Purchase Requisitions | Close — align Purpose width / Columns | Match PO |
| Approvals | No save-view | Add when presets exist; keep drawer |
| Invoices | Has drawer + save-view | Align filter sections + Columns |
| RFQs / VQ / Comparison / GRN / Returns | **Aligned** to embedded register bar + drawer | Keep parity with PO; add saved views when presets exist |
| QC / Masters / Reports | Partial | Prefer embedded register bar when touched |

---

## 8. Agent checklist

Before merging a Purchase list change:

- [ ] `CrmListFilterBar` embedded in grid (`registerBar`)
- [ ] `CrmFilterDrawer` with sectioned fields
- [ ] Saved view + Save view (unless explicitly queue-only)
- [ ] Columns show/hide + reorder available
- [ ] Row actions: always show **View / Edit / Delete** icons; disable unavailable ones with a clear `disabledReason` tooltip (e.g. “Completed purchase orders cannot be deleted”); other actions in ⋯ menu
- [ ] No `window.*` dialogs
- [ ] Purpose guide width matches table column; on view pages **Back is always above Purpose**
- [ ] Demo mode still works

---

## Related code

| Piece | Path |
|-------|------|
| Reference list | `frontend/src/modules/purchase/PurchaseOrderListPage.tsx` |
| PO table | `frontend/src/components/purchase/PurchaseOrdersTable.tsx` |
| Filter fields | `frontend/src/config/poFilterConfig.ts` |
| Filter bar | `frontend/src/components/crm/CrmListFilterBar.tsx` |
| Filter drawer | `frontend/src/components/crm/CrmFilterDrawer.tsx` |
| Grid / columns | `frontend/src/components/design-system/DataGrid.tsx` |
| Saved views | `frontend/src/hooks/useSavedViews.ts` |
| Unsaved guard | `frontend/src/hooks/useUnsavedChangesGuard.ts` |
| Confirm UI | `frontend/src/components/ui/ConfirmDialog.tsx` |
