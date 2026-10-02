# Notification Consumers

The existing Communication management workspace remains Communication-owned.
`OrderNotificationRoutePage` is separately Digital Core-owned: Commerce supplies
financial source evidence and original-event retry eligibility, Communication
supplies delivery observations and frozen intent recovery, and Profile/Order
enforce current operator scope. Axis is not a notification registry or sender.

## Order Notification Task

App admits this consumer only from discovered Digital Core native workspace
`commerce.orderNotifications` / `orderNotifications.detail`, ACTIVE feature state
and UP/DEGRADED availability. Default-off qualification/exposure remains backend
policy. The operator explicitly enters one bounded order reference. Browser query
parameters never select owner, customer, recipient, template or intent.

GET `/orders/:code/notifications/workspace` supplies the v1 order/revision,
financial state, PURCHASED/REFUNDED observations and fixed command declarations.
The parser bounds redacted fields, rejects duplicate events/intents/commands and
validates the exact installed POST routes and input-field shapes. Arbitrary paths,
hosts, methods, handlers and executable metadata never receive credentials.
`enabled` and `eligibleKinds` come from the owner; browser code does not interpret
permission strings or reconstruct eligibility from financial status.

POST `/orders/:code/notifications/inspect` sends only the selected event kind.
The following fresh workspace read replaces availability/revision metadata.
POST `/orders/:code/notifications/retry` requires explicit review of the same
order, current order revision and event kind. Its body is exactly
`{kind, expectedRevision, confirmed:true}`. It contains no amount, address, sender,
template, financial success marker or intent selector.

Retry acknowledgement must be REQUESTED with bounded, unique original intent
references from the inspected event. This is request progress, never delivered
email/SMS or financial completion. Success and uncertainty both discard actionable
retry state; inspect before another command. No automatic writer replay occurs.
Failed inspection removes controls. In-flight guards prevent rapid duplicates;
session/bootstrap/enterprise changes discard old snapshots, reviews and late reads.

## Customization And Publication

Configure business labels, event declarations, verified recipient resolver and
qualification in later Digital Core layers. The renderer consumes bounded command
field labels and never chooses templates, channels, addresses or providers.
Generic browser lookup, cancellation and transport-failure fallbacks stay frontend
owned; new domain copy requires the matched owner DTO. Extend the installed typed
renderer rather than supplying executable CMS behavior.

Native navigation metadata must match the existing BackOffice/Axis native-workspace
contract: version, renderer, workspace/view keys, title and optional description
only. Transport command declarations belong in the detail workspace/lifecycle
contract, not extra native navigation keys. A declaration that fails discovery
validation does not become usable merely because this renderer exists.

## Verification

`test/enterprise/orderNotificationUi.test.tsx` is authored, NOT RUN. It covers
explicit original retry/current revision, uncertainty without repeat and rejection
of alternate transport metadata. Joint acceptance still covers qualification,
denied/stale scope, source-versus-delivery distinction, missing intents, empty
events, timeouts, conflicts, disabled kinds, keyboard/dialog focus, narrow layouts
and original frozen-intent recovery. Static typecheck/lint/formatting cannot prove
mail delivery or runtime publication. No backend activation, sending or release
operation is performed by these source changes.
