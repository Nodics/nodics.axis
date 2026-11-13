import { describe, expect, it, vi } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import {
  parseEditorialFeaturedMedia,
  editorialAuthoringSource,
  editorialPresentationKeys,
  executeEditorialCommand,
  inspectEditorialCommand,
  loadEditorialWorkspace,
  type EditorialCommand,
} from '../../../src/operations/editorial/editorialAuthoringClient';

const source: AxisModuleConnection = {
  moduleName: 'editorial',
  instanceId: 'staged-one',
  server: 'content',
  environment: 'local',
  endpoint: 'http://localhost:4312/nodics/editorial',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
} as AxisModuleConnection;
const schema = {
  moduleName: 'editorial',
  schemaName: 'editorialArticle',
  fields: [],
  connectionServer: 'content',
  connectionEnvironment: 'local',
  connectionInstanceId: 'staged-one',
  authoring: { stage: 'STAGED', authoringAllowed: true },
  aggregateOperations: ['workspace', 'saveDraft', 'inspectCommand', 'archive'].map(
    (name) => ({
      name,
      api: {
        method: 'POST',
        path: `/authoring/articles/${name}`,
        apiVersion: 'v0',
        active: true,
      },
    }),
  ),
} as unknown as WorkbenchSchema;
const configuration = {
  accessToken: 'original-private-actor',
  enterpriseCode: 'default',
  tenantCode: 'default',
  timeoutMs: 360000,
};
const root = {
  code: 'article-a',
  revision: 2,
  status: 'DRAFT',
  internalName: 'Saved title',
  publicationCode: 'pub-a',
  publicationSourceRevision: 1,
};
const locale = {
  code: 'article-a-en',
  articleCode: 'article-a',
  localeCode: 'en',
  revision: 2,
  status: 'READY',
  title: 'Saved copy',
};
const command: EditorialCommand = {
  operation: 'SAVE',
  commandId: 'original-command-001',
  articleCode: 'article-a',
  expectedRevision: 1,
  payload: {
    articleCode: 'article-a',
    expectedRevision: 1,
    changes: { internalName: 'Saved title' },
    localization: { localeCode: 'en', changes: { title: 'Saved copy' } },
  },
  retainedPublication: { code: 'pub-a', sourceRevision: 1 },
};
const receipt = () => ({
  contractVersion: 1,
  outcome: 'SAVED_DRAFT',
  commandId: command.commandId,
  fromRevision: 1,
  toRevision: 2,
  article: { ...root },
  localizations: [{ ...locale }],
});
const workspace = () => ({
  contractVersion: 1,
  article: { ...root },
  localizations: [{ ...locale }],
  supportedLocaleCodes: ['en', 'ar'],
  requiredLocaleCodes: ['en'],
  operations: ['SAVE', 'ARCHIVE', 'INSPECT'],
  presentation: Object.fromEntries(editorialPresentationKeys.map((key) => [key, key])),
});
const response = (result: unknown, extra = {}) =>
  Response.json({ code: 'SUC_SYS_00000', result, ...extra });

