# Cron Operations Renderer

Canonical functional owner: `nodics.process`; API owner: `cronjob`. Axis consumes
the authenticated BackOffice connection and existing route admission. It does
not own target configuration, job persistence, timing or Process authorization.

`CronScheduleDraftPanel` is the optional inactive-draft journey. The strict typed
client calls only the four Cron draft routes. An unavailable contract does not
fall back to the legacy generic save. Owner presentation and approved target/
timing choices arrive from the capabilities endpoint; no copied target registry
or browser-entered execution node exists in this panel.

Review changes invalidate confirmation. Saving is explicit and never retries.
Unknown responses keep code/review identity in memory, freeze input and expose
original-save inspection only. Missing inspection evidence remains unknown.
Unchanged inactive receipts freeze the form as complete. Credential, enterprise
or connection changes remount the session; late callbacks are aborted/ignored.
No review or credential is written to local storage. Navigating away loses the
transient review, not the backend record; unresolved operations need owner-led
inspection using retained operational evidence rather than another insert.

The business workspace creates schedules only through this approved inactive-draft
journey. The old prefilled active demo-job form is retired. Generic technical Cron
APIs remain owner-controlled for separately qualified clients; they are not an
inactive-draft transport fallback. Existing job operations intersect the current
permission-filtered owner declarations with their fixed secured transports.
View-only navigation does not authorize a scheduler command.

Positive empty inventory requires a valid owner success envelope and actual list.
Missing identities/active flags and duplicate jobs are unavailable evidence, not
fabricated records. A lifecycle acknowledgement means the request was accepted;
execution needs current scheduler and log evidence. An uncertain dispatched
operation holds further commands in the open session and offers read-only refresh;
refresh does not prove its outcome or authorize replay. Retain the original job
reference for owner-led recovery before leaving. Private opaque actor, tenant,
project and exact source coordinates partition caches and retire old callbacks.
There is one page H1 with business section headings. Customize owner labels and
approved targets through Cron, preserving the protocol and permission projection.
The Cron client/action/page tests cover these boundaries. Native scheduled firing
and nonadministrator roles remain separate acceptance gates.

## Customize and Extend Safely

Configure target choices and captions in the backend's
`cronjob.scheduleDrafts`, not this repository. In a customer-owned frontend,
wrap `CronScheduleDraftPanel` to change surrounding layout:

```tsx
export function CustomerScheduleWorkspace(
  props: React.ComponentProps<typeof CronScheduleDraftPanel>,
) {
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <CronScheduleDraftPanel {...props} />
    </Box>
  );
}
```

Preserve authorized connection provenance, exact response parsing, scope remount,
confirmation, uncertainty lock and offline rejection. Do not persist credentials,
inject targets or replace an unknown response with submitted draft fields.
Backend steps and technical contract are owned by the framework's
`nodics.process/modules/cronjob/llm/contracts/inactive-schedule-drafts.md` and
`nodics.docs/docs/pages/nodics.process/inactive-schedule-drafts.md`.

Run `npx vitest run test/cron`, `npm run typecheck`, `npm run lint` and build.
The synthetic visual fixture is `test/cron/schedule-drafts.visual.html`; add
`?uncertain` to exercise lost-response inspection. It refuses external requests
and does not establish signed-in or persistent-runtime acceptance. Test desktop,
mobile, owner-copy changes, denial, target drift and disconnected service states.

Reviewed schedule records use the existing preview/confirmed lifecycle controls
for activation and deactivation. A `scheduleDraft` marker, even malformed, removes
legacy create/start/stop/pause/resume controls from that record; it never grants
authority. Unmanaged job operations retain their existing owner declarations.
Manual run still requires current permission and active, non-running owner
evidence. The command checks the current row and policy again before dispatch.
A synchronous admission reference prevents a second button submission before
pending state renders. Confirmation refreshes owner evidence; it does not prove
the scheduled business work completed. Unknown outcomes keep the original hold.

Open schedule controls selects the exact retrieved record and its owner name,
without copying a code or sending an API command. Inspect remains explicit.
Draft and lifecycle pending/unknown states hold competing row commands and record
selection. A competing manual command blocks activation while preserving exact
read-only inspection and reviewed deactivation; stopping future callbacks does
not claim an in-flight callback was cancelled. Do not remount an unresolved
control session to change identity or clear its hold.

Cards show completed execution only when the persisted Cron status is SUCCESS
or ERROR and its start/end timestamps are valid and ordered. Missing,
nonterminal or contradictory fields remain unconfirmed. These fields establish
the Cron run result, not downstream Process completion. Definition active flags
and the lifecycle owner's actual timer receipt remain separate. Technical job,
timing, node and Process references are progressively disclosed.

For a project-owned presentation extension, preserve the exact `existingSelection`
identity, actor/source remount and pending callbacks when arranging controls.
`commandsBlocked` never authorizes another operation; Cron still checks every
request. `selectionLabel` is presentation from the exact owner record. Execution
formatting may change without inventing timestamps, defaults or completion.
The Cron page, lifecycle and `cronExecutionEvidence` tests cover these boundaries,
including simultaneous admission, original-command uncertainty and no automatic
activation or run during selection.

Cron execution evidence requires consistent owner timestamps and a terminal result outside RUNNING state. The Run now presentation policy checks owner state as well as status. Display only allowlisted error code/target-kind attribution; never render raw provider errors. Explain single-node skipped ticks and no replay separately from the timer lifecycle.
