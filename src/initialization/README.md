# Axis First-Run Recovery

## Explicit Sign-In Context

Both bundled and CMS-managed login expose an Enterprise code input, prefilled
from App's existing runtime sign-in context. There is no customer-specific
enterprise default in CMS properties. The input selects only the target of the
existing Profile password request; it grants no permissions and does not require
invitation/membership switching to be enabled. Profile remains responsible for
credentials and scope admission. Tenant and project endpoints are not editable.

The selected code is captured for one sign-in attempt, disabled while pending,
and retained in the form on denial. There is no automatic retry or fallback to
another enterprise. Only successful authentication plus authenticated bootstrap
admit a session, using the existing accepted-context retention mechanism; the
form never writes a routing hint. Post-login membership switching is unchanged.
CMS may customize `enterpriseLabel` as inert presentation copy; it cannot set
the enterprise default or permission policy. The generic fallback label is
`Enterprise code`. The field remains full-width in both narrow login layouts.
`test/app/employeeLoginRace.test.tsx` covers both forms, explicit scope, denial,
invalid input and single-flight/stale-response behavior. Runtime acceptance is
separate from these synthetic tests.

This bundled frontend renders the Platform-owned Axis baseline status until its
governed publication reaches Online. CMS owns content and publication, Process
owns reviewer decisions, and BackOffice owns initialization. Axis owns no imports,
release discovery, approval policy, grants or runtime lifecycle.

Bundled and CMS-managed employee login share the existing network-failure
classification in `src/app/recoveryState.ts`. Known browser fetch failures render
a generic service-unavailable message rather than raw transport text; safe owner
authentication denials remain unchanged. Error rerenders preserve entered fields
in memory only and never retry sign-in automatically. CMS still owns managed form
labels; this shared fallback owns only unavailable-service presentation. Focused
coverage lives in `test/initialization/BundledLoginPage.test.tsx` and
`test/cms/renderers/components/authentication/EmployeeLoginFormRenderer.test.tsx`.

Known browser abort/timeout messages also use the shared Axis presentation
default: `Sign-in took too long or was interrupted. Please try again.` This
applies to raw browser interruptions from sign-in transport. The dependent
authenticated bootstrap retains its existing friendly BackOffice-unavailable
owner message when that client has already classified the interruption.
Safe owner denials remain unchanged; arbitrary text containing "aborted" is not
reclassified. No timeout implies rejected credentials, admitted authority or a
safe automatic retry. Both forms retain input and require an explicit retry.
`test/app/signInRecoveryMessage.test.ts` and the deferred bootstrap cases in
`test/app/employeeLoginRace.test.tsx` protect this framework-owned fallback.

Employee cookies can be shared with another same-host application; browser ports
are not a cookie isolation boundary. Axis still sends its normal credentialed
logout request when the CSRF companion has disappeared. Only Profile can
acknowledge an already-absent browser session. A failed/uncertain response keeps
the workspace locked; neither client storage clearing nor a fabricated success
substitutes for the owner response. No per-application cookie override is added.

First-run initialization sends one explicit operation. If its response is lost,
App observes status once through GET; it never replays the write. Importing and
pending publication continue through read-only status polling. Transient status
read failures recover through bounded GET retries; permanent failures or exhausted
recovery require an explicit refresh. Unavailable status preserves the operation
evidence and blocks mutations. Invalid releases and existing pending/activating/
Online publications do not offer resubmission. Imported content offers Submit for
review; a genuinely failed, available state may offer Resume setup.

Before any baseline status is known, the bundled view uses neutral connecting or
checking-workspace presentation and hides first-run guidance. A transient restart
is not evidence that initialization or approval is needed. Known owner status
restores existing setup presentation/actions; polling and READY return remain
unchanged.

Review must match the current publication and workflow. Approval requires an
explicit confirmation; a missing actionable Process task does not replay
initialization. Confirmation is disabled while busy, status is unavailable, or
the publication is no longer pending. Online status refreshes the authenticated
bootstrap to continue into the managed shell without another user-driven refresh.

When a transient initialization read interrupts a requested business route, the
initializer retains only its bounded pathname in router state. Query parameters,
fragments, external paths, traversal and authentication/setup return loops are
excluded. READY returns to that path through the normal authenticated route and
discovered navigation checks, not directly to a leaf component or command.
Missing destination navigation still denies admission. This is navigation intent,
not a durable operation checkpoint or authority. The App regressions in
`test/app/initializationApprovalAdmission.test.tsx` cover automatic recovery,
denied documentation navigation and unsafe return intent; live acceptance remains
separate. No publication or sign-in command is automatically retried.

## Customize Safely

Frontend contributors may customize the existing React recovery layout or typed
client, keeping Platform's fixed initialization APIs and owner status. For example,
change the generic progress placement in `AxisInitializationWorkspace.tsx` while
retaining its readiness/availability guards. Business release details and review
content come from the owner response, never a browser registry or filesystem.
Backend contributors customize the owning Axis/CMS module through Nodics layering.

Run `vitest run test/initialization/AxisInitializationWorkspace.test.tsx
test/initialization/axisInitializationClient.test.ts test/app/AxisBootstrap.test.tsx`
and `npm run typecheck`. These isolated tests do not establish live publication,
browser acceptance, configured reviewer permissions or provider qualification.

## Restricted Employee Admission

Authenticated bootstrap may project backend-owned `axisInitializationAdmission`
for employees without detailed setup inspection rights. Only `READY` admits the
workspace. `NOT_READY` and `UNAVAILABLE` show a read-only refresh/sign-out screen,
without requesting setup status or exposing initialization actions. Employees
with setup inspection rights retain the existing detailed initialization flow.
