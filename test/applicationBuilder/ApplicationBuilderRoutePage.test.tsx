import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ApplicationBuilderRoutePage } from '../../src/operations/applicationBuilder/ApplicationBuilderRoutePage';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import {
  bootstrap,
  navigation,
  runtime,
  configuration,
  info,
  operations,
  plan,
  envelope,
} from './fixture';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(
  post?: (input: RequestInfo | URL, init: RequestInit) => Promise<Response>,
  customInfo: typeof info & { localBuildPresets?: readonly string[] } = info,
) {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      if (init?.method === 'POST')
        return post ? post(input, init) : new Response(JSON.stringify(envelope(plan)));
      return new Response(
        JSON.stringify(
          envelope(
            (typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url
            ).endsWith('/info')
              ? customInfo
              : { operations },
          ),
        ),
      );
    });
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={createAxisQueryClient()}>
        <ApplicationBuilderRoutePage
          accessToken={configuration.accessToken}
          sessionGeneration={1}
          bootstrap={bootstrap}
          runtime={runtime}
          routeNavigation={navigation}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { fetcher, ...view };
}

it('pins generation and reversal to the reviewed receipt and recovers a lost response by reading', async () => {
  const digest = 'sha256:' + '1'.repeat(64);
  const commands: { operation: string; body: Record<string, unknown> }[] = [];
  let state = 'REVIEWED';
  setup(
    (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.endsWith('/setup/plan'))
        return Promise.resolve(Response.json(envelope(plan)));
      const operation = new URL(url).pathname.split('/').at(-1) ?? '';
      if (typeof init.body !== 'string') throw new Error('Expected a JSON request');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      commands.push({ operation, body });
      if (operation === 'generate') {
        state = 'GENERATED';
        return Promise.reject(new Error('Lost acknowledgement'));
      }
      if (operation === 'rollback') state = 'ROLLED_BACK';
      return Promise.resolve(
        Response.json(
          envelope({
            runId: body.runId,
            state,
            applicationName: 'example.app',
            reviewDigest: digest,
            capabilities: ['apparel'],
            plannedFiles: 42,
            artifactCount: state === 'REVIEWED' ? 0 : 42,
          }),
        ),
      );
    },
    { ...info, localBuildPresets: ['apparel'] },
  );
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Review generation' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review generation' }));
  await screen.findByText('Build state: REVIEWED');
  expect(screen.getByRole('button', { name: 'Generate project' })).toBeDisabled();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'I reviewed this exact build' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate project' }));
  await screen.findByText(/outcome could not be confirmed/i);
  expect(screen.getByRole('button', { name: 'Generate project' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Read build receipt' }));
  await screen.findByText('Build state: GENERATED');
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Remove this build’s unchanged files' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reverse build' }));
  await screen.findByText('Build state: ROLLED_BACK');
  expect(commands.map((command) => command.operation)).toEqual([
    'prepare',
    'generate',
    'read',
    'rollback',
  ]);
  expect(commands[1]?.body).toEqual({
    runId: commands[0]?.body.runId,
    reviewDigest: digest,
    confirmed: true,
  });
  expect(commands[3]?.body).toEqual(commands[1]?.body);
});
async function fill() {
  await screen.findByRole('button', { name: 'Review plan' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Approved workspace' }), {
    target: { value: '/approved/customer' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Application name' }), {
    target: { value: 'example.app' },
  });
}
it('presents owner-defined preview, dependencies and dry-run result without any build action', async () => {
  const { fetcher } = setup();
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
  await screen.findByText('Dry run only. Nothing created.');
  expect(
    screen.getByText('Required repositories: nodics.ai, nodics.axis'),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^(build application|create application)$/i }),
  ).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
});
it('keeps unconfigured workspace prerequisites explicit and sends no plan', async () => {
  const { fetcher } = setup(undefined, { ...info, workspaceAccessConfigured: false });
  await screen.findByText('An approved workspace must be selected.');
  expect(screen.queryByRole('button', { name: 'Review plan' })).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0);
});
it('admits only one pending plan and retires a late result when its input changed', async () => {
  let release!: (v: Response) => void;
  const { fetcher } = setup(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
  await waitFor(() =>
    expect(fetcher.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Application name' }), {
    target: { value: 'changed.app' },
  });
  release(new Response(JSON.stringify(envelope(plan))));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Review plan' })).toBeEnabled(),
  );
  expect(screen.queryByText('Reviewed plan')).not.toBeInTheDocument();
});
it('a lost response stays an error and is never a completed build or automatic retry', async () => {
  const { fetcher } = setup(() => Promise.reject(Error('Response unavailable')));
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));
  await screen.findByText(
    'The Builder response could not be confirmed. Nothing was created. Review the inputs and try again.',
  );
  expect(fetcher.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  expect(screen.queryByText('Reviewed plan')).not.toBeInTheDocument();
});
it('a view-only owner action projection cannot submit a plan', async () => {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            envelope(
              (typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url
              ).endsWith('/info')
                ? info
                : { operations },
            ),
          ),
        ),
      ),
    );
  render(
    <MemoryRouter>
      <QueryClientProvider client={createAxisQueryClient()}>
        <ApplicationBuilderRoutePage
          accessToken={configuration.accessToken}
          sessionGeneration={1}
          bootstrap={bootstrap}
          runtime={runtime}
          routeNavigation={{ ...navigation, lifecycleActions: [] }}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('button', { name: 'Review plan' })).toBeDisabled();
  expect(fetcher.mock.calls.every(([, i]) => i?.method !== 'POST')).toBe(true);
});
