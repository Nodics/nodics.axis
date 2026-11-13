/** Fresh Profile task mounting and retirement using the actual adapter and generic form renderer. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { EnterpriseManagementRoutePage } from '../../src/operations/enterprise/EnterpriseManagementRoutePage';
import {
  configuration,
  connection,
  descriptor,
  runtime,
  task,
  workspace,
} from './enterpriseManagementWorkspaceFixtures';

const response = (value: unknown) =>
  new Response(JSON.stringify({ code: 'SUC_PRFL_00000', data: value }));
const show = (actor = 'original-actor', generation = 1) => (
  <MemoryRouter>
    <EnterpriseManagementRoutePage
      bootstrap={configuration.bootstrap}
      connection={connection}
      workspace={descriptor}
      runtime={runtime}
      accessToken={actor}
      sessionGeneration={generation}
      authorizedRoutes={['/profile/enterprises']}
    />
  </MemoryRouter>
);
afterEach(() => vi.unstubAllGlobals());

it('loads owner-defined named choices and the current enterprise instead of a static role field', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(task));
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  render(show());
  expect(await screen.findByRole('heading', { name: workspace.title })).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Enterprise scope' })).toHaveValue(
    configuration.enterpriseCode,
  );
  await user.click(
    screen.getByRole('combobox', { name: 'Additional responsibilities' }),
  );
  expect(screen.getByRole('option', { name: 'Operations colleague' })).toBeVisible();
  expect(screen.getByRole('option', { name: 'Review colleague' })).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('shows an explicit GET retry after refusal, with no uninitialized form fallback', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Owner unavailable',
          messageKey: 'common.test.safe-owner-message',
          messageExposure: 'AUTHENTICATED',
        }),
        { status: 503 },
      ),
    )
    .mockImplementation(() => Promise.resolve(response(task)));
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  render(show());
  expect(await screen.findByText('Owner unavailable')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Assign access' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Assign access' })).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
});

it('retires late definitions from the previous original actor and generation', async () => {
  const pending: ((value: Response) => void)[] = [];
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  vi.stubGlobal('fetch', fetcher);
  const view = render(show());
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const firstSignal = fetcher.mock.calls[0]?.[1]?.signal;
  view.rerender(show('replacement-actor', 2));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(firstSignal?.aborted).toBe(true);
  await act(() =>
    Promise.resolve(
      pending[0]!(
        response({
          ...task,
          workspace: { ...workspace, title: 'Retired actor definitions' },
        }),
      ),
    ),
  );
  expect(
    screen.queryByRole('heading', { name: 'Retired actor definitions' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Assign access' }),
  ).not.toBeInTheDocument();
  await act(() => Promise.resolve(pending[1]!(response(task))));
  expect(await screen.findByRole('button', { name: 'Assign access' })).toBeVisible();
});
