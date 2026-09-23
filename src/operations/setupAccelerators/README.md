# Setup And Accelerators Operations

Setup & Accelerators renders BackOffice-owned application capability readiness.
Axis must not infer setup dependencies, publication state, approval state, or
repair operations from local page logic.

Capability blockers may include backend-declared `repair` metadata. Axis may
render an executable repair action only when all of these are true:

- the backend marks the repair as available;
- the operation is one of the governed operations supported by this client;
- the action is sent back to BackOffice, not implemented in the browser.

Currently executable repairs:

- `applicationInitialization.prepareCapability`
- `applicationInitialization.reconcileApproval`

When BackOffice returns `preparationOperation` evidence, Axis may render it as
compact before/after setup evidence. Axis must not derive that evidence from
release lists or import files.

Source repairs, runtime repairs, publishing-only repairs, and module registry
repairs remain operator guidance until their owning backend exposes an
executable governed operation.

When changing this area, validate:

```bash
npx vitest run test/operations/setupAccelerators/api/applicationInitializationClient.test.ts
npm run typecheck
```
