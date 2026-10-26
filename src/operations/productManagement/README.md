# Product Workbench

Axis renders the Product owner's typed Workbench descriptor. Product owns fields,
validation, native administrative authorization, target qualification, version
checks and persistence. Publication remains a separate governed operation.

`ProductWorkbenchRoutePage` adds the existing Profile participant lookup to the
Product root Workbench only after the native administrative capability succeeds.
The target is a business selection, not a session switch. The original bearer
and Enterprise header are unchanged. Capability labels come from Product.
Non-root schemas and ordinary own-Enterprise authoring retain their existing path.

`productAdministrativeClient` maps Workbench discovery and advertised Product
commands to the bounded administrative POST envelope. It checks tenant, target
and audit actor scope, rejects foreign routes, and never retries a failed command
or falls back to ordinary CRUD. Every selected target has separate query keys.
Changing target resets the editor; incidental bootstrap object refreshes do not.
Changing effective identity or owner routing resets the selection. A denied
administrative capability is visible and leaves the ordinary Workbench available.

Use the existing responsive Workbench forms, confirmation and error handling.
Owner selection and audit controls use the Workbench's local `ownerHeader` slot,
inside its viewport-height template. Do not place these above a full-height
Workbench: that double-counts the available height and clips the record scroller.
The template reserves the header's intrinsic height without shrinking it; the
remaining content uses `flex: 1` and `minHeight: 0`. Mobile retains natural flow.
An invalid mutation response may follow an applied write: inspect fresh owner
state before manually resubmitting. Do not infer success from submitted fields.
Graph creation is not exposed by this root editor: graph operation metadata alone
does not describe typed variant/localization forms. Pricing is independently
owned and must not be embedded as Product JSON or automatically published.

Customize presentation through Product's descriptor and labels or the existing
typed Workbench presentation extension. Never copy owner permission defaults,
schema definitions or target admission rules into Axis or a customer override.
The backend contract is Product's `defaultProductBusinessAuthoringService` and
`defaultProductAdministrativeAuthoringService`; no backend source is imported.

Focused checks: `test/productManagement`, `test/workbench`, and
`test/enterprise/couponAdministrativeReview.test.tsx` protect target isolation,
unchanged signed headers, refusal/no fallback, bootstrap refresh stability,
ordinary forms and the shared Profile lookup extraction. Run typecheck and ESLint
as well. Live target authoring requires the new Product routes to be deployed;
frontend tests do not establish live acceptance.
