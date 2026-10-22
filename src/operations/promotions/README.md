# Merchant Fulfillment Consumer

## Coupon Native Workspaces

`CouponOfferWorkspace` renders owner-authored presentation and exact inspected
records. It creates through the existing Promotion PUT draft command only after
review, permits name-only corrections, locks saved promises and uses unsaved
prefill without copying stock/history. Uncertain writes require original record
inspection. This bounded editor supports one ITEM line; multi-item prefill refuses
rather than silently dropping items. Canonical Product/Store/Pricing references are
explicit input fields, not frontend-owned catalogue choices.

`CouponAcquisitionReportPanel` renders and exports the same protected aggregate
response, preserving null cells and UTC coverage. No raw attribution endpoint,
customer identifiers or unapproved filters exist here. Both accept
`{bootstrap, accessToken, runtime, sessionGeneration?}` and retire stale session,
owner and filter responses. Copy, limits and modes come from Promotion's
`GET /promotions/coupon-offers/workspace`.

The shared Axis registry in `src/app/App.tsx` binds
`promotion.couponOffers` / `authoring` to `CouponOfferWorkspace`
(COMMERCE_STAGED/STAGED) and `promotion.couponAcquisition` / `reporting`
to `CouponAcquisitionReportPanel` (COMMERCE/ONLINE). Dispatch requires the exact
Promotion native workspace, declared role pair, admitted feature/availability
and matching owner connection. It passes the original authenticated token,
bootstrap, runtime and admission generation; a new admission remounts the renderer.
`test/app/couponWorkspaceNavigation.test.tsx` covers real App dispatch with
isolated authentication and renderer fixtures. This is source wiring, not proof
of installed metadata, grants, publication or live coupon acquisition completion.

`CouponQrInput` adds local image decoding to the existing merchant panel. Supported
browsers may capture a camera image; this is not a live video scanner or universal
browser decoder. It accepts one literal code, never follows URLs, and only fills
manual presentation. Existing validate/review/confirm remains mandatory. Changed
manual text, outlet, owner or session retires pending image work. Unsupported
browsers retain manual input. Unit/DOM tests do not prove live camera/provider or
desktop/mobile visual acceptance.

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
uses `pricedSourceLabel` for an existing owner benefit reference input before
coupon validation. Missing metadata never defaults to unrestricted validation.
Validation sends only coupon token, selected owner-listed store and
`merchantReceiptReference`. No cart creation/listing route exists in this protocol;
the operator supplies the existing native cart reference, not a price or customer
identity. Pricing resolves buyer, cart entries, published pricing and exact money.

Monetary validation's `conditions.benefit` must match PRICED_CART source stage,
`CART:<cart-code>` reference and selected store/revision. Axis projects bounded exact
decimal strings, currency, hash and source revision, without computing totals,
discounts or settlement. The reviewed reference is populated read-only through
confirmation. Confirmation sends the same reference/store, numeric entitlement
revision, validation proof and explicit confirmation. Stable command identity
travels in `Idempotency-Key`; original recovery uses the saved confirmation key.
The validated/confirmed native monetary flow is not external POS settlement.

The source input accepts the canonical bounded owner handle grammar (one to 119
letters, digits or `_.:@-`), including `@` in SIM handles. The monetary projection
separately requires the canonical `CART:` grammar. Confirmation accepts `@` in
the receipt reference too; the deployed owner receipt endpoints must support the
same grammar before native acceptance. A typed handle does not select evidence mode.
Missing/inconsistent priced evidence blocks the dialog and never creates a price
fallback. Source/outlet changes invalidate the selected proof; unknown writes
require queue inspection and original-reference recovery, never automatic replay.

Initial validation need not have a redemption reference: that reference is owner
evidence created later. Queue/validation DTOs are bounded, privately projected and
revision-checked before selection. Malformed or duplicate queue data fails closed.
Failed refresh clears selectable rows. Target/receipt inputs cannot change during
requests, and in-flight guards prevent rapid duplicate commands.

