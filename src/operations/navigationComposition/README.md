# Navigation Composition

Axis presents BackOffice-owned navigation snapshots, validation and lifecycle
receipts. The authorized workspace is an administrative inspection surface;
it does not implement a field-level composition editor. BackOffice retains
permissions, scope, checksum, candidate validation and publication authority.

Export reads GET `/navigation/composition/snapshot` with the current project
and employee context. After checking the native format, tenant/Enterprise scope,
optional project scope, version and checksum, Axis offers **Download snapshot**.
The JSON preserves the complete owner DTO; the filename preserves version zero.
Export never submits a candidate, edits navigation or claims publication.
The browser retains only a session-local Blob URL and revokes it when the result,
employee, workspace or selected source changes or the page closes.

Preview renders the owner's actual dry-run result and up to twenty validation
messages. It states that nothing was saved or published. Draft, submission,
approval, publication and rollback each require their own matching owner receipt;
approval does not imply publication. An invalid or uncertain acknowledgement stays
an error: inspect the owner state before repeating a lifecycle command. Commands
are never retried automatically. A failed export read may be explicitly requested
again. No old `/export` alias or denied-route fallback is used.

The action grid stacks at small widths. Download metadata wraps inside its card;
validation issues use ordinary escaped text. Private evidence is retired before a
different employee or connection can display a late response. No result is stored
in local storage or a shared query cache.

Project renderers may customize card layout, typography and typed feedback while
reusing `executeNavigationCompositionAction` and `navigationCompositionOutcome`.
Preserve fixed native routes, exact acknowledgements, original credentials,
Enterprise/project scope, the private lifecycle and single-attempt transport.
Never copy native composition policy, authorize routes from a snapshot or execute
returned content. Larger exports need a separately reviewed owner/browser contract.

Run the focused `navigationCompositionClient`, `navigationCompositionOutcome` and
`NavigationCompositionRoutePage` tests under `test/operations`. They cover native
snapshot preservation, invalid/foreign responses, dry-run failures, acknowledgement
separation, usable downloads, late-result retirement and Blob cleanup. Native
acceptance additionally verifies the downloaded JSON and a narrow viewport.
Backend details remain in Platform BackOffice's navigation-composition contracts.

Before lifecycle decisions, Axis reads fresh authoring metadata once and displays version/draft state. Stage and available-action hints come from BackOffice; each command carries the exact reviewed version/checksum and draft ID. A command failure disables further decisions until explicit Refresh lifecycle; commands never retry. Success reads the next owner stage without automatically executing it. Rollback to MODULE_DEFAULTS restores the live owner fallback. Late reads are retired with the employee/connection scope. Customize presentation around this typed client, never derive a revision, grant an action or freeze module defaults in project configuration. Focused tests cover the reviewed revision, separate approval/publication, unavailable status and manual recovery.

Preview and Create draft first read and validate the native snapshot DTO. The normalized navigation projection used for rendering is not a lossless owner candidate. This read introduces no editor, grant or automatic command; the one subsequent command still carries the original reviewed lifecycle precondition.
