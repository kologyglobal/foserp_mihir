# Emergency Override (controlled ERP action)

## Rule

An emergency override is a **controlled, audited** bypass of **operational** blockers — never of integrity, tenancy, permissions, stock policy, or statutory hard rules.

```text
Blocked Action
→ Request Emergency Override (drawer)
→ Authorised Approval (dispatch.override / supervisor)
→ Time-bound Override Granted
→ Action Retried
→ Override Consumed (single-use)
→ Full Audit (emergency_overrides)
```

## Drawer fields

Document · blocked action · blocker code(s) · business reason · urgency · risk acknowledgement · approved by · approval reference · expiry · scope · remarks · (attachment key reserved)

## Hard rule — never overridable

Tenant isolation · permission failure · negative stock when prohibited · invalid serial/lot · posted-document duplication · closed accounting period · mandatory statutory document · cancelled sales order · quantity above remaining order · failed atomic inventory posting · data-integrity conflict

Catalog: `backend/src/modules/shared/emergency-override/emergency-override.catalog.ts`

## Dispatch (first module)

| Surface | Detail |
|---------|--------|
| UI | `EmergencyOverrideDrawer` on workbench outbound when Post is blocked |
| API | `POST /dispatch/outbound/:id/post` with `emergency: true` + `emergencyOverride{…}` |
| Permission | `dispatch.override` (or `tenant.manage`) |
| Softens | reserve / pick / pack / challan / QC document gates |
| Preserves | serial/lot policy, SO cancel, over-qty, stock policy, duplication |
| Audit | `emergency_overrides` row GRANTED → CONSUMED; posting `mode=emergency` |

Readiness exposes `emergencyOverride.canRequest` + classified blockers.

## Related

- `docs/dispatch/DISPATCH_EMERGENCY_OVERRIDE.md`
- Policy: `allowDirectEmergencyDispatch` / `requireSupervisorApprovalForOverride`
