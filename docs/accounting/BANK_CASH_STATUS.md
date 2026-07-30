# Bank & Cash — Status

**Status:** Live API for **internal UAT / controlled pilot**. **Phase 5D4 SIMULATED AIS + cron** shipped (2026-07-30). **Live bank TPP AIS**, **FX**, and **intercompany** remain deferred.

**UAT / pilot surface (API mode):** `/accounting/bank-cash` liquidity hub + transfers, statements, reconciliation, cheques, adjustments, standing instructions, posting rules, connectors, bankbook/cashbook. Seed registers (`bank-accounts`, `transactions`, `deposits`, `cash-counts`, `setup`, …) are **not routed** — deep links redirect to the hub.

Phases **5A1–5A3**, **5B1–5B3**, **5C1**, **MT940/CAMT.053 file ingest**, **5D1–5D3 bank connectors**, **5D4 SIMULATED AIS + scheduleCron** complete.

Core (API mode): bank-originated controls, statement import (CSV/XLSX/**MT940/CAMT.053**), reconciliation, transfers, cheques, treasury adjustments, liquidity / cash position, connectors (sandbox FS + allow-listed REST + **live SFTP** + **SIMULATED Open Banking AIS**) → `BANK_API`. Open Banking **live TPP AIS** still deferred. Use `VITE_USE_API=true`; demo seed is not the SoT.

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

## Phase 5D3 — Live SFTP + consent — Shipped ✅ (2026-07-21)

| Area | Detail |
|------|--------|
| **Live SFTP** | `mode=LIVE` + allow-listed hosts; env credential refs; host key fingerprint |
| **Consent** | `BankConnectorConsent` + start/callback/revoke; encrypted tokens via `FIELD_ENCRYPTION_KEY` |
| **Env** | `BANK_CONNECTOR_SFTP_ALLOWED_HOSTS` |
| **Tests** | Live SFTP mocked client + consent lifecycle |

## Phase 5D4 — SIMULATED AIS + cron — Shipped ✅ (2026-07-30)

| Area | Detail |
|------|--------|
| **SIMULATED AIS** | `OPEN_BANKING` + `mode=SIMULATED`/`SANDBOX` + `sandboxRoot` drop folder; requires **AUTHORIZED** consent; ingest → `BANK_API` (GST NIC `SIMULATED` precedent) |
| **Cron** | In-process scheduler reads `scheduleCron` (5-field); `BANK_CONNECTOR_CRON_ENABLED` (default ON outside prod) |
| **Env** | `BANK_CONNECTOR_AIS_PROVIDER=SIMULATED\|LIVE` (default SIMULATED); `BANK_CONNECTOR_CRON_ENABLED` |
| **Live TPP AIS** | `mode=LIVE` or `BANK_CONNECTOR_AIS_PROVIDER=LIVE` → still **422 NOT_IMPLEMENTED** |
| **Tests** | Live connector suite + cron matcher unit + scheduled tick live |

## Explicitly deferred

| Item | Why deferred | Next phase name |
|------|--------------|-----------------|
| **Live bank / TPP AIS download** | Needs real Open Banking TPP registration, bank-specific AIS APIs, production OAuth | Treasury **Live AIS** |
| **FX / cross-currency treasury** | Accounts carry `currencyCode` + `exchangeRate` on docs, but **no FX rate table**, no period-end revaluation journals, transfers require same currency | Treasury **FX Phase** |
| **Intercompany dual-LE transfers** | Transfers explicitly require same legal entity; dual-entity posting + IC clearing not designed | Treasury **Intercompany Phase** |
| Payment files (pain.001) | Outbound initiation | Payment execution phase |
| CAMT.052 / .054 | Not end-of-day statement | Later |
| Hard cash day-lock of GL | Soft day-close only (5C1) | Closing hardening |
| Cheque print | Layout/print service not in scope | Cheque print phase |

## Next

Do not auto-start **live TPP AIS**, **FX**, or **intercompany** without product approval. Prefer a separate finance phase decision.