function requestBody(value: BodyInit | null | undefined): unknown {
  if (typeof value !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(value) as unknown;
}
function requestUrl(value: RequestInfo | URL): string {
  return value instanceof Request ? value.url : value.toString();
}

describe('Editorial owner command transport and evidence', () => {
  it('selects one exact Staged owner and rejects duplicate, unavailable and Online owners', () => {
    const bootstrap = (sources: AxisModuleConnection[]) =>
      ({
        moduleConnections: { editorial: sources },
      }) as unknown as AxisAuthenticatedBootstrap;
    expect(editorialAuthoringSource(bootstrap([source]), schema)).toBe(source);
    for (const sources of [
      [source, source],
      [{ ...source, state: 'DOWN' }],
      [{ ...source, runtimeRole: { publication: 'ONLINE' } }],
      [{ ...source, instanceId: 'different' }],
    ]) {
      expect(
        editorialAuthoringSource(bootstrap(sources as AxisModuleConnection[]), schema),
      ).toBeUndefined();
    }
  });

  it('loads exact saved copy and configured languages without selecting another translation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(workspace()));
    const saved = await loadEditorialWorkspace(
      source,
      schema,
      root.code,
      'ar',
      configuration,
      fetcher,
    );
    expect(saved.localizations.map((row) => row.localeCode)).toEqual(['en']);
    expect(saved.supportedLocaleCodes).toEqual(['en', 'ar']);
    expect(requestBody(fetcher.mock.calls[0]?.[1]?.body)).toEqual({
      articleCode: root.code,
      locale: 'ar',
    });
  });

  it('saves once through the declared command with original credentials and retains publication evidence', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(receipt()));
    const result = await executeEditorialCommand(
      source,
      schema,
      command,
      configuration,
      fetcher,
    );
    expect(result.outcome).toBe('SAVED_DRAFT');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(requestUrl(url)).toBe(
      'http://localhost:4312/nodics/editorial/v0/authoring/articles/saveDraft',
    );
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer original-private-actor',
    );
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(command.commandId);
    expect(requestBody(init?.body)).toEqual(command.payload);
  });

  it('inspects an uncertain original command without replaying its saved payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        contractVersion: 1,
        outcome: 'UNKNOWN',
        commandId: command.commandId,
        fromRevision: 1,
        currentRevision: 1,
        currentStatus: 'DRAFT',
      }),
    );
    expect(
      (await inspectEditorialCommand(source, schema, command, configuration, fetcher))
        .outcome,
    ).toBe('UNKNOWN');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(requestUrl(url)).toContain('/inspectCommand');
    expect(requestBody(init?.body)).toEqual({
      articleCode: root.code,
      expectedRevision: 1,
      commandId: command.commandId,
    });
  });

  it.each([
    [
      'foreign receipt',
      (value: ReturnType<typeof receipt>) => ({ ...value, commandId: 'other' }),
    ],
    [
      'wrong revision',
      (value: ReturnType<typeof receipt>) => ({ ...value, toRevision: 3 }),
    ],
    [
      'wrong root',
      (value: ReturnType<typeof receipt>) => ({
        ...value,
        article: { ...value.article, code: 'other' },
      }),
    ],
    [
      'lost publication',
      (value: ReturnType<typeof receipt>) => ({
        ...value,
        article: { ...value.article, publicationCode: undefined },
      }),
    ],
    [
      'incorrect saved copy',
      (value: ReturnType<typeof receipt>) => ({
        ...value,
        article: { ...value.article, internalName: 'Old title' },
      }),
    ],
    [
      'stale locale',
      (value: ReturnType<typeof receipt>) => ({
        ...value,
        localizations: [{ ...locale, revision: 1 }],
      }),
    ],
    [
      'missing saved locale',
      (value: ReturnType<typeof receipt>) => ({ ...value, localizations: [] }),
    ],
    [
      'wrong saved translation',
      (value: ReturnType<typeof receipt>) => ({
        ...value,
        localizations: [{ ...locale, title: 'Old copy' }],
      }),
    ],
  ])('holds %s without retry or fabricated completion', async (_name, mutate) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(mutate(receipt())));
    await expect(
      executeEditorialCommand(source, schema, command, configuration, fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: 'SUC_OTHER' },
    { acknowledged: false },
    { success: false },
    { error: 'failed' },
    { errors: ['failed'] },
  ])('rejects contradictory successful HTTP evidence %j', async (extra) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(receipt(), extra));
    await expect(
      executeEditorialCommand(source, schema, command, configuration, fetcher),
    ).rejects.toThrow(/acknowledgement/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('sends no command if its owner API is absent or source scope changed', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      executeEditorialCommand(
        source,
        { ...schema, aggregateOperations: [] },
        command,
        configuration,
        fetcher,
      ),
    ).rejects.toThrow();
    await expect(
      executeEditorialCommand(
        { ...source, server: 'other' },
        schema,
        command,
        configuration,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    (value: ReturnType<typeof workspace>) => ({
      ...value,
      requiredLocaleCodes: ['fr'],
    }),
    (value: ReturnType<typeof workspace>) => ({
      ...value,
      localizations: [locale, locale],
    }),
    (value: ReturnType<typeof workspace>) => ({ ...value, presentation: {} }),
    (value: ReturnType<typeof workspace>) => ({ ...value, operations: ['DELETE_ALL'] }),
  ])('fails closed on incompatible owner workspace metadata', async (mutate) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(mutate(workspace())));
    await expect(
      loadEditorialWorkspace(source, schema, root.code, 'en', configuration, fetcher),
    ).rejects.toThrow();
  });
});

