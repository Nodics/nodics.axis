# Import And Export Operations

Axis renders nImport-owned release readiness. It must not inspect module data
folders, calculate release state, sequence imports, or repair manifests in the
browser.

The Data Import workbench groups backend readiness by business capability and
renders backend blocker metadata, including optional `repair` guidance. A
repair chip is presentation only: install/update/retry actions still submit the
selected immutable releases to nImport, and source-only repairs such as invalid
manifests remain developer/operator work in the owning module.

Backend blockers use the shared readiness vocabulary: `blockerCode`, `code`,
`severity` (`INFO`, `WARNING`, `BLOCKED`, or `REPAIR_REQUIRED`), `owner`,
`ownerType`, `source`, `message`, `action`, client-safe disabled reason,
technical status, optional target evidence, and optional repair metadata. Do
not reintroduce Axis-only `ACTION`/`BLOCKER` normalization as the primary
contract.

When changing this area, validate:

```bash
npx vitest run test/operations/importExport/api/dataReleaseClient.test.ts test/operations/importExport/components/DataReleaseWorkbench.test.tsx
```
