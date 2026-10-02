# Merchant Fulfillment Consumer

Digital Core owns merchant eligibility, receipt persistence and entitlement
completion; Promotion owns coupon single-use consumption and merchant conditions.
Profile owns employee scope. Axis renders the discovered Digital Core workspace
and never substitutes an enterprise, outlet, coupon provider or fulfillment rule.

`MerchantRedemptionPanel` reads the existing `/merchant/redemptions/workspace`,
uses owner-listed outlet choices, validates a customer-presented code through
`/merchant/redemptions/validate`, and confirms one reviewed entitlement through
`/merchant/redemptions/:entitlementCode/confirm`. Queue inspection uses the
existing `/merchant/redemptions` endpoint. No new endpoint is introduced here.

## Native Priced Cart

Workspace `pricedSourceRequired` must be an explicit boolean. When true, Axis
uses `pricedSourceLabel` for an existing `CART:<cart-code>` reference input before
coupon validation. Missing metadata never defaults to unrestricted validation.
Validation sends only coupon token, selected owner-listed store and
`merchantReceiptReference`. No cart creation/listing route exists in this protocol;
the operator supplies the existing native cart reference, not a price or customer
identity. Pricing resolves buyer, cart entries, published pricing and exact money.

The validation's `conditions.benefit` must match PRICED_CART source stage,
requested reference and selected store/revision. Axis projects bounded exact
decimal strings, currency, hash and source revision, without computing totals,
discounts or settlement. The reviewed reference is populated read-only through
confirmation. Confirmation sends the same reference/store, numeric entitlement
revision, validation proof and explicit confirmation. Stable command identity
travels in `Idempotency-Key`; original recovery uses the saved confirmation key.
The validated/confirmed native monetary flow is not external POS settlement.

Pricing currently accepts `@` in native cart codes, but merchant confirmation's
receipt pattern does not. Axis uses their accepted intersection instead of sending
an unconfirmable source. Harmonizing those owner patterns remains a backend gap.
Missing/inconsistent priced evidence blocks the dialog and never creates a price
fallback. Source/outlet changes invalidate the selected proof; unknown writes
require queue inspection and original-reference recovery, never automatic replay.

Initial validation need not have a redemption reference: that reference is owner
evidence created later. Queue/validation DTOs are bounded, privately projected and
revision-checked before selection. Malformed or duplicate queue data fails closed.
Failed refresh clears selectable rows. Target/receipt inputs cannot change during
requests, and in-flight guards prevent rapid duplicate commands.

Both MERCHANT_SCREEN and LOCAL_SAMPLE confirmations require an explicit merchant
transaction/receipt reference because that is the existing owner command contract.
LOCAL_SAMPLE remains visibly identified and does not contact an external POS.
An unstarted queue row cannot replace fresh coupon validation. Owner-declared
recoveryRequired permits explicit resume for UNCLAIMED/CLAIMED rows with recorded
confirmation identity; the original receipt remains read-only during resume.
An expired/missing validation proof disables fresh confirmation.

Confirmation requires a matching REDEEMED entitlement projection and recorded
receipt, not a transport acknowledgement. Any uncertain result clears the dialog
and selectable queue; the operator inspects merchant requests before another
reviewed command. The backend must recover the original command/receipt and prevent
duplicate consumption. Axis does not invent success or replay automatically.

Use later owner layers for store/merchant policy and qualification. Extend frontend
presentation in this renderer without relaxing DTO validation, exact command inputs,
confirmation, context invalidation or recovery identity. Declarative owner copy may
be consumed only through a matched versioned contract; never execute CMS code.
Authoritative priced basket/benefit validation and external POS proof cannot be
added as editable browser assertions.

`test/enterprise/merchantRecoveryUi.test.tsx` is authored and NOT RUN. Joint
`test/enterprise/merchantPricedCartUi.test.tsx` adds pre-validation reference,
frozen monetary proof/command and mismatch fixtures, also NOT RUN.
acceptance still covers store revisions/scope loss, expired validation, local and
staff modes, lost acknowledgements, original-reference resume, customer readback,
keyboard/dialog focus and narrow layouts. Static typechecking is not live acceptance.
