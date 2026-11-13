import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationLifecycleAction,
} from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchRendererController } from '../../../src/cms/renderers/shared/rendererTypes';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../../src/workbench/api/workbenchContracts';
import { EditorialWithdrawalAction } from '../../../src/operations/editorial/EditorialWithdrawalAction';
const source = {
  moduleName: 'publish',
  instanceId: 'source',
  endpoint: 'http://localhost:4312/nodics/publish',
  server: 'content',
  environment: 'local',
  state: 'UP',
};
const bootstrap = {
  navigation: [
    {
      moduleName: 'publish',
      route: '/publishing/requests',
      featureState: 'ACTIVE',
      availability: 'UP',
    },
  ],
  moduleConnections: { publish: [source] },
} as unknown as AxisAuthenticatedBootstrap;
const schema = {
  connectionServer: 'content',
  connectionEnvironment: 'local',
} as WorkbenchSchema;
const action = {
  id: 'withdraw',
  operationRoute: '/authoring/articles/:code/withdraw',
  label: 'Withdraw',
} as AxisNavigationLifecycleAction;
const article = {
  code: 'article-a',
  revision: 1,
  status: 'PUBLISHED',
  publicationCode: 'publication-a',
};
let fetcher: ReturnType<typeof vi.fn>,
  execute: ReturnType<typeof vi.fn>,
  onArticle: ReturnType<typeof vi.fn<(article: WorkbenchRecord) => void>>;
