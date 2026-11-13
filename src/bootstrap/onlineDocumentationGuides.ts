import { useQuery } from '@tanstack/react-query';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from './publicBootstrap';
import type { DocumentationGuideKind } from './documentationGuides';

export interface OnlineDocumentationTopic {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly site: string;
  readonly locale: string;
  readonly channel: string;
  readonly accessMode: 'PUBLIC' | 'AUTHENTICATED';
  readonly channelId?: string;
  readonly channelLabel?: string;
}

export interface OnlineDocumentationGuide {
  readonly guide: DocumentationGuideKind;
  readonly label: string;
  readonly route: string;
  readonly projectId?: string;
  readonly topics: readonly OnlineDocumentationTopic[];
}

export interface OnlineDocumentationGuideCatalogue {
  readonly contractVersion: 1;
  readonly navigation: readonly {
    readonly id: string;
    readonly label: string;
    readonly route: string;
    readonly order: number;
  }[];
  readonly guides: readonly OnlineDocumentationGuide[];
}

function invalid(): never {
  throw new Error('Online documentation catalogue is invalid');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}

function field(value: unknown): string {
  return typeof value === 'string' && value.trim().length ? value : invalid();
}

function identifier(value: unknown): string {
  const id = field(value);
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) ? id : invalid();
}

function topic(candidate: unknown): OnlineDocumentationTopic {
  const row = object(candidate);
  const route = field(row.route);
  if (
    !/^\/docs(?:\/[a-zA-Z0-9_-]+)+$/.test(route) ||
    (row.accessMode !== 'PUBLIC' && row.accessMode !== 'AUTHENTICATED')
  )
    return invalid();
  return {
    id: identifier(row.id),
    label: field(row.label),
    route,
    site: identifier(row.site),
    locale: field(row.locale),
    channel: field(row.channel),
    accessMode: row.accessMode,
    ...(row.channelId === undefined && row.channelLabel === undefined
      ? {}
      : {
          channelId: identifier(row.channelId),
          channelLabel: field(row.channelLabel),
        }),
  };
}

/** Validates the Online delivery envelope before any imported browser route becomes executable. */
export function parseOnlineDocumentationGuides(
  envelope: unknown,
): OnlineDocumentationGuideCatalogue {
  const data = object(object(envelope).result);
  if (data.contractVersion !== 1) return invalid();
  const guides = list(data.guides).map((candidate): OnlineDocumentationGuide => {
    const row = object(candidate);
    const guide = row.guide;
    if (guide !== 'axis' && guide !== 'framework' && guide !== 'project')
      return invalid();
    const route = field(row.route);
    const projectId = guide === 'project' ? identifier(row.projectId) : undefined;
    const query = new URLSearchParams({ guide });
    if (projectId) query.set('project', projectId);
    if (
      route !== '/docs?' + query.toString() ||
      (!projectId && row.projectId !== undefined)
    )
      return invalid();
    const topics = list(row.topics).map(topic);
    if (!topics.length) return invalid();
    return {
      guide,
      label: field(row.label),
      route,
      topics,
      ...(projectId ? { projectId } : {}),
    };
  });
  if (new Set(guides.map((g) => g.route)).size !== guides.length) return invalid();
  const allowed = new Set(
    guides.map((g) => (g.guide === 'project' ? '/docs?guide=project' : g.route)),
  );
  const navigation = list(data.navigation).map((candidate) => {
    const row = object(candidate);
    const route = field(row.route);
    if (
      !allowed.has(route) ||
      typeof row.order !== 'number' ||
      !Number.isSafeInteger(row.order)
    )
      return invalid();
    return { id: identifier(row.id), label: field(row.label), route, order: row.order };
  });
  if (
    new Set(navigation.map((n) => n.id)).size !== navigation.length ||
    new Set(navigation.map((n) => n.route)).size !== navigation.length
  )
    return invalid();
  return { contractVersion: 1, navigation, guides };
}

/** Shares a tenant- and employee-scoped Online CMS read between shell, guide reader and dashboard. */
export function useOnlineDocumentationGuides(
  bootstrap: AxisAuthenticatedBootstrap | undefined,
  runtime: AxisRuntimeConfig,
  accessToken: string | undefined,
  employeeId: string | undefined,
  enabled = true,
) {
  const connection =
    bootstrap &&
    selectModuleConnection(bootstrap, 'cms', { publicationRole: 'ONLINE' });
  const query = useQuery({
    queryKey: [
      'online-documentation-guides',
      runtime.enterpriseCode,
      bootstrap?.tenantCode,
      employeeId,
      connection?.instanceId,
      connection?.endpoint,
    ],
    enabled: Boolean(enabled && accessToken && employeeId && connection),
    staleTime: 15_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!connection || !accessToken || !employeeId || !enabled)
        throw new Error('Online documentation is unavailable');
      const endpoint = connection.endpoint.replace(/\/$/, '');
      const response = await fetch(
        new URL(endpoint + '/v0/delivery/documentation/guides'),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer ' + accessToken,
            'x-enterprise-code': runtime.enterpriseCode,
          },
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(runtime.requestTimeoutMs),
          ]),
        },
      );
      if (!response.ok)
        throw new Error(`Online documentation returned HTTP ${response.status}`);
      return parseOnlineDocumentationGuides(await response.json());
    },
  });
  // A failed refresh can retain data in the query cache. Withdraw its links until Online confirms them again.
  return query.isError ? { ...query, data: undefined } : query;
}
