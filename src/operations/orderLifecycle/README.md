# Order Review Workspace

Axis presents the authorized Order dispute queue at the backend-declared
`order-disputes` navigation entry. Order owns eligibility, retained approval and
recovery; Profile owns current reviewer permission and scope; Fulfillment owns
dispatch, receipt and inspection; Payment owns original-capture settlement.
Catalogue screens must never acquire these commands.

Normal Axis admission additionally requires explicit BackOffice bootstrap and
Axis presentation permissions. The API-only `COMMERCE_REFUND_REVIEWER` role does
not provide those rights. Browser acceptance must use separately approved least-
privilege presentation access, never attach a broad Viewer or administrator group
to bypass denial. Approved Axis reviewers select the separate
`profile:commerceAxisRefundReviewerRole` pack and
`COMMERCE_AXIS_REFUND_REVIEWER` invitation role through normal Profile onboarding.

`OrderReviewPanel` offers refund previews for submitted or reconciling
`CANCELLATION`, `RETURN` and `REFUND` cases. A manual resolution records an outcome
only. `OrderRefundReview` requires a fresh owner preview and an explicit approval.
Commands use the existing discovered owner client and idempotency header. No
request retries automatically. After an uncertain response, explicitly refresh
the plan before resuming. Recovery keeps the owner's original `approvalCommandKey`
and read-only approval reason, including when another client started the command.
Missing or malformed recovery references disable execution; another case cannot
borrow the approval. A failed queue refresh after confirmed completion must not
reopen approval or replay the completed write.

Customize a project-owned review presentation by composing these components with
the existing `OperationalOwnerConfiguration`, preserving backend-discovered
connections, current authentication, original replay references and explicit
confirmation. Labels and richer presentation should come from the owning CMS or
backend workspace contract, not a parallel browser policy or API registry.

Run `npm test -- test/orderLifecycle/OrderReviewPanel.test.tsx
test/orderLifecycle/OrderRefundReview.test.tsx
test/orderLifecycle/OrderLifecycleManagementRoutePage.test.tsx` and `npm run typecheck`.
Coverage distinguishes explicit approval, immutable recovery, unauthorized and
malformed responses, unavailable owners and post-write refresh failure. Native
browser acceptance is separate from mocked component tests. Synthetic logistics
and offline sandbox refunds do not qualify real goods, carriers or money movement.
