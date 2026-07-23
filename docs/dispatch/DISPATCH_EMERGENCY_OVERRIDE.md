# Dispatch Emergency Override (Phase 7C5)

## Lifecycle

```text
Blocked Post
→ Emergency Override drawer
→ Grant (dispatch.override) + audit row
→ Softened operational gates
→ Post FG_DISPATCH
→ Override CONSUMED
```

## API

`POST /dispatch/outbound/:id/post`

```json
{
  "emergency": true,
  "idempotencyKey": "optional",
  "emergencyOverride": {
    "businessReason": "Customer plant shutdown risk",
    "urgency": "CRITICAL",
    "riskAcknowledged": true,
    "approvedByName": "Operations Head",
    "approvalReference": "APR-0045",
    "expiresAt": "2026-07-24T04:00:00.000Z",
    "scope": "Operational document gates only…",
    "remarks": "Temporary ship approval"
  }
}
```

Legacy shorthand still accepted: `{ "emergency": true, "overrideReason": "…" }` (min 8 chars).

## Rules

- Requires `dispatch.override` (or `tenant.manage`).
- Pilot defaults: `allowDirectEmergencyDispatch=false`, `requireSupervisorApprovalForOverride=true` → override permission **is** the supervisor approval.
- Softens gates: reservation / pick / pack / issued challan / QC **not** required.
- **Preserves** serial/lot allocation gates from the active policy.
- **Never** overrides catalogued hard blockers (`INSUFFICIENT_STOCK`, `NOT_DRAFT`, over-qty, cancelled SO, etc.).
- Posting ledger: `mode=emergency`; `emergency_overrides` register GRANTED→CONSUMED.
- Does **not** rewrite posted transactions — audit + retry only.

## Readiness

`GET …/posting-readiness` includes:

```json
"emergencyOverride": {
  "canRequest": true,
  "requiresPermission": "dispatch.override",
  "overridableBlockers": [],
  "neverOverridableBlockers": [],
  "unknownBlockers": [],
  "message": "…"
}
```

## FE

`EmergencyOverrideDrawer` on `ApiOutboundDispatchDetailPage` when Post is blocked.

## Related

- Shared catalog: `docs/EMERGENCY_OVERRIDE.md`
- Policy defaults: `DISPATCH_POLICY_SETTINGS.md`
