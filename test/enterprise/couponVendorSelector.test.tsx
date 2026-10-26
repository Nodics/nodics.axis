import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ProfileEnterpriseSelector } from '../../src/operations/shared/ProfileEnterpriseSelector';
import { searchProfileEnterprises } from '../../src/operations/shared/profileEnterpriseLookup';
import type { ProfileEnterpriseOption } from '../../src/operations/shared/profileEnterpriseLookup';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';
import type { WorkbenchSchema } from '../../src/workbench/api/workbenchContracts';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));
vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({
    endpoint: 'https://profile.test',
    moduleName: 'profile',
  })),
}));
const configuration = {
  bootstrap: {} as AxisAuthenticatedBootstrap,
  accessToken: 'token',
  enterpriseCode: 'issuer',
  timeoutMs: 1000,
};
const schema: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'enterprise',
  label: 'Enterprise',
  description: '',
  mutationMode: 'READ_ONLY',
  operations: [],
  relationships: [],
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: true,
      primary: true,
      description: '',
      searchable: true,
    },
  ],
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    searchableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    sortableFields: ['code'],
    defaultSort: { field: 'code', direction: 'ASC' },
    allowedPageSizes: [10],
    defaultPageSize: 10,
    maximumPageSize: 50,
  },
};
function fixtures() {
  vi.mocked(loadWorkbenchSchemas).mockResolvedValue([schema]);
  vi.mocked(loadWorkbenchRecords).mockResolvedValue({
    records: [
      { code: 'market', name: 'Marketplace', active: true },
      { code: 'inactive', active: false },
    ],
    totalCount: 2,
    pageNumber: 1,
    pageSize: 10,
    sort: { field: 'code', direction: 'ASC' },
  });
}
afterEach(() => vi.clearAllMocks());
it('reuses Profile discovery and bounded search without replacing issuer configuration', async () => {
  fixtures();
  expect(await searchProfileEnterprises(configuration, 'market')).toEqual([
    { code: 'market', label: 'Marketplace (market)' },
  ]);
  expect(loadWorkbenchRecords).toHaveBeenCalledWith(
    expect.objectContaining({ moduleName: 'profile' }),
    expect.anything(),
    configuration,
    expect.objectContaining({ search: 'market', pageNumber: 1, pageSize: 10 }),
    expect.anything(),
    undefined,
  );
});
it('lookup remains optional and only a returned active Enterprise can be selected', async () => {
  fixtures();
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <ProfileEnterpriseSelector
      label="Vendor enterprise (optional)"
      configuration={configuration}
      value={null}
      onChange={onChange}
      disabled={false}
    />,
  );
  expect(loadWorkbenchRecords).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('combobox', { name: 'Vendor enterprise (optional)' }),
  );
  await user.click(await screen.findByRole('option', { name: 'Marketplace (market)' }));
  expect(onChange).toHaveBeenCalledWith({
    code: 'market',
    label: 'Marketplace (market)',
  });
  expect(screen.queryByRole('option', { name: 'inactive' })).not.toBeInTheDocument();
});
it('denied lookup remains an error and does not create a manual code fallback', async () => {
  fixtures();
  vi.mocked(loadWorkbenchRecords).mockRejectedValue(new Error('denied'));
  const user = userEvent.setup(),
    onChange = vi.fn();
  render(
    <ProfileEnterpriseSelector
      label="Vendor enterprise (optional)"
      configuration={configuration}
      value={null}
      onChange={onChange}
      disabled={false}
    />,
  );
  await user.click(
    screen.getByRole('combobox', { name: 'Vendor enterprise (optional)' }),
  );
  await screen.findByText('Enterprise lookup is unavailable.');
  await user.type(screen.getByRole('combobox'), 'invented');
  await waitFor(() => expect(onChange).not.toHaveBeenCalled());
});
it('rejects duplicate or malformed lookup handles', async () => {
  fixtures();
  const page = {
    totalCount: 2,
    pageNumber: 1,
    pageSize: 10,
    sort: { field: 'code', direction: 'ASC' as const },
  };
  for (const records of [
    [
      { code: 'x', active: true },
      { code: 'x', active: true },
    ],
    [{ code: '$query', active: true }],
  ]) {
    vi.mocked(loadWorkbenchRecords).mockResolvedValue({ ...page, records });
    await expect(searchProfileEnterprises(configuration, '')).rejects.toThrow();
  }
});

