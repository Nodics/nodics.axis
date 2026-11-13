import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type {
  DataRelease,
  DataReleaseOperationResult,
  DataReleaseType,
} from './dataReleaseContracts';
import { ownerReleaseKey, releaseKey } from '../importExportPresentation';
import { dataCatalogueSourceKey } from './dataCatalogueSources';

export interface DataCatalogueSelection {
  readonly scope: string;
  readonly proofs: ReadonlyMap<
    string,
    Readonly<{ version: string; checksum: string; source: string }>
  >;
}

/** Selection is an observed transport intent, bound to an exact owner and immutable release evidence. */
export function captureDataCatalogueSelection(
  scope: string,
  keys: ReadonlySet<string>,
  releases: readonly DataRelease[],
  origins: ReadonlyMap<string, AxisModuleConnection>,
): DataCatalogueSelection {
  const proofs = new Map<
    string,
    { version: string; checksum: string; source: string }
  >();
  for (const release of releases) {
    const key = releaseKey(release),
      owner = origins.get(key);
    if (keys.has(key) && owner)
      proofs.set(key, {
        version: release.version,
        checksum: release.checksum,
        source: dataCatalogueSourceKey(owner),
      });
  }
  return { scope, proofs };
}

/** New authority, changed release content or missing fresh owner evidence never inherits an old selection. */
export function currentDataCatalogueSelection(
  selection: DataCatalogueSelection,
  scope: string,
  releases: readonly DataRelease[],
  origins: ReadonlyMap<string, AxisModuleConnection>,
): ReadonlySet<string> {
  const keys = new Set<string>();
  if (selection.scope !== scope) return keys;
  for (const release of releases) {
    const key = releaseKey(release),
      proof = selection.proofs.get(key),
      owner = origins.get(key);
    if (
      proof &&
      owner &&
      proof.version === release.version &&
      proof.checksum === release.checksum &&
      proof.source === dataCatalogueSourceKey(owner)
    )
      keys.add(key);
  }
  return keys;
}

/** Capture all selected batch destinations before any command; a missing owner stops the entire dispatch. */
export function dataCatalogueCommandBatches(
  releases: readonly DataRelease[],
  origins: ReadonlyMap<string, AxisModuleConnection>,
): readonly Readonly<{
  connection: AxisModuleConnection;
  releases: readonly DataRelease[];
}>[] {
  const batches = new Map<
    string,
    { connection: AxisModuleConnection; releases: DataRelease[] }
  >();
  for (const release of releases) {
    const connection = origins.get(releaseKey(release));
    if (!connection)
      throw new Error(
        'The original release source is unavailable. Refresh data and review the selection.',
      );
    const source = dataCatalogueSourceKey(connection);
    const batch = batches.get(source) ?? { connection, releases: [] };
    batch.releases.push(release);
    batches.set(source, batch);
  }
  return Object.freeze([...batches.values()]);
}

/** Correlates a single original owner response without discovering or ordering its prerequisites. */
export function dataReleaseResponseMatchesSelection(
  result: DataReleaseOperationResult,
  selected: readonly DataRelease[],
  type: DataReleaseType,
  tenant: string,
  mode: 'validate' | 'install',
): boolean {
  if (result.dataType !== type || result.tenant !== tenant) return false;
  const roots = new Map(selected.map((release) => [ownerReleaseKey(release), release]));
  if (!roots.size || roots.size !== selected.length) return false;
  const allowed = new Map<
    string,
    Pick<DataRelease, 'moduleName' | 'dataType' | 'version' | 'checksum'>
  >(roots);
  const selection = result.selection;
  if (selection) {
    const requested = new Set(selection.requestedReleaseCodes);
    if (
      selection.contractVersion !== 1 ||
      requested.size !== roots.size ||
      requested.size !== selection.requestedReleaseCodes.length ||
      [...requested].some((code) => !roots.has(code))
    )
      return false;
    for (const prerequisite of selection.prerequisites) {
      if (allowed.has(prerequisite.releaseCode) || prerequisite.dataType !== type)
        return false;
      allowed.set(prerequisite.releaseCode, prerequisite);
    }
    if (allowed.size > 256) return false;
  }
  const returned = new Set(result.releases.map(ownerReleaseKey));
  if (
    returned.size !== result.releases.length ||
    [...roots.keys()].some((code) => !returned.has(code)) ||
    ((!selection || mode === 'validate') && returned.size !== allowed.size)
  )
    return false;
  return result.releases.every((release) => {
    const expected = allowed.get(ownerReleaseKey(release));
    return (
      expected !== undefined &&
      release.moduleName === expected.moduleName &&
      release.dataType === expected.dataType &&
      release.version === expected.version &&
      release.checksum === expected.checksum
    );
  });
}
