# Enterprise Workspace Consumers

Axis owns the typed, accessible browser consumers in this folder. Profile owns
identity, canonical credentials, memberships, consent, application state and
access decisions. Process owns review decisions and task retirement. Platform
BackOffice owns discovery and navigation. This file is contributor guidance,
not a backend-importable business documentation pack.

## Source Readiness

The tab-scoped enterprise routing hint survives ordinary session expiry and failed
restoration, while all authenticated state, protected query data and creation
checkpoints are cleared. The next password login must authenticate with Profile
and obtain fresh BackOffice discovery. Confirmed logout and uncertain explicit
enterprise switching clear the hint; a verified registration sign-in handoff has
precedence. It never changes configured project endpoints or public CMS context,
and must never carry an identity, credential, token or permission. Regression
coverage lives in `test/app/employeeLoginJourney.test.tsx`.

Enterprise creation keeps one bounded App-lifetime checkpoint across verified
same-context screen lock/unlock. The admitted Profile connection, tenant/source
enterprise, project, authentication lineage and exact form contract scope it.
Only `code`, `name`, `adminEmail`, `superEnterprise`, `roleCodes`, `active` and
the transport `idempotencyKey` are eligible; changed/extra field contracts do not
enable generic payload retention. Passwords, OTPs, raw responses and tokens never
enter this checkpoint or any storage. Fresh login, logout, session expiry and
context changes clear it. Only an already-declared unique tab selector may survive
in the existing lock return path; other query parameters are discarded.

Unsubmitted values and the original key survive routed remount. Submitting,
uncertain and late acknowledged operations remain fenced, without automatic
create retries or restored review confirmations. The existing setup contribution
shows its owner-configured working label while the original request remains
SUBMITTING, including a same-context remount; the uncertainty warning is shown
only after settlement, never as a claim that an in-flight request has failed.
The existing setup contribution
offers explicit owner inspection, with the retained enterprise code prefilled.
HELD/RESUMABLE reads preserve the checkpoint; existing reviewed setup resume
uses only its fresh owner revision. A matching COMPLETE owner read retires the
local creation checkpoint, not an inferred original-request receipt or grant.
That matching completion also resets the creation form's stale error and pending
reply context. HELD, RESUMABLE, failed or unrelated inspections do not clear them.
No private key is sent to setup inspection. Reload/HMR or a draft lost before
this code existed cannot be recovered retroactively. The focused checkpoint tests
exercise remount, safe projection, context isolation and late replies; live
auto-lock/unlock acceptance remains separate. Keep any customization within this
allowlist and the owning published form; do not create a broad draft registry.

After successful password verification and fresh authenticated discovery, the
App lock-screen route redirects to its retained return path. Unlock does not
also issue an imperative navigation: competing dashboard and return-path
redirects previously lost the enterprise route. Normal navigation admission
still applies at the destination. `test/app/screenLockReturnJourney.test.tsx`
exercises the real shell, App routing and enterprise form across this handoff,
including retained values and a pending/denied unlock that cannot expose them.
Authentication and CMS owners are isolated fixtures, not live browser evidence.

Unresolved operations are fenced by stable admitted ownership context even when
labels, field constraints, endpoint metadata or the supported form contract change.
Incompatible replacement contracts stay read-only for that unresolved operation;
they cannot initialize a new draft or replace its original key. HTTP 200 does not
acknowledge creation by itself: the returned public enterprise must match the
submitted code/name and contain the owner tenant/active projection. Empty,
unrelated, count-only or malformed replies retain UNCERTAIN and require inspection.
The model-create response uses the canonical scalar `tenant` reference; the
public projection's `tenantCode` remains supported. The tenant must match the
new enterprise code, as required by Profile model creation, and both references
must agree when supplied. Nested references and conflicting aliases are not
acknowledgements. Later-layer presentation must preserve these owner identities.

Only the actual HTTP 409 plus Profile's registered
`ERR_PROFILE_ENTERPRISE_DUPLICATE` returns a submitted create form to editable
DRAFT: the owner guarantees that refusal happened before writes. Inputs and the
original idempotency key are retained; no new key, resubmission or setup command
is generated. A generic validation message, absent/mismatched code/status,
provisioning failure or transport uncertainty remains locked for inspection.
An already uncertain checkpoint cannot be released by a late refusal.

