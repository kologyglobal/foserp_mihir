# Route Master — test results

Date: 2026-07-22

## Automated

```
npx vitest run tests/route-master-bc.test.ts --hookTimeout=180000
```

| Case | Result |
|------|--------|
| Auto RT-###### code + SERIAL draft + lifecycle UNDER_DEVELOPMENT | PASS |
| Validate fails when Work Centre missing | PASS |
| Certify → ACTIVE / CERTIFIED | PASS |
| Revise with revision reason → new DRAFT | PASS |

**4/4 PASS**

## Manual checklist (UAT)

See acceptance criteria in the Route Master redesign brief — verify on `/manufacturing/setup/routings`:

- [ ] New Route assigns code automatically
- [ ] Flat operation lines; WC required; Machine optional & filtered
- [ ] Certify locks version; Create New Version requires reason
- [ ] WO release still uses ACTIVE snapshot only
