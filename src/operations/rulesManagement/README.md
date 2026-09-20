# Business Rules workspace

Axis renders the authorized `rules.policy` native workspace published by
`rulesApi`. It lists governed definitions and delegates draft preparation,
editing, validation, simulation, and Process approval submission to the owning
backend operations. The browser never evaluates a rule, resolves policy
hierarchy, publishes by record mutation, or keeps a second property catalogue.

The workspace includes structured tabs for rule-building assistance, score-band
draft editing, backend simulation, draft review, version history, and audit
inspection. These tabs are browser presentation around owner APIs and JSON
transport documents; they do not evaluate rules, resolve catalogues, publish
versions, or settle rewards in the frontend. Invalid JSON stays local and sends
no request. Backend validation, permissions, immutable versions, maker-checker
workflow, audit, and publication remain authoritative.

A customer frontend may wrap this route with presentation help while retaining
the authorized navigation item, discovered `rulesApi` connection, and typed
client. Do not hardcode consumer endpoints or implement operators in React.

Focused verification:

```bash
npx vitest run test/rulesManagement/rulesClient.test.ts
```
