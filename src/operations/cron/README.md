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

The legacy Cron control remains separately available; its generated save is not
the inactive-draft protocol and may start active jobs. Never label that legacy
flow as inactive or use it as a draft transport fallback.

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