Authenticated bootstrap observation is not a new merchant authority by object
identity. Equal-authority refreshes preserve outlet/coupon/basket drafts, queue
rows, visible errors, reviewed evidence and pending outcomes. Each refresh still
reads the existing workspace owner; new commands wait for that read. An unchanged
authorized outlet/revision set and input requirements retain state, including when
only labels or ordering change. No full bootstrap or authorization result is cached.

App supplies the admission generation, so a new admission retires old replies even
when its token is reused. Token, tenant, enterprise, project or selected owner
identity/endpoint/role/availability and navigation-access changes retire drafts,
proofs and replies before paint. Fresh changed outlet revisions/choices or input
requirements, malformed workspace evidence or owner denial also retire them.
Permission/access-group decisions remain backend-owned: navigation withdrawal
unmounts the panel, fresh workspace denial/scope changes invalidate it, and every
queue/validation/confirmation request retains current owner authorization. The
client does not infer a grant or cache hidden server permission/group state.
Unmount and superseded workspace reads reject late replies. No command retries
automatically, including a refused validation or uncertain confirmation. Operators
inspect current requests and choose any subsequent command explicitly.

`test/enterprise/merchantBootstrapRefresh.test.tsx` protects equal-bootstrap,
deferred GET and refused-command preservation, changed-authority retirement and
fresh workspace scope/denial handling. Customize copy/outlet policy at the existing
owner; preserve these epoch and fresh-read boundaries in presentation extensions.

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

## ITEM Evidence and Simulation

The same owner validation protocol can return ITEM evidence instead of money.
Axis accepts only the bounded `FULFILLED_ITEMS` or `SIMULATED_ITEMS` stage, exact
requested source reference, source hash/revision and matching store/revision.
Both stages require `benefitType: ITEM` and one to twenty distinct SKU entries,
each with an integer quantity from one to one hundred and unit `EACH`. The dialog
renders those exact items rather than missing monetary fields or computed prices.
Delivered ITEM evidence requires a nonfuture `deliveredAt` from the owner.

Simulation additionally requires `simulated: true`, `verified: false`,
`sourceType: ITEM_SIMULATION` and a `SIM:<handle>` reference, with no delivery time.
The review explicitly says **ITEM simulation. Goods delivery is not
verified.** Its confirmation action records a simulation, not verified delivery.
Queue and confirmation summaries use the exact owner marker trio
`simulated: true`, `deliveryVerified: false`, `evidenceMode: SIMULATION`.
The complete historical `LOCAL_SIMULATION` trio remains readable; Axis preserves
the actual owner mode rather than converting one into the other. Partial,
mixed/malformed modes or contradictory markers fail closed. A simulated review cannot complete
successfully when its confirmation omits those markers. Receipt rows preserve
the warning even when their minimized summary does not include item details.

Neither an entered `SIM:` reference, LOCAL_SAMPLE mode, selected outlet, browser
state nor frontend environment enables simulation or establishes authorization.
Axis sends only the existing reviewed command fields, not evidence flags, item
quantities, scope grants or delivery assertions. Digital Core and its canonical
benefit owner select and enforce the evidence mode. This consumer does not enable
used-benefit reversals or alter any refund policy.

Copilot's governed coupon composer consumes the same exact optional triad through
its separate bounded queue/receipt projections. Its backend owner must forward
those markers; Axis never invents them. See [assistant guidance](../../assistant/README.md#secure-coupon-fulfillment).
This does not enable Copilot ITEM preparation or widen approval/execution.

Focused isolated fixtures are in `test/enterprise/merchantRecoveryUi.test.tsx`,
`test/enterprise/merchantPricedCartUi.test.tsx` and
`test/enterprise/merchantItemEvidenceUi.test.tsx`. They exercise frozen source
commands, monetary validation, actual ITEM rendering, explicit simulation labels,
malformed evidence, minimized queue receipts and uncertain confirmation without
automatic retry. These are source-level UI tests, not live delivery qualification.
Live acceptance still covers store revisions/scope loss, expired validation, local and
staff modes, lost acknowledgements, original-reference resume, customer readback,
keyboard/dialog focus and narrow layouts. Static typechecking is not live acceptance.
