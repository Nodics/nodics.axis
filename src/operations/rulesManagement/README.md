# Business Rules workspace

Axis renders the authorized `rules.policy` native workspace published by
`rulesApi`. It lists governed definitions and delegates draft preparation,
editing, validation, simulation, and Process approval submission to the owning
backend operations. The browser never evaluates a rule, resolves policy
hierarchy, publishes by record mutation, or keeps a second property catalogue.

The JSON editors are bounded transport views of backend-owned definition and
simulation-input contracts. Invalid JSON stays local and sends no request.
Backend validation, permissions, immutable versions, maker-checker workflow,
audit, and publication remain authoritative.

A customer frontend may wrap this route with presentation help while retaining
the authorized navigation item, discovered `rulesApi` connection, and typed
client. Do not hardcode consumer endpoints or implement operators in React.

Focused verification:

```bash
npx vitest run test/rulesManagement/rulesClient.test.ts
```