`EnterpriseSetupContinuation` consumes the validated `setupContinuation` member
of the existing generic Enterprise Management workspace. It adds no route or
navigation authority. The contribution owns full versioned Profile paths,
availability, resume qualification and presentation; the transport uses only
the authorized Profile catalogue connection, with no version/path fallback.
Customized router prefixes, versions and action paths remain owner-authored.
Equivalent authenticated catalogue refreshes preserve the adapter and pending
command/result. Adapter identity follows validated descriptor/connection values,
the signed source enterprise, timeout, token and session generation, not bootstrap
object references. Real scope/authority/contract changes still retire old replies;
no mutation is replayed when an observation changes or a response is uncertain.
Both templates must contain exactly one whole-segment `{enterpriseCode}`; their
resolved URLs must stay on the authorized origin and inside its declared base
path (when present). Credentials, query/fragment, traversal, encoded separators,
extra placeholders and unexpected methods are refused before any request.
An explicitly unavailable descriptor may omit either or both actions. The
workspace retains its configured title/unavailable message without a request
or fallback. Available descriptors still require both valid action declarations;
any supplied unavailable action remains strictly validated and cannot be qualified.
The target parameter does not relabel the signed source enterprise header.
Its version-1 snapshot contains enterprise,
administrator and setup projections. Only an explicit owner `RESUMABLE`/
`canResume` snapshot plus a supplied resume command admits review. The command
sends the inspected `expectedRevision`, never a private original request key.
Unknown status/reason codes use configured unavailable copy, not raw codes;
tenant identity remains undisplayed. Historical HELD evidence may have a null
revision and is never resumable. The fresh response must retain a valid owner
descriptor; disabled qualification never enables a command. Current owner
presentation supplies held/complete messages and reason mappings but no
administrator-status mapping, so raw administrator codes are omitted.
Success triggers read-only reinspection;
uncertainty clears executable state until explicit inspection. Context changes
discard old responses. Do not borrow committed Team reconciliation for setup.
Customize later through validated owner copy and the authorized adapter, not
browser authority, default permissions or a copied setup lifecycle. Focused
coverage lives in `test/enterprise/enterpriseSetupContinuation.test.tsx` and
`test/enterprise/enterpriseSetupDescriptor.test.tsx`; mocked HTTP and rendered
fixtures do not establish live transport or browser acceptance.

Native pages execute only after authenticated capability discovery admits their
backend workspace. A source renderer is not runtime qualification. Default-off
owner flags must not be enabled in the browser, and an enterprise hierarchy is
not evidence of delegated authority.

- `EnterpriseTeamRoutePage` reviews member lifecycle and administrator handover
  through Profile, preserving reviewed operation identity after uncertainty.
- `EnterpriseMembershipRoutePage` inspects own invitations and reviews acceptance
  before a separately reviewed enterprise session switch. App discards old
  bootstrap/query state before obtaining fresh authorized context.
- `EnterpriseRecoveryRoutePage` inspects one enterprise before owner recovery.
  Committed unused-invitation withdrawal uses the existing reviewed enterprise,
  team revision and operation ID. The client accepts only the owner's terminal
  membership-shaped result for that enterprise, then reinspects; it does not
  infer completion from update counts, re-send the withdrawal or replay after
  uncertain delivery. Uncommitted operations and handover remain ineligible for
  this evidence-only command. `test/enterprise/enterpriseRecoveryUi.test.tsx`
  covers explicit review, private-field removal, one submission, malformed and
  cross-enterprise acknowledgements, unavailable recovery and late replies after
  an employee context change using the real client with HTTP doubles.
- `ApplicationRecoveryRoutePage` inspects the current assignment revision and
  renders safe closed-attempt history. Profile supplies only attempt number,
  WITHDRAWN/EXPIRED status, closure timestamp, review-started state and qualified
  retirement availability. Axis retains no attempt hashes or private callbacks.
- `CustomerParticipationRoutePage` displays the exact current owner terms and
  independently reviews consent renewal/withdrawal. Staff consent is not a
  customer session transition, and customer participation never grants staff rights.
  Acceptance and renewal require an unchecked consent choice followed by review
  of the exact document, enterprise and version. The returned revision must be
  one for first acceptance or the reviewed revision plus one for renewal.
  Uncertainty removes executable state and requires a fresh owner inspection.
  Inspection/loading, withdrawal review and actor changes clear prior choices.
  Validated `participation.currentTerms` and `participation.canSwitch` are owner
  projections; missing/non-boolean or contradictory flags fail closed. Current
  terms disable the checkbox and renewal, even when lifecycle renewal is qualified.
  Axis does not infer switch permission or issue a Customer session from these flags.
  These Employee PASSWORD endpoints are not ordinary Circa-customer endpoints.
  The installed Profile routes are `/customer/participation/workspace`,
  `/customer/participation/accept`, `/customer/participation/renew` and
  `/customer/participation/withdraw`. They return the Profile data envelope;
  accept/renew return `accepted`, `enterpriseCode` and the persisted revision,
  while withdrawal returns `phase:WITHDRAWN` and the next revision.
  The separate `/nodics/profile/v0/employee/browser/customer-participation/switch` route returns
  Customer access data and changes refresh-cookie namespaces. It requires
  Employee refresh proof, exact origin and Employee CSRF, not just the bearer
  token used by these operational commands. This route is not called here:
  Axis must not install Customer proof into its
  Employee-only session. Consent acceptance itself never performs the switch.
