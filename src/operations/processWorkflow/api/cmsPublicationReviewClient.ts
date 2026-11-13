import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  request,
  type ProcessDefinitionClientConfiguration,
} from './processDefinitionClient';

export interface CmsReviewComponent {
  readonly code: string;
  readonly slot: string;
  readonly renderer?: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface CmsReviewRoute {
  readonly target: {
    readonly site: string;
    readonly path: string;
    readonly locale: string;
    readonly channel: string;
    readonly accessMode: string;
  };
  readonly page: {
    readonly code: string;
    readonly name: string;
    readonly renderer?: string;
    readonly template?: string;
  };
  readonly components: readonly CmsReviewComponent[];
  readonly changes: {
    readonly status: 'NEW' | 'UNCHANGED' | 'CHANGED' | 'UNAVAILABLE';
    readonly previousPageName?: string;
    readonly navigationChanged: boolean;
    readonly components: readonly {
      readonly kind: 'ADDED' | 'REMOVED' | 'UPDATED';
      readonly component?: CmsReviewComponent;
      readonly before?: CmsReviewComponent;
    }[];
  };
}

export interface CmsReviewIdentity {
  readonly instanceCode: string;
  readonly taskCode: string;
  readonly publicationCode: string;
  readonly sourceVersion: string;
  readonly siteCode: string;
}

export interface CmsPublicationReview {
  readonly revision: number;
  readonly catalogCode: string;
  readonly truncated: boolean;
  readonly prerequisites: {
    readonly validated: boolean;
    readonly dependencyCount: number;
    readonly dependencies: readonly {
      readonly schema: string;
      readonly code: string;
      readonly version: string;
    }[];
    readonly media: readonly string[];
    readonly mediaCount: number;
  };
  readonly routes: readonly CmsReviewRoute[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('CMS review evidence is incompatible');
  return value as Record<string, unknown>;
}

const text = (value: unknown): value is string => typeof value === 'string';
const optionalText = (value: unknown) => value === undefined || text(value);
const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const identityCode = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);

function component(value: unknown): boolean {
  const row = record(value);
  return (
    text(row.code) &&
    text(row.slot) &&
    optionalText(row.renderer) &&
    Object.values(record(row.fields)).every(text)
  );
}

function matchesRoute(value: unknown, site: string): boolean {
  const row = record(value),
    target = record(row.target),
    page = record(row.page);
  const changes = record(row.changes);
  return (
    target.site === site &&
    [target.path, target.locale, target.channel, target.accessMode].every(text) &&
    [page.code, page.name].every(text) &&
    [page.renderer, page.template].every(optionalText) &&
    Array.isArray(row.components) &&
    row.components.every(component) &&
    ['NEW', 'UNCHANGED', 'CHANGED', 'UNAVAILABLE'].includes(String(changes.status)) &&
    optionalText(changes.previousPageName) &&
    typeof changes.navigationChanged === 'boolean' &&
    Array.isArray(changes.components) &&
    changes.components.every((entry: unknown) => {
      const change = record(entry);
      switch (change.kind) {
        case 'ADDED':
          return component(change.component);
        case 'REMOVED':
          return component(change.before);
        case 'UPDATED':
          return component(change.component) && component(change.before);
        default:
          return false;
      }
    })
  );
}

/** Asks the authorized Process task workspace for the CMS-owned, exact read-only evidence. */
export async function loadCmsPublicationReview(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  identity: CmsReviewIdentity,
  signal: AbortSignal,
): Promise<CmsPublicationReview> {
  const endpoint = new URL(connection.endpoint);
  if (
    connection.moduleName !== 'workflow' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !/\/nodics\/process\/?$/.test(endpoint.pathname) ||
    !Object.values(identity).every(identityCode)
  )
    throw new Error('CMS review identity or authority is unavailable');
  const path = `/instances/${encodeURIComponent(identity.instanceCode)}/tasks/${encodeURIComponent(identity.taskCode)}/cms-review`;
  const envelope = record(await request(connection, path, configuration, { signal }));
  const result = record(envelope.data);
  const prerequisites = record(result.prerequisites);
  if (
    envelope.code !== 'SUC_PROCESS_00000' ||
    envelope.error ||
    envelope.success === false ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length > 0)) ||
    result.contractVersion !== 1 ||
    result.taskCode !== identity.taskCode ||
    result.instanceCode !== identity.instanceCode ||
    result.publicationCode !== identity.publicationCode ||
    result.sourceVersion !== identity.sourceVersion ||
    !count(result.revision) ||
    !text(result.catalogCode) ||
    typeof result.truncated !== 'boolean' ||
    typeof prerequisites.validated !== 'boolean' ||
    !count(prerequisites.dependencyCount) ||
    !count(prerequisites.mediaCount) ||
    !Array.isArray(prerequisites.media) ||
    !prerequisites.media.every(text) ||
    !Array.isArray(prerequisites.dependencies) ||
    !prerequisites.dependencies.every((entry: unknown) => {
      const dependency = record(entry);
      return [dependency.schema, dependency.code, dependency.version].every(text);
    }) ||
    !Array.isArray(result.routes) ||
    result.routes.length === 0 ||
    !result.routes.every((route: unknown) => matchesRoute(route, identity.siteCode))
  )
    throw new Error('CMS review evidence does not match the selected task');
  return result as unknown as CmsPublicationReview;
}
