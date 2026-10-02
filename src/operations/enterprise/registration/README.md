# Employee registration renderer

**Functional owner:** Nodics Platform. **Identity and presentation owner:** Profile.
Axis owns this React renderer and its typed browser client, not the employee,
challenge, approval, SMTP or membership state.

App supplies `bootstrap.endpoints.profile` explicitly. Discovery and registration
commands use that connection through the existing authentication URL helper.
Do not send Profile operations to `runtime.backofficeBaseUrl`, guess another host,
use a caller query parameter as an endpoint, or retry an old route on failure.
The project endpoint still owns non-secret routing-hint isolation. The same
Profile connection supports consolidated and separate-runtime deployments.

The Profile v1 workspace supplies copy, constraints and inert relative operation
paths. This renderer supports its declared PASSWORD invited-new-employee method.
The v2 workspace also renders EXISTING_ACCOUNT: an explicit invitation and the
original password, without first/last-name inputs or a new-password field. Its
additional labels/help are required backend copy. V1 cannot silently enter that
stage. Acceptance creates no browser token; final login remains Profile-owned.
It does not silently substitute a legacy form or construct an external identity
provider journey. Origin, credential, approval and access enforcement stay on
Profile. The code does not create authentication tokens.

The explicit post-registration/recovery Sign in action delegates to App's existing
secure logout owner before entering normal sign-in. An existing employee session
must not redirect a newly registered person into the previous employee's workspace.
Only a confirmed logout clears the old session/cache and forwards Profile's bounded
non-secret enterprise hint. A failed logout follows the existing locked-session
error path; the hint never grants access or changes the logout request's tenant.
Displaying or completing registration does not itself log out another session.
Without an existing session, Sign in proceeds without issuing a logout command.
Verified `SIGN_IN` progress may also carry Profile's bounded enterprise hint for
an unambiguous registered employee. The hint is optional for legacy responses;
Axis never derives it from email, an invitation, a tenant, or another session.
Unverified/expired progress cannot supply this existing-account routing hint.
Public login CMS delivery remains in the configured project's enterprise context;
the verified sign-in hint selects only the Profile authentication context. It must
not retarget public CMS requests or expand a runtime service credential's scope.
Authenticated CMS requests retain the authenticated employee enterprise context.

## State and failure behavior

After Profile returns verified `DETAILS` or `RESET_PASSWORD`, retire the earlier
verification-delivery notice. The completed email step and account fields show
progress without asking the user to check email again. Keep email context,
explicit Check progress, and independent owner/transport errors visible. This
presentation rule does not infer verification from the browser clock or grant
account access; the returned Profile stage remains authoritative.

The same account-access shell now renders the independently discovered
`axis.employee-recovery` contract on `/forgot-password`. Its parser rejects
registration/application stages, assignments and v2 membership contracts.
`RESET_PASSWORD` has only a new-password input. `RESETTING` requests the exact
new password already submitted to inspect an uncertain outcome. Recovery cannot
send applications or choose roles/enterprises; it never falls back to registration.

An optional validated registration `applications` contract provides eligible
choices, note constraints, submission path and required outcome copy.
`APPLICATION_DETAILS` submits names and a note, never a password or role.
Pending/approved/rejected states display bounded safe history and Check Progress.
Approval displays setup-pending guidance rather than sign-in or active access.
Unconfirmed Process startup displays backend guidance without automatic replay.
Qualified lifecycle metadata supplies an inert withdrawal path and copy. The
renderer confirms withdrawal, sends the exact displayed revision once, and
displays WITHDRAWN/EXPIRED history in APPLICATION_CLOSED. Resubmission restarts
mailbox verification; it never reuses proof or changes role/tenant policy locally.
History is keyed by assignment plus attempt, not assignment alone. Feedback and
timestamps are plain backend-projected text. Generic transport failure retains
progress for inspection and does not auto-retry. Lifecycle qualification remains
default off; existing/customer application participation and proactive Process
task retirement remain backend follow-ups, not guessed UI commands.

History renders an optional retained `deadlineAt` using a semantic `time` element
and the browser locale when Profile publishes `applications.presentation.deadlineLabel`.
Missing timestamps or optional copy omit that line; invalid timestamps fail the
progress parser, and the presentation component independently suppresses invalid
dates. Displaying a deadline never computes expiry or changes backend permissions.
Customize that plain label in the owning workspace, not in React. Focused coverage
is in `test/enterprise/applicationDeadline.test.tsx` and the registration client tests.

The backend-owned `nodics.platform/modules/profile/llm/contracts/account-access-journeys.md`
in the companion framework checkout documents these boundaries. Browser/live acceptance remains deferred to the joint
session; these source changes do not certify runtime activation.

Email is entered once. The continuation, code and password stay in memory; only
successful, non-secret enterprise routing context can enter the existing hint
helper. A retry preserves appropriate task fields, clears submitted passwords,
and never creates automatic command retries. Discovered connections reject
credentials, query strings, fragments and plaintext non-loopback hosts.

START storage uncertainty (`ERR_PROFILE_REG_STORAGE`) without a received
continuation cannot offer Check progress: that owner command requires the opaque
continuation, not an email lookup. Axis retains the typed error code and displays
a generic missing-progress-reference message advising administrator assistance
before another code request. It neither claims START failed before applying nor
creates a continuation, status request or automatic retry. Existing explicit Send
code remains a new operator-selected request. Once progress exists, the owner
message and explicit Check progress action remain available with that exact
continuation. Other validation messages remain owner-authored; no English-message
matching selects this behavior. The rendered registration tests cover both states.

OTP paste/autofill is supported. Recovery uses `current-password` and Profile's
original-password guidance rather than a new-password suggestion. Later users
must not be instructed to change a credential while resuming registration.
Existing-account and recovery passwords are not constrained to the new-account
minimum length; the backend still owns proof and credential eligibility. Secrets
clear after submission and never enter browser storage or automatic retries.

## Customize and extend safely

Change headings/help and field constraints in the Profile-owned layered workspace
presentation, not in this renderer. For example, a project may refine
`enterpriseManagement.registration.presentation.recoveryPasswordHelp` to explain
its support route. Keep it plain text and preserve the rule that resumption never
resets a saved password. The renderer must reject missing required copy or an
unsupported workspace version, not invent policy. Enterprise selection comes
only from verified backend progress.

For a generic transport or accessibility correction, extend these existing
components and client tests. Do not add a second bootstrap registry, backend proxy,
credential store or project switcher. Backend-importable documentation and CMS
records remain outside this frontend repository.

## Verification

`test/enterprise/registrationConnection.test.ts` exercises the discovered host,
no-credential/no-retry transport and unsafe connection rejection.
`test/enterprise/registrationClient.test.ts` covers typed progress and context.
Use the repository's native Vitest, lint, typecheck and build gates with its lockfile.
The delivery's Node/TypeScript source harness is supplementary evidence, not a
substitute for React/MUI compilation, real browser rendering or live API checks.

Browser acceptance must cover one and multiple invitations, code expiry/resend,
interrupted registration, wrong original password, final sign-in, restore/logout,
keyboard use, focus and narrow layouts. Operator/business task manuals belong to
the backend documentation owner and must be validated against the real interface.
