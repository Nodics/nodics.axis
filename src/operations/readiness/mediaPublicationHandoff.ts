/** Media-owned inspection handoffs; neither dependency evidence nor a URL grants publication authority. */
import {
  parseBackendWorkspace,
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisBackendWorkspace,
} from '../../bootstrap/publicBootstrap';

export interface MediaPublicationDependency {
  readonly mediaCode: string;
  readonly versionId?: number;
  readonly status: string;
  readonly qualified: boolean;
  readonly handoff?: Readonly<{
    owner: 'media';
    route: string;
    label: string;
    available: boolean;
    query: Readonly<{ mediaCode: string }>;
    backendWorkspace: AxisBackendWorkspace;
    automaticExecution: false;
    requiresOwnerInspection: true;
  }>;
}

/** Projects only safe identity and inert navigation, never the returned publication command. */
export function parseMediaPublicationDependency(
  value: unknown,
): MediaPublicationDependency | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Media dependency is incompatible');
  const source = value as Record<string, unknown>;
  if (
    source.owner !== 'media' ||
    typeof source.mediaCode !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(source.mediaCode) ||
    typeof source.status !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(source.status) ||
    typeof source.qualified !== 'boolean' ||
    (source.versionId !== undefined &&
      (!Number.isSafeInteger(source.versionId) || Number(source.versionId) < 0))
  )
    throw new Error('Media dependency is incompatible');
  const base = {
    mediaCode: source.mediaCode,
    status: source.status,
    qualified: source.qualified,
    ...(source.versionId !== undefined
      ? { versionId: source.versionId as number }
      : {}),
  };
  if (source.handoff === undefined) return Object.freeze(base);
  if (
    !source.handoff ||
    typeof source.handoff !== 'object' ||
    Array.isArray(source.handoff)
  )
    throw new Error('Media inspection handoff is incompatible');
  const handoff = source.handoff as Record<string, unknown>;
  const query = handoff.query;
  if (
    handoff.owner !== 'media' ||
    handoff.automaticExecution !== false ||
    handoff.requiresOwnerInspection !== true ||
    typeof handoff.available !== 'boolean' ||
    typeof handoff.label !== 'string' ||
    !handoff.label.trim() ||
    handoff.label.length > 256 ||
    Array.from(handoff.label).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    typeof handoff.route !== 'string' ||
    !/^\/(?!\/)[A-Za-z0-9/_-]{1,510}$/.test(handoff.route) ||
    !query ||
    typeof query !== 'object' ||
    Array.isArray(query) ||
    Object.keys(query).join() !== 'mediaCode' ||
    (query as Record<string, unknown>).mediaCode !== source.mediaCode
  )
    throw new Error('Media inspection handoff is incompatible');
  return Object.freeze({
    ...base,
    handoff: Object.freeze({
      owner: 'media' as const,
      route: handoff.route,
      label: handoff.label,
      available: handoff.available,
      query: Object.freeze({ mediaCode: source.mediaCode }),
      backendWorkspace: parseBackendWorkspace(
        handoff.backendWorkspace,
        'Media inspection workspace',
      ),
      automaticExecution: false as const,
      requiresOwnerInspection: true as const,
    }),
  });
}

/** Admits only the exact current authorized Media workspace and its existing connection selector. */
export function resolveMediaPublicationHandoff(
  bootstrap: AxisAuthenticatedBootstrap,
  dependency: MediaPublicationDependency | undefined,
): string | undefined {
  const handoff = dependency?.handoff;
  if (
    !handoff?.available ||
    handoff.backendWorkspace.contractVersion !== 1 ||
    !handoff.backendWorkspace.tabs.some((tab) =>
      tab.sections.some(
        (section) =>
          section.type === 'form' && section.readSource?.parameter === 'mediaCode',
      ),
    )
  )
    return undefined;
  const matches = bootstrap.navigation.filter(
    (item) =>
      item.moduleName === 'media' &&
      item.route === handoff.route &&
      item.featureState === 'ACTIVE' &&
      ['UP', 'DEGRADED'].includes(item.availability) &&
      item.backendWorkspace?.renderer === 'axis.workspace.backend-operations' &&
      JSON.stringify(item.backendWorkspace) ===
        JSON.stringify(handoff.backendWorkspace),
  );
  if (
    matches.length !== 1 ||
    !selectModuleConnection(
      bootstrap,
      'media',
      matches[0]!.backendWorkspace?.ownerSelector,
    )
  )
    return undefined;
  return `${handoff.route}?${new URLSearchParams(handoff.query).toString()}`;
}