const owner = (changes: Record<string, unknown> = {}) => ({
  code: 'publication-a',
  state: 'ONLINE',
  revision: 5,
  domain: 'editorial',
  rootType: 'article',
  rootCode: 'article-a',
  sourceVersion: '1',
  ...changes,
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify({ code: 'SUC_PUB_00000', result: value }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function controller(token = 'private-actor-a') {
  return {
    accessToken: token,
    tenantCode: 'tenant-a',
    enterpriseCode: 'enterprise-a',
    runtime: { requestTimeoutMs: 1000 },
    bootstrap,
    executeLifecycleAction: execute,
  } as unknown as WorkbenchRendererController;
}
function view(current = controller()) {
  return (
    <EditorialWithdrawalAction
      action={action}
      article={article}
      controller={current}
      schema={schema}
      onArticle={onArticle}
    />
  );
}
beforeEach(() => {
  fetcher = vi.fn().mockResolvedValue(response(owner()));
  execute = vi.fn().mockResolvedValue({
    ...owner({ state: 'WITHDRAWN', revision: 7 }),
    article: { ...article, status: 'WITHDRAWN' },
  });
  onArticle = vi.fn();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());
describe('Editorial exact publication withdrawal', () => {
  it('requires explicit source inspection and confirmation using publication revision rather than article revision', async () => {
    const user = userEvent.setup();
    render(view());
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    expect(await screen.findByText(/Publication revision 5/)).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    expect(execute).toHaveBeenCalledExactlyOnceWith(action, article, {
      publicationCode: 'publication-a',
      expectedRevision: '5',
    });
    expect(onArticle).toHaveBeenCalledWith({ ...article, status: 'WITHDRAWN' });
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
  });
  it.each([
    { domain: 'cms' },
    { rootCode: 'other' },
    { sourceVersion: '2' },
    { state: 'FAILED' },
  ])('holds mismatched owner evidence %j without mutation', async (changes) => {
    fetcher.mockResolvedValue(response(owner(changes)));
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    expect(await screen.findByText(/does not match/)).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
  });
  it('preserves publication revision zero', async () => {
    fetcher.mockResolvedValue(response(owner({ revision: 0 })));
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm withdrawal' }));
    expect(execute).toHaveBeenCalledWith(action, article, {
      publicationCode: 'publication-a',
      expectedRevision: '0',
    });
  });
  it('holds an uncertain acknowledgement until an explicit inspection and owner reconciliation', async () => {
    execute.mockRejectedValueOnce(new Error('Response lost'));
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm withdrawal' }));
    expect(await screen.findByText('Response lost')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onArticle).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(response(owner({ state: 'WITHDRAWN', revision: 7 })));
    await user.click(screen.getByRole('button', { name: 'Inspect publication again' }));
    await user.click(
      await screen.findByRole('button', { name: 'Reconcile withdrawn status' }),
    );
    expect(execute).toHaveBeenLastCalledWith(action, article, {
      publicationCode: 'publication-a',
      expectedRevision: '7',
    });
  });
  it('retires private evidence and late reads on actor change', async () => {
    let resolve!: (response: Response) => void;
    const pendingRead = new Promise<Response>((done) => {
      resolve = (value) => {
        done(value);
      };
    });
    fetcher.mockReturnValueOnce(pendingRead);
    const user = userEvent.setup();
    const rendered = render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    rendered.rerender(view(controller('private-actor-b')));
    await act(async () => {
      resolve(response(owner()));
      await Promise.resolve();
    });
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare withdrawal' })).toBeEnabled();
    expect(execute).not.toHaveBeenCalled();
  });
  it('holds denied inspection without an executable confirmation', async () => {
    fetcher.mockResolvedValue(response({}, 403));
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    expect(await screen.findByText(/do not have access/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });
  it('does not accept an unqualified command acknowledgement as article success', async () => {
    execute.mockResolvedValue({ acknowledged: true });
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm withdrawal' }));
    expect(
      await screen.findByText(/acknowledgement could not be confirmed/),
    ).toBeVisible();
    expect(onArticle).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
  });
  it('ignores a command acknowledgement after actor scope retires', async () => {
    let resolve!: (result: unknown) => void;
    const pendingCommand = new Promise<unknown>((done) => {
      resolve = (value) => {
        done(value);
      };
    });
    execute.mockReturnValueOnce(pendingCommand);
    const user = userEvent.setup();
    const rendered = render(view());
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm withdrawal' }));
    rendered.rerender(view(controller('private-actor-b')));
    await act(async () => {
      resolve({
        ...owner({ state: 'WITHDRAWN', revision: 7 }),
        article: { ...article, status: 'WITHDRAWN' },
      });
      await Promise.resolve();
    });
    expect(onArticle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Prepare withdrawal' })).toBeEnabled();
  });
  it('does not inspect or execute with ambiguous source admission', () => {
    const current = {
      ...controller(),
      bootstrap: {
        ...bootstrap,
        moduleConnections: {
          publish: [source, { ...source, instanceId: 'duplicate' }],
        },
      },
    } as unknown as WorkbenchRendererController;
    render(view(current));
    expect(screen.getByText(/inspection is unavailable/)).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('replaces prepared Online evidence with the acknowledged withdrawn receipt while retaining a newer draft', async () => {
    const draft = {
      ...article,
      status: 'DRAFT',
      revision: 4,
      publicationSourceRevision: 1,
    };
    execute.mockResolvedValue({
      ...owner({ state: 'WITHDRAWN', revision: 7 }),
      article: draft,
    });
    render(
      <EditorialWithdrawalAction
        action={action}
        article={draft}
        controller={controller()}
        schema={schema}
        onArticle={onArticle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
    expect(
      await screen.findByText(
        /ONLINE · Published source revision 1 · Publication revision 5/,
      ),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    expect(
      await screen.findByText(
        /WITHDRAWN · Published source revision 1 · Publication revision 7/,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/ONLINE ·/)).not.toBeInTheDocument();
    expect(onArticle).toHaveBeenCalledExactlyOnceWith(draft);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Confirm withdrawal' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Inspect publication again' }),
    ).toBeEnabled();
  });

  it.each([
    { domain: 'cms' },
    { rootCode: 'foreign' },
    { sourceVersion: '2' },
    { revision: 5 },
    { revision: undefined },
    { acknowledged: false },
  ])(
    'clears obsolete prepared evidence after an incompatible owner completion %j',
    async (changes) => {
      execute.mockResolvedValue({
        ...owner({ state: 'WITHDRAWN', revision: 7 }),
        ...changes,
        article: { ...article, status: 'WITHDRAWN' },
      });
      const user = userEvent.setup();
      render(view());
      await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
      await user.click(
        await screen.findByRole('button', { name: 'Confirm withdrawal' }),
      );
      expect(
        await screen.findByText(/acknowledgement could not be confirmed/),
      ).toBeVisible();
      expect(screen.queryByText(/ONLINE ·/)).not.toBeInTheDocument();
      expect(onArticle).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: 'Inspect publication again' }),
      ).toBeEnabled();
    },
  );
});

it('withdraws the restored deployed copy and preserves the newer article and latest request', async () => {
  const draft = {
    ...article,
    status: 'DRAFT',
    revision: 3,
    publicationCode: 'latest-request',
    publicationSourceRevision: 2,
  };
  const deployment = {
    status: 'DEPLOYED' as const,
    code: 'publication-a',
    sourceRevision: 1,
    activationKey: 'old-key',
    version: 'old-en-1',
    revision: 3,
  };
  execute.mockResolvedValue({
    ...owner({ state: 'WITHDRAWN', revision: 7 }),
    article: draft,
  });
  render(
    <EditorialWithdrawalAction
      action={action}
      article={draft}
      deployment={deployment}
      controller={controller()}
      schema={schema}
      onArticle={onArticle}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
  expect(await screen.findByText(/Withdraw this deployed copy/)).toBeVisible();
  expect(String(fetcher.mock.calls[0]?.[0])).toContain('/publications/publication-a');
  await user.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
  expect(execute).toHaveBeenCalledExactlyOnceWith(action, draft, {
    publicationCode: 'publication-a',
    expectedRevision: '5',
  });
  expect(onArticle).toHaveBeenCalledExactlyOnceWith(draft);
});

it('retires prepared evidence when the current deployment observation changes', async () => {
  const deployment = {
    status: 'DEPLOYED' as const,
    code: 'publication-a',
    sourceRevision: 1,
    activationKey: 'old-key',
    version: 'old-en-1',
    revision: 1,
  };
  const current = controller();
  const element = (revision: number) => (
    <EditorialWithdrawalAction
      action={action}
      article={article}
      deployment={{ ...deployment, revision }}
      controller={current}
      schema={schema}
      onArticle={onArticle}
    />
  );
  const rendered = render(element(1)),
    user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Prepare withdrawal' }));
  expect(
    await screen.findByRole('button', { name: 'Confirm withdrawal' }),
  ).toBeEnabled();
  rendered.rerender(element(2));
  expect(
    screen.queryByRole('button', { name: 'Confirm withdrawal' }),
  ).not.toBeInTheDocument();
  expect(execute).not.toHaveBeenCalled();
});

it('verified absence with a rolled-back retained request offers history without a failing withdrawal command', async () => {
  fetcher.mockResolvedValue(response(owner({ state: 'ROLLED_BACK', revision: 7 })));
  render(
    <EditorialWithdrawalAction
      action={action}
      article={article}
      deployment={{ status: 'NONE', revision: 4 }}
      controller={controller()}
      schema={schema}
      onArticle={onArticle}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Inspect retained request' }));
  expect(await screen.findByText(/there is no withdrawal to perform/)).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Confirm withdrawal' }),
  ).not.toBeInTheDocument();
  expect(execute).not.toHaveBeenCalled();
});