- Public registration/recovery renderers have separate validated stage/endpoint
  contracts; see [registration](registration/README.md).

## Historical Application Retirement

Inspect with the existing Profile GET
`/enterprise-access/applications/:applicationCode/recovery`. The optional
`reviewRetirementAttempts` array is bounded to 20 unique integer attempt selectors
in 1-20. Malformed statuses, dates, booleans or duplicate selectors invalidate the
whole recovery view rather than guessing another attempt.

Only owner-declared `canRetireReview` enables an attempt's retirement control.
The confirmation identifies the application and selected attempt. POST
`/enterprise-access/applications/:applicationCode/actions` receives the fixed
`RETRY_REVIEW_RETIREMENT` operation, the **current assignment** revision and the
selected attempt. Historical revision, tenant, Process task/instance selectors,
actor identity and outcome flags never enter the command body.

An attempt list absent from an older compatible contract preserves the existing
current-attempt control. An explicit empty list does not invent a retry target.
Transport success alone is not completion: the returned projection must validate
and retirement must report `RETIRED`. UNCONFIRMED, disabled, malformed, denied,
conflicted or reconciliation outcomes clear the actionable snapshot and show the
owner's uncertainty guidance. No command auto-retries; inspect again before
another reviewed action. Loading disables target changes and commands, while a
synchronous in-flight guard prevents rapid duplicate inspections/submissions.
Bootstrap, access-token and enterprise changes discard snapshots and late results.

## Customization

`EnterpriseAdministrationRoutePage` consumes the actual Profile v1 workspace
through `api/enterpriseAdministrationClient.ts` and the presentation-only
`EnterpriseAdministrationTaskRenderer`. App admits it only for discovered Profile
`profile.enterpriseAdministration` / `administration`, ACTIVE feature state and
UP/DEGRADED availability. The selected `enterpriseCode` query is a bounded target
selector; it never replaces the current acting enterprise header or tenant.
Duplicate/invalid selectors fail closed. GET
`/enterprise-administration/:enterpriseCode/workspace` supplies available commands,
opaque assignment choices, role/action/recipient ceilings and plain-text copy.

The renderer's command interfaces are internal frontend view models, not a second
Profile protocol. The adapter freezes revision, operation ID, selected assignment,
roles/actions/recipients and expiry before review. POST
`/enterprise-administration/:enterpriseCode/consent` projects only exact owner
fields. Neither canonical identity locators nor caller permissions/tenant flags
are serialized. A returned public record must match the target, incremented
revision and requested public grant/revoke facts; acknowledgement counts do not
confirm a change. Private recipient/authority validation remains Profile-owned.
Success and uncertainty both require fresh workspace inspection before another
command; there is no automatic replay or revision rebase.

The renderer never sends a private identity locator, infers grant authority from
parentage, interprets a status as permission or constructs an API path. Disabled
commands retain owner-provided gate text. One command requires explicit review;
success and uncertainty both clear review and require inspection before another
command. Context changes discard late outcomes. Caller context identity and
command arrays must be stable and replaced when the actor, target, owner revision
or reviewed draft changes. Opaque recipient-assignment selectors come only from
owner-listed source assignments. Parent recipient choices and expiry ceilings
are shown without inventing additional addresses or authority.
Revoke rows require explicit owner `canRevoke: true`; absence leaves them disabled
rather than treating aggregate REVOKE availability as permission for every visible
parent/dependent grant. Profile now publishes row eligibility independently of
display-only EXPIRED status; the browser never writes expiry transitions.
Backend qualification remains default off.
The administration renderer/client/route fixtures are authored, NOT RUN.

### Committed Consent Stamp Repair

`EnterpriseConsentStampRepair` is a separate task inside the qualified native
administration consumer. It uses GET/POST
`/enterprise-administration/:enterpriseCode/consent/stamps/repair`, with the
selected target in the path and unchanged acting enterprise/bearer headers.
GET is explicit, empty-body and empty-query. Only exact v1
`ENTERPRISE_ADMINISTRATION_STAMP_REPAIR` subjects with owner `canRepair:true`
are selectable; stored ACTIVE/REVOKED status never confers repair permission.
Profile independently requires fresh PASSWORD target/platform authority,
the repair permission and default-off `stampRepairQualified`.

