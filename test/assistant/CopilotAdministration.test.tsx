/** @file Governed settings review, denial, bounded parsing and offline/uncertain command coverage. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotAdministrationSession } from '../../src/assistant/CopilotAdministrationRoutePage';
import { parseCopilotSettings } from '../../src/assistant/api/copilotAdministrationClient';
import { settingsPresentationFixture } from './settingsPresentationFixture';
import { refreshAssignmentFixture } from './refreshAssignmentFixture';
import { businessActionControlsFixture } from './businessActionControlsFixture';
const configuration = {
  accessToken: 'token',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const settings = {
  presentation: settingsPresentationFixture,
  contractVersion: 1,
  enterpriseCode: 'enterprise',
  revision: 'a'.repeat(64),
  approvalRequired: true,
  sections: [
    {
      code: 'allocations',
      scope: 'ENTERPRISE',
      title: 'Recurring allocations',
      editable: true,
      fields: [
        {
          id: 'enterprise',
          label: 'Enterprise default',
          kind: 'number',
          value: 100,
          maximum: 500,
        },
      ],
    },
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('reviews tenant-wide business controls without editing owner routing or activating execution', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation((url) => {
    const path = url instanceof Request ? url.url : url.toString();
    if (path.endsWith('/preview'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        section: 'business-actions',
        approvalRequired: true,
        previewDigest: 'b'.repeat(64),
        changes: [
          { label: 'Inspect original business results', before: false, after: true },
        ],
      });
    if (path.endsWith('/requests'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        code: 'business-controls-review',
        status: 'REQUESTED',
      });
    if (path.includes('/history'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        page: 1,
        limit: 25,
        mayHaveMore: false,
        items: [],
      });
    return response({ ...settings, sections: [businessActionControlsFixture] });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<CopilotAdministrationSession configuration={configuration} />);
  const recovery = await screen.findByRole('checkbox', {
    name: 'Inspect original business results',
  });
  expect(screen.getByText(settingsPresentationFixture.tenantScope)).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  await userEvent.click(recovery);
  await userEvent.type(
    screen.getByLabelText('Reason for change'),
    'Preserve inspection while writes remain disabled',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review proposal' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Submit for approval' }),
  );
  await screen.findByText('Awaiting runtime approval: business-controls-review');
  const commands = fetcher.mock.calls.filter((call) => call[1]?.method === 'POST');
  expect(commands).toHaveLength(2);
  const body = commands[1]![1]!.body;
  if (typeof body !== 'string') throw new Error('Expected JSON body');
  expect(JSON.parse(body)).toMatchObject({
    section: 'business-actions',
    values: { invitations: false, prices: false, planning: false, recovery: true },
  });
  for (const [url] of commands)
    expect(url instanceof Request ? url.url : url.toString()).toMatch(
      /\/administration\/(preview|requests)$/,
    );
  expect(screen.queryByRole('button', { name: /Activate|Execute/ })).toBeNull();
});

it('reviews and submits a publisher assignment only through runtime governance', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation((url) => {
    const path = url instanceof Request ? url.url : url.toString();
    if (path.endsWith('/preview'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        section: 'refresh-publisher-new',
        approvalRequired: true,
        previewDigest: 'b'.repeat(64),
        changes: [
          { label: 'Publisher service identity', before: '', after: 'source-runtime' },
        ],
      });
    if (path.endsWith('/requests'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        status: 'REQUESTED',
        code: 'request-1',
      });
    if (path.includes('/history'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        page: 1,
        limit: 25,
        mayHaveMore: false,
        items: [],
      });
    return response({ ...settings, sections: [refreshAssignmentFixture] });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<CopilotAdministrationSession configuration={configuration} />);
  await userEvent.type(
    await screen.findByLabelText('Publisher service identity'),
    'source-runtime',
  );
  await userEvent.type(screen.getByLabelText('Process definition'), 'refresh-guides');
  expect(
    screen.getByRole('spinbutton', { name: 'Published Process version' }),
  ).toHaveAttribute('min', '1');
  await userEvent.type(
    screen.getByLabelText('Reason for change'),
    'Approved source publisher',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review proposal' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Submit for approval' }),
  );
  await screen.findByText('Awaiting runtime approval: request-1');
  const commands = fetcher.mock.calls.filter((call) => call[1]?.method === 'POST');
  expect(commands).toHaveLength(2);
  const body = commands[1]![1]?.body;
  if (typeof body !== 'string') throw new Error('Expected JSON body');
  expect(JSON.parse(body)).toMatchObject({
    section: 'refresh-publisher-new',
    values: {
      assigned: true,
      sourceCode: 'framework-guides',
      publisherId: 'source-runtime',
      definitionCode: 'refresh-guides',
      version: 1,
    },
  });
  for (const [url] of commands)
    expect(url instanceof Request ? url.url : url.toString()).toMatch(
      /\/administration\/(preview|requests)$/,
    );
});

it('accepts bounded decimal profile controls without allowing fractional token limits', () => {
  const profile = {
    ...settings,
    sections: [
      {
        ...settings.sections[0]!,
        fields: [
          {
            id: 'temperature',
            label: 'Temperature',
            kind: 'number',
            value: 0.15,
            maximum: 2,
            step: 0.01,
          },
        ],
      },
    ],
  };
  expect(parseCopilotSettings(profile, 'enterprise').sections[0]!.fields[0]!.step).toBe(
    0.01,
  );
  expect(() =>
    parseCopilotSettings(
      {
        ...profile,
        sections: [
          {
            ...profile.sections[0],
            fields: [{ ...profile.sections[0]!.fields[0], step: 1 }],
          },
        ],
      },
      'enterprise',
    ),
  ).toThrow();
  expect(() =>
    parseCopilotSettings(
      {
        ...profile,
        sections: [
          {
            ...profile.sections[0],
            fields: [{ ...profile.sections[0]!.fields[0], value: 3 }],
          },
        ],
      },
      'enterprise',
    ),
  ).toThrow();
});
/** Returns canonical success envelopes. */
function response(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ code: 'SUC_TEST', data })));
}
/** Mounts the real transport and renderer with bounded server fixtures. */
function mount(failSubmit = false) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation((url) => {
    const path = url instanceof Request ? url.url : url.toString();
    if (path.includes('/administration/history'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        page: 1,
        limit: 25,
        mayHaveMore: false,
        items: [],
      });
    if (path.endsWith('/preview'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        section: 'allocations',
        approvalRequired: true,
        previewDigest: 'b'.repeat(64),
        changes: [{ label: 'Enterprise default', before: 100, after: 90 }],
      });
    if (path.endsWith('/requests')) {
      if (failSubmit) return Promise.reject(new Error('Lost acknowledgement'));
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        status: 'REQUESTED',
        code: 'request-1',
      });
    }
    return response(settings);
  });
  vi.stubGlobal('fetch', fetcher);
  render(<CopilotAdministrationSession configuration={configuration} />);
  return fetcher;
}
/** Edits and requests the explicit server review. */
async function review() {
  const input = await screen.findByLabelText('Enterprise default');
  await userEvent.clear(input);
  await userEvent.type(input, '90');
  await userEvent.type(screen.getByLabelText('Reason for change'), 'Capacity review');
  await userEvent.click(screen.getByRole('button', { name: 'Review proposal' }));
}
it('reviews then submits one request without applying configuration', async () => {
  const fetcher = mount();
  await review();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Submit for approval' }),
  );
  await screen.findByText('Awaiting runtime approval: request-1');
  const commands = fetcher.mock.calls.filter((call) => call[1]?.method === 'POST');
  expect(commands).toHaveLength(2);
  const body = commands[1]![1]!.body;
  if (typeof body !== 'string') throw new Error('Expected JSON body');
  expect(JSON.parse(body)).toMatchObject({
    previewDigest: 'b'.repeat(64),
    values: { enterprise: 90 },
  });
  expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
});
it('invalidates review after edits and blocks an uncertain submission from replay', async () => {
  const fetcher = mount(true);
  await review();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Submit for approval' }),
  );
  await screen.findByText(/Submission outcome is unknown/);
  expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST'),
    ).toHaveLength(2),
  );
});
it('does not queue commands while offline', async () => {
  const fetcher = mount();
  await screen.findByLabelText('Enterprise default');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await review();
  await screen.findByText('Offline. No request was sent.');
  expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(
    0,
  );
});
it('renders owner section identifiers containing enum underscores', async () => {
  const code = 'audit-retention-TRANSCRIPT_ACCESS';
  const payload = {
    ...settings,
    sections: [{ ...settings.sections[0]!, code }],
  };
  expect(parseCopilotSettings(payload, 'enterprise').sections[0]!.code).toBe(code);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(payload)));
  render(<CopilotAdministrationSession configuration={configuration} />);
  expect(await screen.findByLabelText('Enterprise default')).toBeInTheDocument();
  expect(screen.queryByText('Settings unavailable.')).toBeNull();
  for (const invalid of [
    'audit/retention',
    'audit retention',
    '_audit',
    'a'.repeat(65),
  ]) {
    expect(() =>
      parseCopilotSettings(
        {
          ...payload,
          sections: [{ ...payload.sections[0]!, code: invalid }],
        },
        'enterprise',
      ),
    ).toThrow('Invalid settings section');
  }
});

