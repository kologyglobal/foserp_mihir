# Bank Statement Column Mapping

## Canonical fields

`TRANSACTION_DATE`, `VALUE_DATE`, `DEBIT_AMOUNT`, `CREDIT_AMOUNT`, `SIGNED_AMOUNT`, `AMOUNT`, `DIRECTION` / `DR_CR_INDICATOR`, `RUNNING_BALANCE`, `DESCRIPTION`, `BANK_REFERENCE`, `UTR_REFERENCE`, `CHEQUE_NUMBER`, `TRANSACTION_CODE`, `EXTERNAL_LINE_ID`, `EXTERNAL_TRANSACTION_ID`, `COUNTERPARTY_*`, `CURRENCY`, `IGNORE`.

## Amount modes

1. **DEBIT_CREDIT_COLUMNS** — separate debit/credit; exactly one positive side  
2. **SIGNED_AMOUNT** — sign convention configurable (`positiveMeans` CREDIT/DEBIT)  
3. **AMOUNT_WITH_DIRECTION** — absolute amount + DR/CR aliases  

Direction aliases live in mapping config (not global bank hardcodes).

## Templates

Model: `BankStatementColumnMappingTemplate`  
Scope: treasury account → bank name key → legal-entity default. Ambiguous equal-priority defaults return a warning.

APIs: CRUD + activate/deactivate under `/bank-statement-mapping-templates`.
