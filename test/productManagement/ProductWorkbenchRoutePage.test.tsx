import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductWorkbenchRoutePage } from '../../src/operations/productManagement/ProductWorkbenchRoutePage';
import type { WorkbenchRoutePageProps } from '../../src/workbench/WorkbenchRoutePage';
const mocks = vi.hoisted(() => ({ capability: vi.fn(), transport: vi.fn() }));
vi.mock('../../src/operations/productManagement/productAdministrativeClient', () => ({
  loadProductAdministrativeCapability: mocks.capability,
  productAdministrativeTransport: mocks.transport,
}));
vi.mock('../../src/workbench/WorkbenchRoutePage', () => ({
  WorkbenchRoutePage: ({ ownerTransport, ownerHeader }: WorkbenchRoutePageProps) => (
    <div data-testid="workbench-viewport">
      <header>{ownerHeader}</header>
      <span>{ownerTransport?.scopeKey ?? 'Own scope'}</span>
      <input aria-label="Product draft" defaultValue="" />
    </div>
  ),
}));
vi.mock('../../src/operations/shared/ProfileEnterpriseSelector', () => ({
  ProfileEnterpriseSelector: ({
    onChange,
    value,
  }: {
    onChange: (v: { code: string; label: string } | null) => void;
    value: { label: string } | null;
  }) => (
    <div>
      <button onClick={() => onChange({ code: 'RETAIL', label: 'Retail' })}>
        Select Retail
      </button>
      <button onClick={() => onChange(null)}>Clear target</button>
      <span>{value?.label}</span>
    </div>
  ),
}));
const connection = {
  moduleName: 'product',
  instanceId: 'staged',
  endpoint: 'https://owner.test/product',
  environment: 'Local',
  server: 'commerce',
  state: 'UP',
  runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' },
};
const props = {
  accessToken: 'test-token',
  employeeId: 'admin',
  runtime: { enterpriseCode: 'default', requestTimeoutMs: 1000 },
  bootstrap: { tenantCode: 'tenant', moduleConnections: { product: [connection] } },
  routeSchema: { moduleName: 'product', schemaName: 'product' },
} as unknown as WorkbenchRoutePageProps;
describe('Product existing Workbench target selection', () => {
  beforeEach(() => {
    mocks.capability.mockReset().mockResolvedValue({
      labels: {
        title: 'Product management',
        targetEnterpriseCode: 'Product owner Enterprise',
      },
      audit: { actorCode: 'admin' },
    });
    mocks.transport.mockReset().mockImplementation((_c, _connection, target) => ({
      scopeKey: 'Target ' + target,
      fetch: vi.fn(),
    }));
  });
  it('reuses the Workbench, retains drafts across incidental bootstrap refresh and resets on target/auth changes', async () => {
    const view = render(<ProductWorkbenchRoutePage {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Select Retail' }));
    expect(screen.getByTestId('workbench-viewport')).toContainElement(
      screen.getByRole('button', { name: 'Select Retail' }),
    );
    expect(screen.getByText('Target RETAIL')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Product draft'), {
      target: { value: 'Unsaved name' },
    });
    view.rerender(
      <ProductWorkbenchRoutePage
        {...props}
        bootstrap={{
          ...props.bootstrap,
          moduleConnections: { product: [{ ...connection } as never] },
        }}
      />,
    );
    await waitFor(() => expect(mocks.capability).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Product draft')).toHaveValue('Unsaved name');
    expect(screen.getByText('Retail')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
    expect(screen.getByLabelText('Product draft')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Select Retail' }));
    view.rerender(
      <ProductWorkbenchRoutePage {...props} accessToken="new-native-token" />,
    );
    expect(await screen.findByText('Own scope')).toBeVisible();
    expect(screen.queryByText('Target RETAIL')).not.toBeInTheDocument();
  });
  it('surfaces denied administrative capability without inventing a target or hiding the own-scope workbench', async () => {
    mocks.capability.mockRejectedValue(new Error('Denied'));
    render(<ProductWorkbenchRoutePage {...props} />);
    expect(
      await screen.findByText('Cross-enterprise Product management is unavailable.'),
    ).toBeVisible();
    expect(screen.getByText('Own scope')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Select Retail' }),
    ).not.toBeInTheDocument();
  });
});