it('pending publication evidence must match this source revision and cannot authorize copy or archive', async () => {
  const value = workspace();
  const pending = {
    ...value,
    article: {
      ...value.article,
      publicationIntent: {
        contractVersion: 1,
        code: 'original-request',
        sourceRevision: 2,
      },
    },
    operations: ['INSPECT'],
  };
  const fetcher = vi.fn().mockResolvedValue(response(pending));
  expect(
    (
      await loadEditorialWorkspace(
        source,
        schema,
        root.code,
        'en',
        configuration,
        fetcher,
      )
    ).article.publicationCode,
  ).toBe('pub-a');
  for (const corrupted of [
    { ...pending, operations: ['SAVE', 'INSPECT'] },
    {
      ...pending,
      article: {
        ...pending.article,
        publicationIntent: {
          contractVersion: 1,
          code: 'original-request',
          sourceRevision: 1,
        },
      },
    },
    { ...pending, article: { ...pending.article, publicationIntent: null } },
  ]) {
    fetcher.mockResolvedValue(response(corrupted));
    await expect(
      loadEditorialWorkspace(source, schema, root.code, 'en', configuration, fetcher),
    ).rejects.toThrow();
  }
});

it('keeps owner-proven deployment separate from latest source publication history', async () => {
  const deployed = {
    status: 'DEPLOYED',
    code: 'earlier-request',
    sourceRevision: 1,
    activationKey: 'earlier-key',
    version: 'earlier-en-1',
    revision: 3,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ ...workspace(), deployment: deployed }));
  const saved = await loadEditorialWorkspace(
    source,
    schema,
    root.code,
    'en',
    configuration,
    fetcher,
  );
  expect(saved.deployment).toEqual(deployed);
  expect(saved.article.publicationCode).toBe(root.publicationCode);
});
it.each([
  {
    status: 'DEPLOYED',
    code: 'other',
    sourceRevision: 3,
    activationKey: 'key',
    version: 'en',
    revision: 1,
  },
  {
    status: 'DEPLOYED',
    code: 'other',
    sourceRevision: 1,
    activationKey: '',
    version: 'en',
    revision: 1,
  },
  { status: 'NONE', revision: -1 },
  { status: 'ONLINE', revision: 1 },
])('holds incompatible deployment evidence %j', async (deployment) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response({ ...workspace(), deployment }));
  await expect(
    loadEditorialWorkspace(source, schema, root.code, 'en', configuration, fetcher),
  ).rejects.toThrow(/deployment/);
});

describe('Editorial featured-image owner evidence', () => {
  const presentation = Object.fromEntries(
    ['ready', 'pending', 'unavailable', 'open', 'saveFirst'].map((key) => [key, key]),
  );
  const dependency = {
    owner: 'media',
    mediaCode: 'image-a',
    status: 'NOT_PUBLISHED',
    qualified: false,
  };
  const base = {
    contractVersion: 1,
    mediaCode: 'image-a',
    ready: false,
    status: 'PENDING',
    presentation,
    dependency,
  };
  it('keeps an unapproved reference pending without inferring readiness from preview metadata', () => {
    expect(parseEditorialFeaturedMedia(base)).toMatchObject({
      ready: false,
      dependency: { mediaCode: 'image-a' },
    });
    expect(parseEditorialFeaturedMedia(undefined)).toBeUndefined();
    expect(
      parseEditorialFeaturedMedia({
        contractVersion: 1,
        mediaCode: null,
        status: 'NOT_REQUIRED',
        ready: true,
        presentation,
      }),
    ).toMatchObject({ ready: true });
  });
  it.each([
    { ...base, ready: true },
    { ...base, dependency: { ...dependency, mediaCode: 'other-image' } },
    { ...base, mediaCode: null },
    { ...base, presentation: { ...presentation, open: '' } },
  ])('rejects contradictory readiness or foreign image evidence', (value) => {
    expect(() => parseEditorialFeaturedMedia(value)).toThrow();
  });
});
