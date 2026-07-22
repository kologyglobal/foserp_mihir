# Bank Statement Duplicate Rules

## Duplicate file

Same tenant + legal entity + treasury account + SHA-256 checksum + non-cancelled batch → default **BLOCK**.

## Duplicate statement

`statementUniquenessKey` = SHA-256 of tenant|LE|treasuryAccount|reference|periodStart|periodEnd.  
Policy from reconciliation profile: `BLOCK` | `WARN` | `ALLOW_WITH_REVIEW`.

## Exact duplicate line

`lineHash` = SHA-256 of treasuryAccount|date|direction|amount|reference|description|external ids (no statement id).  
Search across non-cancelled statements on the same account.

Actions: BLOCK / SKIP / IMPORT_WITH_REVIEW (explicit). Existing lines are never deleted.

## Possible duplicates

Same date/direction/amount + similar description/reference → **WARNING** only (not exact).