it('rejects foreign scope, duplicate fields and invalid numeric limits', () => {
  expect(() => parseCopilotSettings(settings, 'foreign')).toThrow();
  const copy = structuredClone(settings);
  copy.sections[0]!.fields.push(copy.sections[0]!.fields[0]!);
  expect(() => parseCopilotSettings(copy, 'enterprise')).toThrow();
  copy.sections[0]!.fields = [{ ...copy.sections[0]!.fields[0]!, value: 501 }];
  expect(() => parseCopilotSettings(copy, 'enterprise')).toThrow();
});

it('renders owner-defined automation controls, scope and bounded age without granting or starting jobs', async () => {
  const automation = {
    ...settings,
    sections: [
      {
        code: 'automation',
        scope: 'TENANT_RUNTIME',
        title: 'Knowledge automation',
        editable: true,
        fields: [
          {
            id: 'publication',
            label: 'Atomic generation publication',
            kind: 'boolean',
            value: false,
          },
          {
            id: 'minimumPendingAgeMs',
            label: 'Minimum pending-writer age (milliseconds)',
            kind: 'number',
            value: 300000,
            minimum: 60000,
            maximum: 86400000,
          },
        ],
      },
    ],
  };
  const fetcher = vi.fn<typeof fetch>().mockImplementation((url) => {
    const path = url instanceof Request ? url.url : url.toString();
    if (path.endsWith('/preview'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        section: 'automation',
        approvalRequired: true,
        previewDigest: 'b'.repeat(64),
        changes: [
          { label: 'Atomic generation publication', before: false, after: true },
        ],
      });
    if (path.includes('/history'))
      return response({
        contractVersion: 1,
        enterpriseCode: 'enterprise',
        page: 1,
        limit: 25,
        mayHaveMore: false,
        items: [],
      });
    return response(automation);
  });
  vi.stubGlobal('fetch', fetcher);
  render(<CopilotAdministrationSession configuration={configuration} />);
  const checkbox = await screen.findByRole('checkbox', {
    name: 'Atomic generation publication',
  });
  expect(screen.getByText(settingsPresentationFixture.tenantScope)).toBeInTheDocument();
  const age = screen.getByRole('spinbutton', {
    name: 'Minimum pending-writer age (milliseconds)',
  });
  expect(age).toHaveAttribute('min', '60000');
  expect(age).toHaveAttribute('max', '86400000');
  await userEvent.click(checkbox);
  await userEvent.type(screen.getByLabelText('Reason for change'), 'Controlled test');
  await userEvent.click(screen.getByRole('button', { name: 'Review proposal' }));
  await screen.findByRole('button', { name: 'Submit for approval' });
  const commands = fetcher.mock.calls.filter((call) => call[1]?.method === 'POST');
  expect(commands).toHaveLength(1);
  const url = commands[0]![0];
  expect(url instanceof Request ? url.url : url.toString()).toMatch(
    /\/administration\/preview$/,
  );
  const body = commands[0]![1]?.body;
  if (typeof body !== 'string') throw new Error('Expected JSON request');
  expect(JSON.parse(body)).toMatchObject({
    section: 'automation',
    values: { publication: true, minimumPendingAgeMs: 300000 },
  });
  await userEvent.click(checkbox);
  expect(screen.queryByRole('button', { name: 'Submit for approval' })).toBeNull();
});
