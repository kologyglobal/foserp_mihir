# UI View / Detail Page Standard

Canonical chrome for **read-only document / register detail** screens (PR, RFQ, PO, GRN, CRM 360, etc.).
When docs and code disagree, **code wins** — then update this file.

**Purchase module look & feel:** [`PURCHASE_UI_CONSISTENCY.md`](PURCHASE_UI_CONSISTENCY.md)  
**List registers:** [`PURCHASE_LIST_PAGE_STANDARD.md`](PURCHASE_LIST_PAGE_STANDARD.md)

Reference view: **`/purchase/orders/:id`** (`PurchaseOrderDetailPage`).

---

## 1. Required chrome (every view page)

| Element | Rule |
|---------|------|
| **Breadcrumbs** | `Module › Register › DocumentNo` with links back to hub + list |
| **In-page Back** | `PageBackLink` via shell `backLink={{ to, label }}` — see §2 |
| **Title** | Document number (or entity name) in sticky record header |
| **Status** | Badge / chip in **header** (not a second “Current status” block in the body) |
| **Command bar** | Primary = next lifecycle action (Approve / Release / …); secondary = Edit / Print / related — **no Back** |
| **Lifecycle strip** | Compact stepper only; Purpose / Status / Next live in an **info (i) hover tip** |
| **Body** | Card sections — General first, then lines, then related |
| **Smart context** | Right FactBox when vendor / related / approval facts exist |
| **Footer** | View pages: `footer={null}` — **no sticky footer padding** (`stickyFooter` off when footer empty) |

---

## 2. Back button placement

**Rule: Back is always above the Purpose / `ErpPageGuide` block.** Never place Purpose above Back.

```text
Workspace / page chrome
  → PageBackLink          ← FIRST in content (e.g. “Back to Requisitions”)
  → ErpPageGuide / Purpose  ← immediately below Back when present
  → Title / record header / body
```

| Do | Don’t |
|----|--------|
| `backLink` on shell — in-page `PageBackLink` **above** Purpose | Purpose / guide above Back |
| Label = `Back to {Register}` (e.g. “Back to Purchase Orders”) | Generic “Back” with no target |
| Not in command bar or sticky footer | Rely on breadcrumbs alone |

---

## 3. Status / purpose / next action

Status already appears in the sticky header and in General fields. Do **not** duplicate a large “Current status / Next action” meta row.

```text
[ Draft → Pending Approval → … → Closed ]     (i)
```

Hover / focus **(i)** shows:

- **Purpose** — short register purpose (same copy as list page guide)
- **Status** — current domain label
- **Next** — recommended next action

Primary next action remains the **command-bar primary button** (Approve, Release, …).

---

## 4. Footer / empty space

`ErpCardFormPage` reserves `pb-28` when `stickyFooter` is true (room for a sticky action bar).

- **View pages:** pass `footer={null}` — shell must **not** enable sticky footer padding when footer is empty (`PurchaseCardFormShell` already gates this).
- **Edit pages:** sticky footer with Save actions is OK.

If a view still shows a large blank band under content, check for leftover `stickyFooter` / `pb-28` before adding more layout chrome.

---

## 5. Command bar order (view mode)

```text
[Edit?]  [Print?]  [Related…]     ……     [Primary next action]
```

---

## 6. Shells to use

| Kind | Shell |
|------|--------|
| Purchase document view | `PurchaseCardFormShell` + `detailMode` + `recordHeaderFacts` |
| Lighter PR / list-detail | `OperationalPageShell` `variant="dynamics"` + `ErpCommandBar` |
| CRM 360 | Lead/Opp/Company 360 workspace shells |

---

## 7. Agent checklist

- [ ] `backLink` present; not in command bar  
- [ ] No bulky Current status / Next action meta block  
- [ ] Info tip (or equivalent) for Purpose + Status + Next  
- [ ] No empty sticky footer / `pb-28` on view  
- [ ] Status visible in header  
- [ ] `appConfirm` / `appPromptNote` — no `window.*` dialogs  

---

## Related

- PO view: `frontend/src/modules/purchase/PurchaseOrderDetailPage.tsx`
- Workflow strip: `frontend/src/components/purchase/PurchaseDocumentWorkflowStrip.tsx`
- Back link: `frontend/src/components/ui/PageBackLink.tsx`
- Routes: `frontend/src/routes/purchaseRoutes.tsx`
