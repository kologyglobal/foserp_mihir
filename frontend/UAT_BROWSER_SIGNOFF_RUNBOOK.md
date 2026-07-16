# Browser Sign-off Runbook

**Session start:** 2026-07-11  
**URL:** http://localhost:5173/login  
**Tenant:** `vasant-trailers`  
**Login:** `admin@vasant-trailers.com` / `Admin@123`  
**Mode:** API (`VITE_USE_API=true`)

Mark each step **PASS / FAIL / SKIP** and note any bugs inline.

---

## Phase A — Auth & entry (5 min)

| # | Action | Expected | ✓ |
|---|--------|----------|---|
| A1 | Open `/login` | Split layout; demo credentials button visible | |
| A2 | Click demo credentials → Sign in | Lands on `/crm` dashboard, no errors | |
| A3 | Press **F5** | Still logged in, dashboard reloads | |
| A4 | Sign out (user menu) | Returns to `/login` | |
| A5 | Navigate to `/crm` while logged out | Redirects to `/login` | |
| A6 | Sign in again | Dashboard loads | |

---

## Phase B — Critical path: Lead → Opp → Quote → SO (25 min)

Use a unique prospect name: **`UAT Browser {today's time}`**

| # | Action | Expected | ✓ |
|---|--------|----------|---|
| B1 | `/crm/leads/new` → fill Prospect + Owner → Save | New lead number (e.g. LEAD-…); lands on 360 or list | |
| B2 | Clear Prospect → Save | Inline validation error; no save | |
| B3 | Edit lead → advance stage to **Qualified** | Stage chip updates on form + list | |
| B4 | Lead 360 → **Convert to Opportunity** | Opens opp form with lead prefill | |
| B5 | Save opportunity | One opportunity created; lead shows converted | |
| B6 | Try Convert again on same lead | Blocked with clear message | |
| B7 | Opportunity 360 → **Create Quotation** | Quotation editor opens, linked to opp | |
| B8 | Add line item, check tax/discount/total | Totals recalculate correctly | |
| B9 | Save as draft | Status draft; no Convert to SO yet | |
| B10 | Submit / approve quotation (as admin) | Approved status; **Latest** badge if revised | |
| B11 | **Create Sales Order** from approved quote | SO create form prefilled (customer, lines) | |
| B12 | Save SO | Unique `SO-…` number; SO 360 loads | |
| B13 | Return to quotation 360 | Status **Converted**; link to SO | |
| B14 | Try second SO conversion | Blocked with message | |
| B15 | **F5** on SO 360 and quotation 360 | Data + linkage persist | |

---

## Phase C — Activities & navigation (15 min)

| # | Action | Expected | ✓ |
|---|--------|----------|---|
| C1 | Lead 360 → Log **Call** | Appears in timeline/activities | |
| C2 | Opportunity → add **Follow-up** (meeting) | Shows on pipeline follow-ups or 360 | |
| C3 | Complete follow-up | Status completed; timeline entry | |
| C4 | Sidebar: click Leads, Opportunities, Quotations | Each lands on correct list | |
| C5 | Dashboard KPI → click through to list | Correct destination | |
| C6 | Lead 360 → Customer link | Opens `/entity360/customers/:id` (not `/crm/customers`) | |
| C7 | Browser **Back** from 360 to list | Returns to list (filters optional) | |
| C8 | Open `/crm/leads/{id}` in **new tab** | Deep link loads without redirect | |
| C9 | `/crm/unknown-path` | Redirects to `/crm` | |

---

## Phase D — Edge cases (10 min)

| # | Action | Expected | ✓ |
|---|--------|----------|---|
| D1 | New lead → invalid email `not-an-email` | Browser/API rejects | |
| D2 | Opp line qty **0** or **-1** | Row validation error | |
| D3 | Double-click **Save** on new lead quickly | Only one record created | |
| D4 | Search leads for `zzz-nonexistent-999` | Empty state message, no crash | |
| D5 | (Optional) Stop backend → Save in API mode | Toast/error, not silent | |

---

## Phase E — Role check (optional, demo role switch)

| # | Action | Expected | ✓ |
|---|--------|----------|---|
| E1 | Switch role to **Shop Floor** → `/crm` | Access Denied page | |
| E2 | Switch to **Sales Manager** → `/crm` | Dashboard loads | |

---

## Sign-off summary

| Phase | Pass | Fail | Notes |
|-------|------|------|-------|
| A Auth | | | |
| B Critical path | | | |
| C Activities & nav | | | |
| D Edge cases | | | |
| E Roles | | | |

**Overall:** ☐ PASS  ☐ PASS WITH ISSUES  ☐ FAIL  

**Blockers (if any):**

1. 
2. 

**Signed:** _________________ **Date:** _________________