it('retires old lookup responses and never substitutes the selected target for signed configuration', async () => {
  fixtures();
  type Page = Awaited<ReturnType<typeof loadWorkbenchRecords>>;
  let resolveOld!: (page: Page) => void;
  vi.mocked(loadWorkbenchRecords).mockImplementationOnce(
    () =>
      new Promise<Page>((resolve) => {
        resolveOld = resolve;
      }),
  );
  const user = userEvent.setup(),
    onChange = vi.fn();
  const props = {
    label: 'Target enterprise',
    configuration,
    value: null,
    onChange,
    disabled: false,
  };
  const { rerender } = render(<ProfileEnterpriseSelector {...props} />);
  await user.click(screen.getByRole('combobox'));
  await waitFor(() => expect(loadWorkbenchRecords).toHaveBeenCalledTimes(1));
  const oldSignal = vi.mocked(loadWorkbenchRecords).mock.calls[0]?.[5];
  const next = { ...configuration, accessToken: 'replacement-session' };
  rerender(<ProfileEnterpriseSelector {...props} configuration={next} />);
  expect(oldSignal?.aborted).toBe(true);
  await screen.findByRole('option', { name: 'Marketplace (market)' });
  act(() =>
    resolveOld({
      records: [{ code: 'obsolete', active: true }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 10,
      sort: { field: 'code', direction: 'ASC' },
    }),
  );
  expect(screen.queryByRole('option', { name: 'obsolete' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Marketplace (market)' }));
  expect(onChange).toHaveBeenCalledWith({
    code: 'market',
    label: 'Marketplace (market)',
  });
  expect(vi.mocked(loadWorkbenchRecords).mock.calls.at(-1)?.[2]).toBe(next);
  expect(next.enterpriseCode).toBe('issuer');
});

// Endpoint-independent design fixture: target identity keys private review state, not authentication.
function ReviewFixture() {
  const [inspection, setInspection] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  return (
    <>
      <input
        aria-label="Inspected offer"
        value={inspection}
        onChange={(event) => setInspection(event.target.value)}
      />
      <button onClick={() => setConfirmation(true)}>Review</button>
      {confirmation && <div role="dialog">Pending confirmation</div>}
    </>
  );
}
function TargetFixture() {
  const [target, setTarget] = useState<ProfileEnterpriseOption | null>(null);
  return (
    <>
      <ProfileEnterpriseSelector
        label="Target enterprise"
        configuration={configuration}
        value={target}
        onChange={setTarget}
        disabled={false}
      />
      <ReviewFixture key={target?.code || 'own-scope'} />
    </>
  );
}
it('target selection and clearing reset private inspection and confirmation without identity switching', async () => {
  fixtures();
  const user = userEvent.setup();
  render(<TargetFixture />);
  await user.type(
    screen.getByRole('textbox', { name: 'Inspected offer' }),
    'old-offer',
  );
  await user.click(screen.getByRole('button', { name: 'Review' }));
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: 'Marketplace (market)' }));
  expect(screen.getByRole('textbox', { name: 'Inspected offer' })).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.type(
    screen.getByRole('textbox', { name: 'Inspected offer' }),
    'target-offer',
  );
  await user.click(screen.getByRole('button', { name: 'Review' }));
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.getByRole('textbox', { name: 'Inspected offer' })).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(configuration.enterpriseCode).toBe('issuer');
});
