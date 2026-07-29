# Valuation Method Change UI

Route: `/inventory/costing/method-change`

Wizard (not a silent settings toggle):

1. Show current method (`GET …/effective-method`)
2. Select new method + effective date + opening migration option
3. Reason + optional force
4. Confirm → `POST …/method-change`
5. Result + links to overview / recon / layers

Requires `inventory.setup.manage`.
