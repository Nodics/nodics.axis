import {
  parseMediaImageIntake,
  type MediaImageIntakeDefinition,
} from '../mediaManagement/api/mediaImageIntakeClient';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import { observeEmployeeSessionResponse } from '../../auth/employeeSessionEvents';
import {
  parseMediaPublicationDependency,
  type MediaPublicationDependency,
} from '../readiness/mediaPublicationHandoff';
import {
  executeWorkbenchAggregate,
  type WorkbenchClientConfiguration,
} from '../../workbench/api/workbenchClient';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';

export const editorialPresentationKeys = [
  'editLabel',
  'previewLabel',
  'saveLabel',
  'savingLabel',
  'refreshLabel',
  'archiveLabel',
  'archiveTitle',
  'archiveMessage',
  'confirmArchiveLabel',
  'cancelLabel',
  'inspectLabel',
  'localeLabel',
  'unsavedMessage',
  'savedMessage',
  'uncertainMessage',
  'changedMessage',
  'refreshTitle',
  'refreshMessage',
  'confirmRefreshLabel',
  'missingLocaleMessage',
  'readOnlyBodyMessage',
  'inReviewMessage',
  'publicationMessage',
  'pendingPublicationMessage',
  'resumePublicationLabel',
  'inspectPublicationLabel',
  'unavailableMessage',
  'archivedMessage',
  'draftLocaleMessage',
  'commandReferenceLabel',
  'validationBlockedMessage',
  'validationReadyMessage',
  'closeLabel',
  'closeTitle',
  'closeMessage',
  'confirmCloseLabel',
] as const;
export type EditorialPresentation = Readonly<
  Record<(typeof editorialPresentationKeys)[number], string>
>;
export type EditorialDeployment =
  | Readonly<{ status: 'UNKNOWN' }>
  | Readonly<{ status: 'NONE'; revision: number }>
  | Readonly<{
      status: 'DEPLOYED';
      code: string;
      sourceRevision: number;
      activationKey: string;
      version: string;
      revision: number;
    }>;
export interface EditorialWorkspace {
  readonly article: WorkbenchRecord;
  readonly localizations: readonly WorkbenchRecord[];
  readonly requiredLocaleCodes: readonly string[];
  readonly supportedLocaleCodes: readonly string[];
  readonly operations: readonly ('SAVE' | 'ARCHIVE' | 'INSPECT')[];
  readonly presentation: EditorialPresentation;
  readonly mediaIntake?: MediaImageIntakeDefinition;
  readonly deployment?: EditorialDeployment;
  readonly featuredMedia?: EditorialFeaturedMediaReadiness;
}

export interface EditorialFeaturedMediaReadiness {
  readonly mediaCode: string | null;
  readonly ready: boolean;
  readonly status: string;
  readonly dependency?: MediaPublicationDependency;
  readonly presentation: Readonly<
    Record<'ready' | 'pending' | 'unavailable' | 'open' | 'saveFirst', string>
  >;
}

/** Owner evidence is optional for earlier workspaces but never inferred from an image preview. */
export function parseEditorialFeaturedMedia(
  value: unknown,
): EditorialFeaturedMediaReadiness | undefined {
  if (value === undefined) return undefined;
  const source = record(value),
    copy = record(source.presentation);
  if (
    source.contractVersion !== 1 ||
    typeof source.ready !== 'boolean' ||
    (source.mediaCode !== null &&
      (typeof source.mediaCode !== 'string' || source.mediaCode.length > 512)) ||
    typeof source.status !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(source.status)
  )
    throw new Error('Featured image readiness is incompatible');
  const presentation = Object.fromEntries(
    ['ready', 'pending', 'unavailable', 'open', 'saveFirst'].map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 2000)
        throw new Error('Featured image guidance is incompatible');
      return [key, copy[key]];
    }),
  ) as EditorialFeaturedMediaReadiness['presentation'];
  const dependency = parseMediaPublicationDependency(source.dependency);
  if (
    (dependency && dependency.mediaCode !== source.mediaCode) ||
    (source.mediaCode === null &&
      (source.ready !== true || source.status !== 'NOT_REQUIRED' || dependency)) ||
    (source.mediaCode !== null &&
      source.ready === true &&
      dependency?.qualified !== true)
  )
    throw new Error('Featured image readiness does not match the saved reference');
  return Object.freeze({
    mediaCode: source.mediaCode,
    ready: source.ready,
    status: source.status,
    presentation: Object.freeze(presentation),
    ...(dependency ? { dependency } : {}),
  });
}

