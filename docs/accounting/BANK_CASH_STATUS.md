# Bank & Cash — Status

**Status:** Live API for **internal UAT / controlled pilot**; **AIS / FX / intercompany** still deferred.

**UAT / pilot surface (API mode):** `/accounting/bank-cash` liquidity hub + transfers, statements, reconciliation, cheques, adjustments, standing instructions, posting rules, connectors, bankbook/cashbook. Seed registers (`bank-accounts`, `transactions`, `deposits`, `cash-counts`, `setup`, …) are **not routed** — deep links redirect to the hub.

Phases **5A1–5A3**, **5B1–5B3**, **5C1**, **MT940/CAMT.053 file ingest**, **5D1–5D3 bank connectors** (sandbox/REST/live SFTP + Open Banking consent scaffold) complete.

Core (API mode): bank-originated controls, statement import (CSV/XLSX/**MT940/CAMT.053**), reconciliation, transfers, cheques, treasury adjustments, liquidity / cash position, connectors (sandbox FS + allow-listed REST + **live SFTP** → `BANK_API`). Open Banking = **consent only**. Use `VITE_USE_API=true`; demo seed is not the SoT.

## Phase 5A1–5B3 — Shipped ✅

| Phase | Detail |
|-------|--------|
| **5A1–5A3** | Treasury accounts, statement import/validation, reconciliation |
| **5B1** | Internal treasury transfers |
| **5B2** | Cheque management |
| **5B3** | Treasury adjustments, posting rules, standing instructions, bankbook/cashbook; flag `useTreasuryAdjustmentsForStatementItems`; FE Features settings + recon gate |

**5B3 tests:** backend **75/75** live; FE `test:treasury-adjustments` **40/40**. Docs: `TREASURY_ADJUSTMENT_ARCHITECTURE.md`, `STANDING_INSTRUCTIONS.md`, `BANKBOOK_CASHBOOK.md`.

## Phase 5C1 — Shipped ✅ (2026-07-20)

| Area | Detail |
|------|--------|
| **Schema** | `TreasuryDayClose` + `TreasuryDayCloseStatus` |
| **Migration** | `20260720270000_finance_phase5c1_treasury_liquidity` |
| **APIs** | `/accounting/treasury/liquidity/*` — cash-position, daily, forecast, closing controls, dashboard, day-closes |
| **FE** | API overview/liquidity dashboard with view/manage gates + reopen; demo overview retained for `VITE_USE_API=false` |
| **Tests** | `finance-treasury-liquidity.test.ts` (**7/7** live); FE `test:treasury-liquidity` |

Docs: [`TREASURY_LIQUIDITY_ARCHITECTURE.md`](TREASURY_LIQUIDITY_ARCHITECTURE.md)

## MT940 + CAMT.053 file ingest — Shipped ✅ (2026-07-20)

| Area | Detail |
|------|--------|
| **Parsers** | `bank-statement-mt940-parser.service.ts`, `bank-statement-camt053-parser.service.ts` → `NormalisedStatementLine` |
| **Pipeline** | Same 5A2 inspect → preview → import → validate → recon; **no column mapping** for structured formats |
| **Formats** | `.sta` / `.mt940` / `.txt` (MT940), `.xml` (CAMT.053), `AUTO_DETECT` |
| **Security** | Size limits; CAMT XXE/entity-expansion guards |
| **FE** | Format picker + accept extensions on Import page |
| **Tests** | `finance-bank-statement-mt940-camt.test.ts`; fixtures under `backend/tests/fixtures/bank-statements/` |
| **Migration** | None (enums already present) |

Docs: [`BANK_STATEMENT_IMPORT_ARCHITECTURE.md`](BANK_STATEMENT_IMPORT_ARCHITECTURE.md)

## Phase 5D1 — Bank connector scaffold — Shipped ✅ (2026-07-21)

| Area | Detail |
|------|--------|
| **Schema** | `BankConnector` + provider/status/probe enums |
| **Migration** | `20260721010000_finance_phase5d1_bank_connectors` |
| **APIs** | `/accounting/treasury/bank-connectors` — CRUD, enable/disable, providers catalog, test-connection, sync |
| **Secrets** | Non-secret `configJson` only |

## Phase 5D2 — Sandbox / REST pull — Shipped ✅ (2026-07-21)

| Area | Detail |
|------|--------|
| **Adapters** | Sandbox filesystem (`mode=SANDBOX`); allow-listed `GENERIC_REST` |
| **Ingest** | Sync → MT940/CAMT parse → `BankStatement` `sourceType=BANK_API`; checksum idempotency |
| **Env** | `BANK_CONNECTOR_SANDBOX_ENABLED`, `BANK_CONNECTOR_SANDBOX_ROOTS`, `BANK_CONNECTOR_ALLOWED_HOSTS` |
| **FE** | Connectors workspace dual-mode; Test/Sync create statements when configured |
| **Tests** | `finance-bank-connector-live.test.ts` + scaffold; FE `npm run test:bank-connectors` |

Docs: [`BANK_CONNECTOR_ARCHITECTURE.md`](BANK_CONNECTOR_ARCHITECTURE.md)

## Explicitly deferred

| Item | Why deferred | Next phase name |
|------|--------------|-----------------|
| **AIS statement download / cron** | Open Banking consent scaffold only; pull returns 422 | **5D4 — AIS / cron** |
| **FX / cross-currency treasury** | No FX rate table posting | Treasury **FX Phase** |
| **Intercompany dual-LE transfers** | Needs dual-entity posting | Treasury **Intercompany Phase** |
| Payment files (pain.001) | Outbound initiation | Payment execution phase |
| CAMT.052 / .054 | Not end-of-day statement | Later |
| Hard cash day-lock of GL | Soft day-close only (5C1) | Closing hardening |

## Phase 5D3 — Live SFTP + consent — Shipped ✅ (2026-07-21)

| Area | Detail |
|------|--------|
| **Live SFTP** | `mode=LIVE` + allow-listed hosts; env credential refs; host key fingerprint |
| **Consent** | `BankConnectorConsent` + start/callback/revoke; encrypted tokens via `FIELD_ENCRYPTION_KEY` |
| **OPEN_BANKING pull** | Still 422 NOT_IMPLEMENTED for AIS statement download |
| **Env** | `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS` |
| **Tests** | Live SFTP mocked client + consent lifecycle |

## Next

Do not auto-start **5D4 AIS/cron**, **FX**, or **intercompany** without product approval. Prefer a separate finance phase decision.
