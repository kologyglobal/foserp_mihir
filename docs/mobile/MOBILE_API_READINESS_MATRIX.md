# Mobile API Readiness Matrix

> Phase M0 companion. Verified against code (not web-page presence alone).  
> Date: **2026-08-03**

**Legend**

| Column | Values |
|--------|--------|
| **API Ready** | `Yes` / `Partial` / `No` |
| **Permission Ready** | `Yes` / `Partial` / `N/A` |
| **Mobile Risk** | `Low` / `Med` / `High` |
| **Gap** | Short description of what blocks production mobile for that feature |

---

## Matrix

| Feature | API Ready | Permission Ready | Mobile Risk | Gap |
|---------|-----------|------------------|-------------|-----|
| **CRM follow-ups** | Yes | Yes (`crm.follow_up.*`) | Med | Backend CRUD + lifecycle solid. Web `/m/crm/follow-ups` mostly store-driven; Expo must call REST directly (list/create/complete). Notes/attachments are separate entity APIs. |
| **Approval inbox** | Partial | Yes (per domain) | Med | **No unified inbox.** API mode web mobile: **purchase** queue + **gate** pending. Finance: `…/accounting/approvals` + document actions. CRM/MFG approvals are siloed. Gap: aggregate “my pending” or multi-source client aggregation. |
| **Notifications** | No | N/A | High | No Prisma model, list, unread count, mark-read, deep-link, or push registration. Purchase setup notifications tab is ON_HOLD placeholder. |
| **Manufacturing My Work** | Yes | Yes (`manufacturing.operator.my_work` + kiosk any-of) | Low–Med | Routes under manufacturing my-work / kiosk. Web shell already maps. Needs native offline policy later only. |
| **Daily Production update** | Yes | Yes (`manufacturing.daily_production.*`) | Med | Backend ready; dedicated polished mobile form thin/demo. Idempotency/conflict TBD per action payload. |
| **QC queue** | Yes | Yes (`quality.view` / submit / `manufacturing.quality.inspect`) | Low–Med | Kiosk queue + decide APIs exist. **No QC photo upload API** even when plan/photo flags elevate remarks. |
| **Maintenance breakdown** | Yes | Yes (`maintenance.*` + `requireModule('maintenance')`) | Med | Ticket lifecycle + multipart photos. **No first-class `/m/maintenance` web route**; desktop V1 is API-backed. Close-readiness gates exist on BE. |
| **Store issue / return** | Yes | Yes (`manufacturing.materials.issue` / `.return`) | Low–Med | Issue **requires** body `idempotencyKey`. Web mobile pages generate keys in API mode. Returns optional key — safer if always sent. |
| **Dispatch pick** | Yes | Yes (`dispatch.pick_list.*`) | Med | Phase 7C2 pick lifecycle APIs. POD is separate (base64). Multi-step pick/pack/post needs careful state machine on device. |
| **Attendance** | No | N/A | High | **No HR attendance module.** Gate visitors explicitly do **not** create attendance. |
| **Leave** | No | N/A | High | No leave request / approve APIs. |
| **Overtime** | No | N/A | High | No OT request / approval APIs (accounting narrative only). |
| **Payslips** | No | N/A | High | No payroll engine or secure payslip download. Sensitive data policies not productized for employees. |
| **Employee profile** | Partial | Yes (auth session) | Med | `GET/PATCH /auth/me`: name, email, mobile, designation, department, roles, permissions, tenant. **Not** employee master, statutory docs, bank details, or org HR hierarchy. |

---

## Supporting capabilities (cross-cutting)

| Capability | API Ready | Permission Ready | Mobile Risk | Gap |
|------------|-----------|------------------|-------------|-----|
| Login / refresh / logout | Yes | N/A | Low | Web uses localStorage; mobile needs SecureStore. Soft: refresh skips ACTIVE re-check. |
| Current user + permissions | Yes | Yes | Low | Re-fetch `/auth/me` after login and on resume. Role changes apply on next API call (server re-resolves). |
| Module flags | Yes | Yes (list open to authed user) | Med | Fail-open if no flag row. Hard-enforced only on purchase / manufacturing / maintenance. Nav must hide; server may still allow some modules. |
| Tenant path `/t/:slug` | Yes | Middleware enforces JWT match | Low | Safe for mobile. Prefer slug paths like web. |
| CRM attachments | Yes | Entity/attachment perms | Med | Base64 JSON upload; no signed URL. Large camera files painful. |
| Maintenance photos | Yes | `maintenance.*` | Low–Med | Multipart — preferred camera path. |
| Dispatch POD | Yes | Dispatch POD perms | Med | Base64; filesystem tenant scope. |
| QC photos | No | N/A | High (for camera QC) | Only remarks elevation; no binary store. |
| Idempotency support | Partial | N/A | Med | Not global. Finance headers + many posting body keys. Document per endpoint in M2 feature work. |
| LE / branch scope | Partial | Scope admin APIs | Med | Not in login payload; CRM list scope opt-in; incomplete global enforcement. |

---

## Highest-value existing API bases (slug style)

Use after login with Bearer token:

| Capability | Path pattern |
|------------|--------------|
| Auth | `/api/v1/auth/*` |
| Modules | `/api/v1/t/:tenantSlug/modules` |
| Follow-ups | `/api/v1/t/:tenantSlug/crm/follow-ups` |
| Purchase approvals | `/api/v1/t/:tenantSlug/purchase/approvals` |
| Accounting approvals | `/api/v1/t/:tenantSlug/accounting/approvals` |
| MFG My Work | `/api/v1/t/:tenantSlug/manufacturing/…` (my-work / kiosk) |
| Daily production | `/api/v1/t/:tenantSlug/manufacturing/daily-production…` |
| QC kiosk queue | `/api/v1/t/:tenantSlug/quality/kiosk/…` |
| Maintenance tickets | `/api/v1/t/:tenantSlug/maintenance/tickets…` |
| Material issue/return | `/api/v1/t/:tenantSlug/manufacturing/work-orders/:id/materials/issue|return` |
| Dispatch pick | `/api/v1/t/:tenantSlug/dispatch/…` (phase 7C2 + POD) |
| Gate | `/api/v1/t/:tenantSlug/gate/…` |

UUID twin: `/api/v1/tenants/:tenantId/…` (same routers).

---

## Suggested mobile delivery order (post-M1)

1. **M1** — foundation (auth, secure storage, me, permissions, shell nav)  
2. **M2-ops** — My Work → issue/return → QC queue → maintenance report + photo  
3. **M2-crm** — follow-ups (API-native)  
4. **M2-approvals** — multipage / multi-source pending (until unified API)  
5. **M3** — notifications in-app (+ push design)  
6. **M4+** — HR stack (attendance/leave/OT/payslips) only after backend exists  

---

## Explicit non-readiness (do not build mobile UX pretending APIs exist)

- Attendance punch / biometric attendance
- Leave apply/approve
- Overtime claim
- Employee self-service payslip
- Push notification centre
- True offline posting with sync engine