/** Deployment identity is read evidence, separately from latest publication history and public visibility. */
function deployment(value: unknown, sourceRevision: number): EditorialDeployment {
  if (value === undefined) return Object.freeze({ status: 'UNKNOWN' });
  const current = record(value);
  if (current.status === 'UNKNOWN') return Object.freeze({ status: 'UNKNOWN' });
  if (
    typeof current.revision !== 'number' ||
    !Number.isSafeInteger(current.revision) ||
    current.revision < 0
  )
    throw new Error('Editorial deployment revision is incompatible');
  if (current.status === 'NONE')
    return Object.freeze({ status: 'NONE', revision: current.revision });
  if (
    current.status !== 'DEPLOYED' ||
    current.revision < 1 ||
    typeof current.code !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(current.code) ||
    revision(current.sourceRevision) > sourceRevision ||
    typeof current.activationKey !== 'string' ||
    !current.activationKey ||
    current.activationKey.length > 1024 ||
    Array.from(current.activationKey).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    typeof current.version !== 'string' ||
    !current.version ||
    current.version.length > 131072 ||
    Array.from(current.version).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Editorial deployment identity is incompatible');
  return Object.freeze({
    status: 'DEPLOYED',
    code: current.code,
    sourceRevision: Number(current.sourceRevision),
    activationKey: current.activationKey,
    version: current.version,
    revision: current.revision,
  });
}

/** CMS may override the same inert owner copy contract; missing required copy never invents a business action. */
export function parseEditorialPresentation(value: unknown): EditorialPresentation {
  const copy = record(value);
  return Object.freeze(
    Object.fromEntries(
      editorialPresentationKeys.map((key) => {
        const text = copy[key];
        if (typeof text !== 'string' || !text.trim() || text.length > 2000)
          throw new Error('Editorial editor presentation is unavailable');
        return [key, text];
      }),
    ) as Record<(typeof editorialPresentationKeys)[number], string>,
  );
}
export interface EditorialCommand {
  readonly operation: 'SAVE' | 'ARCHIVE';
  readonly commandId: string;
  readonly articleCode: string;
  readonly expectedRevision: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly retainedPublication?: Readonly<{ code: string; sourceRevision: number }>;
}
export type EditorialCommandResult =
  | Readonly<{
      outcome: 'SAVED_DRAFT' | 'ARCHIVED';
      commandId: string;
      article: WorkbenchRecord;
      localizations?: readonly WorkbenchRecord[];
    }>
  | Readonly<{
      outcome: 'UNKNOWN' | 'SAVED_BUT_CHANGED';
      commandId: string;
      currentRevision: number;
      currentStatus: string;
    }>;

const statuses = new Set([
  'DRAFT',
  'READY',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'WITHDRAWN',
  'ARCHIVED',
]);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Editorial owner evidence is incompatible');
  return value as Record<string, unknown>;
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('Editorial revision is incompatible');
  return value;
}
function article(value: unknown, code: string): WorkbenchRecord {
  const row = record(value);
  let publicationIntent: Readonly<Record<string, unknown>> | undefined;
  if (row.code !== code || !statuses.has(String(row.status)))
    throw new Error('Editorial article identity or state changed');
  const current = revision(row.revision);
  if (
    row.publicationSourceRevision !== undefined &&
    revision(row.publicationSourceRevision) > current
  )
    throw new Error('Editorial publication reference is incompatible');
  if (row.publicationIntent !== undefined) {
    const intent = record(row.publicationIntent);
    if (
      Object.keys(intent).length !== 3 ||
      intent.contractVersion !== 1 ||
      typeof intent.code !== 'string' ||
      !intent.code.trim() ||
      intent.code !== intent.code.trim() ||
      intent.code.length > 256 ||
      Array.from(intent.code).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      revision(intent.sourceRevision) !== current
    )
      throw new Error('Editorial pending publication reference is incompatible');
    publicationIntent = Object.freeze({ ...intent });
  }
  return Object.freeze({ ...row, ...(publicationIntent ? { publicationIntent } : {}) });
}
function locales(
  value: unknown,
  code: string,
  currentRevision: number,
): readonly WorkbenchRecord[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new Error('Editorial localized copy is incompatible');
  const seen = new Set<string>();
  return Object.freeze(
    value.map((item: unknown) => {
      const row = record(item);
      if (
        row.articleCode !== code ||
        row.revision !== currentRevision ||
        typeof row.code !== 'string' ||
        !row.code ||
        typeof row.localeCode !== 'string' ||
        !row.localeCode ||
        !['DRAFT', 'READY'].includes(String(row.status)) ||
        seen.has(row.localeCode)
      )
        throw new Error('Editorial localized copy does not match the saved revision');
      seen.add(row.localeCode);
      return Object.freeze({ ...row });
    }),
  );
}
function languageCodes(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some(
      (item) => typeof item !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,34}$/.test(item),
    ) ||
    new Set(value).size !== value.length
  )
    throw new Error('Editorial language policy is incompatible');
  return Object.freeze(value.map((item: unknown) => String(item)));
}

