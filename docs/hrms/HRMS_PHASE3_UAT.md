# HRMS Phase 3 — UAT

## Preconditions

- Migrations through `20260730250000_hrms_phase3_leave`
- `db:sync-permissions`
- Employee + manager linked Users; default shift with weekly off; CL balance opening 10

## Cases

| ID | Scenario | Expect |
|----|----------|--------|
| A | Apply 1 day CL, submit, approve | pending→used; available 9 |
| B | Reject submitted | pending restored |
| C | Half day preview | 0.5 |
| D | Range spanning holiday | holiday excluded |
| E | Fri–Mon with Sunday WO | 3 days |
| F | Insufficient balance | submit blocked |
| G | Overlapping submit | 409 |
| H | Cancel approved | used restored |
| I | Cross-branch approve | 403 when scoped |

## Sign-off

☐ A ☐ B ☐ C ☐ D ☐ E ☐ F ☐ G ☐ H ☐ I
