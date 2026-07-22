# Production — UX Architecture

> Phase 0. **No frontend code in this phase.** Reuse FOS components; keep supervisor/labour UX extremely simple.

Aligned with `docs/MANUFACTURING_SIMPLE.md` and proposed nav evolution below.

---

## 1. Navigation

### Primary (always visible)

| Nav | Path | Audience |
|-----|------|----------|
| Today | `/manufacturing/today` (new; Control Room can redirect or merge) | Supervisor / Manager |
| Production Orders | `/manufacturing/work-orders` | Manager / Supervisor |
| Shopfloor | `/manufacturing/shopfloor` | Supervisor |
| Daily Update | `/manufacturing/daily-update` (new simple entry; may deep-link WO) | Supervisor |

**Retain:** Control Room as manager attention board (`/manufacturing/control-room`).

### Secondary — More

Materials & WIP · Quality Queue · BOM & Routing · Work Centres · Machines · Subcontracting · Certificates · Reports · Settings

Canonical base remains **`/manufacturing/*`**. Legacy `/production/*` hubs stay as redirects.

---

## 2. Role-specific experiences

### Operator

- **My Work Today** — list of assigned ops only  
- Actions: Start · Pause · Report Problem · Complete  
- Outcomes: Good / Rework / Reject / Scrap (large buttons)  
- No BOM trees, costing, or settings  
- Mobile/tablet-first; icons + text; no colour-only meaning  
- Regional-language-ready labels (string keys)

### Supervisor

- Today · Shopfloor · Daily Update  
- Transfer WIP · Report Change · Material Shortage · QC Pending  
- Desktop/tablet layout; one primary action per panel

### Manager

- Production Orders · Planning visibility · BOM/Routing · Exceptions · Closure · Reports  
- Control Room attention cards

### Store / Quality / Purchase / Maintenance

- Deep links into their modules; Production shows **status chips** only (do not duplicate their UIs)

---

## 3. UX rules

1. One primary action per page  
2. Minimum required fields first; advanced collapsed  
3. Large touch targets (operator)  
4. Icons + text; no colour-only meaning  
5. No long operator forms; no technical abbreviations on labour screens  
6. Complexity inside the system — next required action only  
7. Reuse: `PageHeader`, list shells, drawers, `appConfirm` / `appPromptNote`, status chips, demo banners until API mode  

**Simple mode (default):** Stage-group completion; auto material consumption optional.  
**Detailed mode:** Per-operation times, explicit issue, runtime changes — Settings / Profile flag.

---

## 4. Text wireframes

### 4.1 Today

```text
┌─────────────────────────────────────────────┐
│ Today · Mon 20 Jul          [Shopfloor] [More]│
├─────────────────────────────────────────────┤
│ Attention                                    │
│  • 3 Material shortages          [Open]     │
│  • 2 QC pending                  [Open]     │
│  • 1 Delayed order               [Open]     │
├─────────────────────────────────────────────┤
│ Running now                                  │
│  WO-1042  Tank weld   Op 3/6   [Update]     │
│  WO-1045  Chassis     Op 2/5   [Update]     │
├─────────────────────────────────────────────┤
│ Primary: [ Daily Update ]                    │
└─────────────────────────────────────────────┘
```

### 4.2 Production Orders list

```text
┌─────────────────────────────────────────────┐
│ Production Orders          [+ Create]        │
│ Filters: Status · Item · Due · Source        │
├─────────────────────────────────────────────┤
│ WO No │ Item │ Qty │ Due │ Status │ Source  │
│ WO-.. │ ...  │ 1   │ ..  │ Run    │ SO-..   │
└─────────────────────────────────────────────┘
```

### 4.3 Create Production Order

```text
Source: (• Sales Order  ○ Manual  ○ Stock)
Sales Order: [SO-....▼]  Line: [▼]
Item: (auto)     Qty: [  ]   Due: [  ]
Warehouse: [▼]
[ Show advanced: BOM/Route override ]
        [ Cancel ]  [ Save Draft ]  [ Create & Ready ]
```

### 4.4 Production Order detail

```text
WO-1042 · Trailer FG · IN PROGRESS
Planned 1 · Good 0 · Due 25 Jul · SO-8891
Primary action: [ Complete Stage: Welding ]
[ Hold ] [ Materials ] [ QC ] [ More ▾ ]
Tabs: Overview | Stages | Materials | Quality | Timeline
```

### 4.5 Shopfloor Board

```text
Live | Machine/Line | Daily Summary
Columns: Ready | Running | QC | Hold | Done
Cards: WO · Item · Stage · Timer · [Open]
```

### 4.6 Daily Production Update

```text
Select WO: [▼]   Stage/Op: [▼]
Good [  ]  Rework [  ]  Reject [  ]  Scrap [  ]
Notes: [............]
        [ Submit Update ]
```

### 4.7 Operator My Work

```text
My Work Today
┌──────────────────────┐
│ Start Welding        │
│ WO-1042              │
│ [ START ]            │
└──────────────────────┘
After start:
[ PAUSE ] [ PROBLEM ] [ COMPLETE ]
Complete → Good / Rework / Reject / Scrap (4 large buttons)
```

### 4.8 Material Readiness drawer

```text
Materials — WO-1042
Item      Need  Avail  Status
Plate     12    10     SHORT  [ Create PR ]
Paint      4     4     OK
          [ Reserve All Available ]
```

### 4.9 WIP Transfer drawer

```text
From: Welding WIP
To:   Assembly / WO-1048
Qty:  [  ]   [ Transfer ]
```

### 4.10 Runtime Change drawer

```text
Change type: Qty | Material | Skip Op | Add Op
Reason: [ required ]
        [ Submit for Approval ]
```

---

## 5. Responsive

| Role | Breakpoint focus |
|------|------------------|
| Operator | 360–820px; bottom action bar |
| Supervisor | Tablet+; board + drawers |
| Manager | Desktop; tables + control room |

---

## 6. Reusable components

Manufacturing demo components under `frontend/src/components/manufacturing/` · list/filter patterns from purchase gold path · status chips · drawers · `ManufacturingDemoBanner` until API hydration · permission gates from `utils/permissions/manufacturing.ts`.

**API mode:** Replace in-memory services with bridges (new `manufacturingApiBridge`) — never mix demo seed with API data.