/** Resolve one exact admitted source, never an arbitrary Editorial or Online instance. */
export function editorialAuthoringSource(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
): AxisModuleConnection | undefined {
  if (
    schema.moduleName !== 'editorial' ||
    schema.schemaName !== 'editorialArticle' ||
    !schema.connectionServer ||
    !schema.connectionEnvironment ||
    schema.authoring?.stage !== 'STAGED' ||
    !schema.authoring.authoringAllowed
  )
    return undefined;
  const matches = (bootstrap.moduleConnections.editorial ?? []).filter(
    (source) =>
      source.moduleName === 'editorial' &&
      source.state === 'UP' &&
      source.runtimeRole?.publication === 'STAGED' &&
      source.server === schema.connectionServer &&
      source.environment === schema.connectionEnvironment &&
      (!schema.connectionInstanceId ||
        source.instanceId === schema.connectionInstanceId),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Uses declared aggregate routes and the shared transport; acknowledgement checks stay in this trusted owner adapter. */
async function invoke(
  source: AxisModuleConnection,
  schema: WorkbenchSchema,
  operation: string,
  payload: Readonly<Record<string, unknown>>,
  configuration: WorkbenchClientConfiguration,
  commandId: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  if (
    source.moduleName !== 'editorial' ||
    source.state !== 'UP' ||
    source.runtimeRole?.publication !== 'STAGED' ||
    source.server !== schema.connectionServer ||
    source.environment !== schema.connectionEnvironment ||
    (schema.connectionInstanceId &&
      source.instanceId !== schema.connectionInstanceId) ||
    schema.authoring?.stage !== 'STAGED' ||
    !schema.authoring.authoringAllowed
  )
    throw new Error('Editorial source is unavailable');
  const endpoint = new URL(source.endpoint);
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Editorial source is incompatible');
  const ownerFetch: typeof fetch = async (url, init) => {
    const response = await fetcher(url, init);
    observeEmployeeSessionResponse(response, configuration.accessToken);
    if (response.ok) {
      const envelope = record(await response.clone().json());
      if (
        envelope.code !== 'SUC_SYS_00000' ||
        envelope.success === false ||
        envelope.acknowledged === false ||
        envelope.error ||
        (envelope.errors !== undefined &&
          (!Array.isArray(envelope.errors) || envelope.errors.length > 0))
      )
        throw new Error('Editorial owner acknowledgement could not be confirmed');
    }
    return response;
  };
  return executeWorkbenchAggregate(
    source,
    schema,
    operation,
    payload,
    { ...configuration, ownerFetch },
    commandId,
    fetcher,
  );
}

export async function loadEditorialWorkspace(
  source: AxisModuleConnection,
  schema: WorkbenchSchema,
  articleCode: string,
  locale: string,
  configuration: WorkbenchClientConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<EditorialWorkspace> {
  const value = record(
    await invoke(
      source,
      schema,
      'workspace',
      { articleCode, locale },
      configuration,
      crypto.randomUUID(),
      fetcher,
    ),
  );
  if (value.contractVersion !== 1)
    throw new Error('Editorial editor contract is incompatible');
  const root = article(value.article, articleCode);
  const supported = languageCodes(value.supportedLocaleCodes);
  const required = languageCodes(value.requiredLocaleCodes);
  if (!supported.length || required.some((code) => !supported.includes(code)))
    throw new Error('Editorial required languages are unavailable');
  const presentation = parseEditorialPresentation(value.presentation);
  const operations = value.operations;
  if (
    !Array.isArray(operations) ||
    operations.some((item) => !['SAVE', 'ARCHIVE', 'INSPECT'].includes(String(item)))
  )
    throw new Error('Editorial editor operations are incompatible');
  if (
    root.publicationIntent !== undefined &&
    operations.some((item) => item === 'SAVE' || item === 'ARCHIVE')
  )
    throw new Error('Editorial pending publication operations are incompatible');
  const translations = locales(
    value.localizations,
    articleCode,
    revision(root.revision),
  );
  if (translations.some((row) => !supported.includes(String(row.localeCode))))
    throw new Error('A saved content language is not configured for this editor');
  const mediaIntake = parseMediaImageIntake(value.mediaIntake);
  const featuredMedia = parseEditorialFeaturedMedia(value.featuredMedia);
  return Object.freeze({
    article: root,
    localizations: translations,
    supportedLocaleCodes: supported,
    requiredLocaleCodes: required,
    operations: Object.freeze(
      operations.map((item: unknown) => String(item)),
    ) as EditorialWorkspace['operations'],
    presentation: Object.freeze(presentation),
    ...(mediaIntake ? { mediaIntake } : {}),
    ...(featuredMedia ? { featuredMedia } : {}),
    deployment: deployment(value.deployment, revision(root.revision)),
  });
}

function commandResult(
  value: unknown,
  command: EditorialCommand,
  schema: WorkbenchSchema,
): EditorialCommandResult {
  const response = record(value);
  if (
    response.contractVersion !== 1 ||
    response.commandId !== command.commandId ||
    response.fromRevision !== command.expectedRevision
  )
    throw new Error('Editorial command receipt does not match the original draft');
  if (response.outcome === 'UNKNOWN' || response.outcome === 'SAVED_BUT_CHANGED') {
    if (!statuses.has(String(response.currentStatus)))
      throw new Error('Editorial current state is incompatible');
    return Object.freeze({
      outcome: response.outcome,
      commandId: command.commandId,
      currentRevision: revision(response.currentRevision),
      currentStatus: String(response.currentStatus),
    });
  }
  const expected = command.operation === 'SAVE' ? 'SAVED_DRAFT' : 'ARCHIVED';
  const next = command.expectedRevision + (command.operation === 'SAVE' ? 1 : 0);
  if (response.outcome !== expected || response.toRevision !== next)
    throw new Error('Editorial command completion could not be confirmed');
  const root = article(response.article, command.articleCode);
  if (
    root.revision !== next ||
    root.status !== (command.operation === 'SAVE' ? 'DRAFT' : 'ARCHIVED')
  )
    throw new Error('Editorial saved state does not match the original command');
  if (
    command.retainedPublication &&
    (root.publicationCode !== command.retainedPublication.code ||
      root.publicationSourceRevision !== command.retainedPublication.sourceRevision)
  )
    throw new Error('Editorial retained publication reference changed');
  const translations =
    command.operation === 'SAVE'
      ? locales(response.localizations, command.articleCode, next)
      : undefined;
  if (command.operation === 'SAVE') {
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)]),
            )
          : value;
    const matches = (saved: WorkbenchRecord, changes: unknown, rootFields: boolean) => {
      for (const [field, expected] of Object.entries(record(changes))) {
        const actual = saved[field];
        if (expected === '' && actual === undefined) continue;
        const date =
          rootFields &&
          schema.fields
            .find((candidate) => candidate.name === field)
            ?.type.toLowerCase() === 'date';
        if (
          date &&
          typeof expected === 'string' &&
          typeof actual === 'string' &&
          Date.parse(expected) === Date.parse(actual)
        )
          continue;
        if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(expected)))
          throw new Error('Editorial saved copy does not match the original draft');
      }
    };
    matches(root, command.payload.changes ?? {}, true);
    if (command.payload.localization !== undefined) {
      const submitted = record(command.payload.localization);
      const saved = translations?.find(
        (item) => item.localeCode === submitted.localeCode,
      );
      if (!saved) throw new Error('Editorial saved language is missing');
      matches(saved, submitted.changes ?? {}, false);
    }
  }
  return Object.freeze({
    outcome: expected,
    commandId: command.commandId,
    article: root,
    ...(translations ? { localizations: translations } : {}),
  });
}

export async function executeEditorialCommand(
  source: AxisModuleConnection,
  schema: WorkbenchSchema,
  command: EditorialCommand,
  configuration: WorkbenchClientConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<EditorialCommandResult> {
  return commandResult(
    await invoke(
      source,
      schema,
      command.operation === 'SAVE' ? 'saveDraft' : 'archive',
      command.payload,
      configuration,
      command.commandId,
      fetcher,
    ),
    command,
    schema,
  );
}

export async function inspectEditorialCommand(
  source: AxisModuleConnection,
  schema: WorkbenchSchema,
  command: EditorialCommand,
  configuration: WorkbenchClientConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<EditorialCommandResult> {
  return commandResult(
    await invoke(
      source,
      schema,
      'inspectCommand',
      {
        articleCode: command.articleCode,
        expectedRevision: command.expectedRevision,
        commandId: command.commandId,
      },
      configuration,
      crypto.randomUUID(),
      fetcher,
    ),
    command,
    schema,
  );
}
