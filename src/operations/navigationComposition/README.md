# Navigation Composition

Axis renders BackOffice-owned composition and lifecycle results. Export reads
GET `/navigation/composition/snapshot` with the current project and employee
context. It never calls the nonexistent `/export` alias, submits a candidate body
for export or retries a denied/missing snapshot through another route.

Choose Export in the authorized composition workspace to inspect the native
snapshot. A failed request remains an error; preview, approval and publication
remain distinct owner operations and are not export fallbacks.

Project renderers may customize presentation while reusing
`executeNavigationCompositionAction`. Preserve fixed native routes, original
credentials, enterprise/project scope, single-attempt transport and backend
authorization. Do not copy native composition or lifecycle policy into Axis.
Run `test/operations/navigationCompositionClient.test.ts` after transport changes.
Backend details remain in Platform BackOffice's navigation-composition contracts.
