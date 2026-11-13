# Runtime Configuration

Axis renders nSystem schemas and effective values from an operator-selected,
authorized bootstrap `system` connection. PLATFORM is only the initial preference;
identity and delivery configuration may belong to different runtime instances.
No proxy, endpoint entry field, runtime registry or permission grant is introduced.
Reads and writes select the exact catalogue instance. Query caches include both
instance and endpoint, and switching targets clears drafts and notices.

Schema/effective `secretPersistence` is the content-free nSystem prerequisite.
Required-but-unready or missing sensitive readiness blocks entry and save;
loading, failed and refreshing reads also block edits. Cached effective values, configured counts and positive status badges are withheld
while either schema/effective read is pending or failed. The screen shows checking
or unverified observation and actionable read recovery, retaining the owner error
as detail. Refresh re-observes the selected owner; it never validates or saves a
preserved draft automatically. Missing encryption keys
must be installed through the selected runtime's deployment configuration,
followed by an explicit readiness refresh. Configured values are not write grants.
Secret drafts never use public validation; explicit Save uses the existing owner
save operation, which rechecks readiness and encryption. No automatic mutation
retry is permitted. Runtime/schema selectors are disabled during commands.

Customize schema labels, fields, permissions and readiness in owning backend
configuration; never move encryption, secret persistence or provider authority
into Axis. Responsive controls use the existing workspace and MUI layout.
Focused mocked regressions: `test/operations/runtimeConfiguration/RuntimeConfigurationRoutePage.test.tsx`.

Transport contracts are parsed before rendering or selecting an effective-value
read. Incomplete schemas, duplicate field identities, unsupported types,
credential fields without sensitivity and contradictory readiness are rejected
with a recoverable message; runtime selection and Refresh remain available.
A partial deployment selector is not a new schema. Backend owner admission and
runtime composition must be repaired independently of browser parsing.

The effective-value parser drops sensitive value material, including a mistakenly
unmasked string, before React. The view says Configured securely and renders only
ordinary typed scalars, preserving false and zero. It never uses an unknown field
identity as a configuration path or supplies an encryption key. Projects may
customize labels/theme and extend owner schemas in their actual consuming runtime;
preserve the typed parser and original owner write/encryption policy.
`runtimeConfigurationContracts.test.ts` and
`RuntimeConfigurationMalformedOwner.test.tsx` use synthetic values to verify
malformed-target containment, return to a healthy runtime, absence of a denied
effective read and sensitive-value exclusion.