Review freezes `{enterpriseCode,revision,operationId,grantCodes}`. POST sends only
that body, once, and accepts only the matching COMPLETE receipt, original
operation ID/subjects and next revision. It never replays grant/revoke/reparent,
chooses private stamp locators or takes over a lease. Unknown writes preserve
the original command in component memory, discard actionable inspection and
require explicit inspection and another review before sending the same body.
Fresh subject revision/status/eligibility must still match; changed targets,
subjects or revisions outside the original/next revision leave recovery disabled.
No timeout, refresh or mount automatically repairs anything.

Confirmed completion clears the retained command; another action requires a new
inspection. Context changes/unmount discard local review/operation state. There
is no durable browser recovery journal or inspection of a completed operation ID
in the current owner DTO, so reload recovery starts with a new explicit owner
inspection, not an invented receipt. The owning server enforces every repeat.

Standalone repair is now selected within the existing authorized native
enterprise-administration route using `task=stamp-repair` and one optional
`enterpriseCode` target selector. No new global navigation, broad enterprise list
or unconditional route is created. The ordinary consent consumer is not mounted
in this subview: a hierarchy fence cannot force a normal workspace read before
stamp inspection. Duplicate/malformed selectors fail before either consumer is
mounted. Subview selection never grants repair authority or changes issuer headers.

`EnterpriseConsentStampRepairRoutePage` initially shows only the configured
native workspace title and a neutral inspection icon. No request runs on mount.
The repair GET supplies its own mandatory `presentation` containing exactly
`title`, `inspectLabel`, `emptyMessage`, `workingLabel`, `reviewTitle`,
`confirmLabel`, `cancelLabel`, `uncertainMessage`, `unavailableMessage`,
`recordedMessage`, `grantLabel`, `revisionLabel` and `statusLabel`.
The title is bounded to 160 characters; all other nonempty plain strings to 500.
Missing, extra or malformed keys fail closed before subject controls appear.
Axis renders escaped text, not executable HTML or policy. Labels for rows, review,
completion and uncertainty come exclusively from the admitted repair projection.
After a write, retained context-bound copy remains available for the required
fresh inspection; actionable rows are discarded. Successful COMPLETE receipts
display the configured recorded message, not an inferred access change.
Later Profile layers customize `administrationConsent.stampRepairPresentation`;
Axis never reads raw backend configuration or bypasses a fence to obtain labels.
Subview changes unmount the previous task and discard its in-memory recovery.
`consentStampClient.test.ts` and `consentStampUi.test.tsx` cover DTO admission,
fixed projected bodies and explicitly reviewed original-command recovery;
`consentStampStandaloneUi.test.tsx` additionally guards fence-independent reads
and issuer/target separation. Fixtures remain authored, NOT RUN.

Use later Profile layers for policy, qualification and plain-text presentation.
The original twelve presentation keys remain required. Seven optional owner
keys customize task controls: `inspectLabel`, `workingLabel`, `reviewTitle`,
`confirmLabel`, `cancelLabel`, `unavailableMessage` and `recordedMessage`.
Axis consumes these bounded strings when published and retains generic fallbacks
for older DTOs. Profile must allowlist and validate the optional keys before
publishing configured defaults; frontend acceptance does not qualify owner policy.
Use Platform capability/navigation configuration to expose qualified workspaces.
For the smallest frontend extension, adjust this folder's renderer presentation
while preserving typed DTO projection, exact revisions, explicit confirmation,
in-flight guards and context invalidation. Add fields only with a matched owner
contract. Do not execute CMS JavaScript or arbitrary command paths.

Do not add grant commands based on a hierarchy helper or broad platform visibility.
Consent grant enforcement, canonical-account linking and eligibility-owner
qualification must be supplied and accepted by Profile before corresponding
executable workflows are exposed. Commerce notification inspect/retry now uses
its published owner contract; see [notification consumers](../notifications/README.md).

## Joint Acceptance

`test/enterprise/applicationRecoveryUi.test.tsx` is authored but **NOT RUN** in
this batch. It covers historical selection/current revision, uncertain retirement
and duplicate selector denial. Existing registration, team and membership fixtures
remain the related source gates. `npm run typecheck` is static verification only.

The joint session must cover qualified/unqualified discovery, denied/expired
sessions, empty history, historical/current closed attempts, completion races,
conflicts, timeouts and stale-context responses, keyboard/dialog focus, narrow
layouts and fresh owner readback after each command. No browser test, backend
activation, data import, email send or release was performed by this source batch.
