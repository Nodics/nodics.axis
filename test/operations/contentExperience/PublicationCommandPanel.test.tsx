import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../../src/bootstrap/publicBootstrap';
import { PublicationCommandPanel } from '../../../src/operations/contentExperience/PublicationCommandPanel';
import type { PublicationInspection } from '../../../src/operations/contentExperience/api/publicationInspectionClient';
const source = {
  moduleName: 'publish',
  endpoint: 'http://localhost:4312/nodics/publish',
  instanceId: 'source-a',
  state: 'UP',
} as AxisModuleConnection;
const action = {
  id: 'retry',
  label: 'Retry original operation',
  intent: 'RETRY',
  permission: 'publish.lifecycle.retry',
  ownerModule: 'publish',
  operationRoute: '/publications/:publicationCode/retry',
  httpMethod: 'POST',
  featureState: 'ACTIVE',
  targetStatuses: ['FAILED'],
  order: 1,
} as AxisNavigationLifecycleAction;
const snapshot: PublicationInspection = {
  code: 'request-a',
  state: 'FAILED',
  revision: 7,
  domain: 'editorial',
  rootType: 'article',
  rootCode: 'article-a',
  sourceVersion: '2',
  operatorOperations: ['retry'],
  operatorGuidance: 'Resume the original failed operation.',
};
const receipt = { ...snapshot, state: 'WITHDRAWN', revision: 9 };
const response = (result: unknown, status = 200) =>
  Response.json({ code: 'SUC_PUB_00000', result }, { status });
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>,
  completed: ReturnType<typeof vi.fn<(receipt: PublicationInspection) => void>>,
  busy: ReturnType<typeof vi.fn<(busy: boolean) => void>>;
const view = (
  changes: Partial<React.ComponentProps<typeof PublicationCommandPanel>> = {},
  key = 'actor-a',
) => (
  <PublicationCommandPanel
    key={key}
    source={source}
    configuration={{
      accessToken: 'private-token',
      enterpriseCode: 'acme',
      timeoutMs: 1000,
    }}
    snapshot={snapshot}
    actions={[action]}
    readAvailable
    observationEpoch={1}
    onBusy={busy}
    onCompleted={completed}
    {...changes}
  />
);
beforeEach(() => {
  fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(snapshot))
    .mockResolvedValue(response(receipt));
  vi.stubGlobal('fetch', fetcher);
  completed = vi.fn();
  busy = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());
const prepare = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Retry original operation' }));
  await screen.findByRole('button', { name: 'Confirm retry' });
  return user;
};
it('prepares with a fresh GET and requires explicit confirmation for one original command', async () => {
  render(view());
  const user = await prepare();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
  expect(completed).not.toHaveBeenCalled();
  await user.type(
    screen.getByRole('textbox', { name: 'Reason (optional)' }),
    'Confirm original withdrawal',
  );
  await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
  expect(await screen.findByText(/owner acknowledged withdrawn/)).toBeVisible();
  expect(completed).toHaveBeenCalledWith(expect.objectContaining(receipt));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    JSON.parse(
      typeof fetcher.mock.calls[1]?.[1]?.body === 'string'
        ? fetcher.mock.calls[1][1].body
        : 'null',
    ) as unknown,
  ).toEqual({
    expectedRevision: 7,
    reason: 'Confirm original withdrawal',
  });
});
it('a changed preparation stays held until fresh parent inspection and another explicit preparation', async () => {
  fetcher
    .mockReset()
    .mockImplementation(() => Promise.resolve(response({ ...snapshot, revision: 8 })));
  const rendered = render(view());
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Retry original operation' }));
  expect(await screen.findByText(/permitted operation changed/)).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Prepare from refreshed evidence' }),
  ).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(1);
  rendered.rerender(
    view({ snapshot: { ...snapshot, revision: 8 }, observationEpoch: 2 }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Prepare from refreshed evidence' }),
  );
  await user.click(screen.getByRole('button', { name: 'Retry original operation' }));
  expect(await screen.findByText(/Publication revision 8/)).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
    true,
  );
});
it('permission removal retires a prepared command before POST', async () => {
  const rendered = render(view());
  await prepare();
  rendered.rerender(view({ actions: [] }));
  expect(screen.getByRole('button', { name: 'Confirm retry' })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('uncertain completion holds without replay and requires a later fresh observation', async () => {
  fetcher
    .mockReset()
    .mockResolvedValueOnce(response(snapshot))
    .mockRejectedValueOnce(new Error('Response lost'));
  render(view());
  const user = await prepare();
  await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
  expect(await screen.findByText('Response lost')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Prepare from refreshed evidence' }),
  ).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Confirm retry' }),
  ).not.toBeInTheDocument();
  expect(completed).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('a retired actor cannot receive a late original command acknowledgement', async () => {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  fetcher
    .mockReset()
    .mockResolvedValueOnce(response(snapshot))
    .mockReturnValueOnce(pending);
  const rendered = render(view()),
    user = await prepare();
  await user.dblClick(screen.getByRole('button', { name: 'Confirm retry' }));
  expect(fetcher).toHaveBeenCalledTimes(2);
  rendered.rerender(view({}, 'actor-b'));
  await act(async () => {
    resolve(response(receipt));
    await pending;
  });
  expect(completed).not.toHaveBeenCalled();
});
it('business ineligibility, duplicate metadata and failed current reads offer no command', () => {
  const rendered = render(view({ snapshot: { ...snapshot, operatorOperations: [] } }));
  expect(
    screen.queryByRole('button', { name: /Prepare retry/ }),
  ).not.toBeInTheDocument();
  rendered.rerender(view({ actions: [action, { ...action }] }));
  expect(
    screen.queryByRole('button', { name: /Prepare retry/ }),
  ).not.toBeInTheDocument();
  rendered.rerender(view({ readAvailable: false }));
  expect(
    screen.getByRole('button', { name: 'Retry original operation' }),
  ).toBeDisabled();
  expect(fetcher).not.toHaveBeenCalled();
});

it('permission removal during an original command retires its late receipt without replay', async () => {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  fetcher
    .mockReset()
    .mockResolvedValueOnce(response(snapshot))
    .mockReturnValueOnce(pending);
  const rendered = render(view()),
    user = await prepare();
  await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
  rendered.rerender(view({ actions: [] }));
  await act(async () => {
    resolve(response(receipt));
    await pending;
  });
  expect(await screen.findByText(/Access or request evidence changed/)).toBeVisible();
  expect(completed).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
