import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { SchemaQueryBuilderRenderer } from '../../../../../src/cms/renderers/components/query/SchemaQueryBuilderRenderer';
import type { WorkbenchRendererController } from '../../../../../src/cms/renderers/shared/rendererTypes';
import type { AxisAuthenticatedBootstrap } from '../../../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../../../src/runtime/runtimeConfig';
import type { WorkbenchSchema } from '../../../../../src/workbench/api/workbenchContracts';

const component: CmsComponentContract = {
  code: 'axisSchemaQueryBuilderComponent',
  typeCode: 'axisSchemaQueryBuilderComponentType',
  renderer: 'axis.component.schema-query-builder',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    addConditionLabel: 'Add condition',
    addGroupLabel: 'Add group',
    applyFiltersLabel: 'Apply filters',
    clearFiltersLabel: 'Clear filters',
    filterBuilderLabel: 'Advanced filters',
    filterFieldLabel: 'Field',
    filterMatchLabel: 'Match',
    filterOperatorLabel: 'Operator',
    filterValueLabel: 'Value',
    requestPreviewLabel: 'Request preview',
    removeFilterLabel: 'Remove',
    sortBuilderLabel: 'Sort results',
    sortDirectionLabel: 'Direction',
    sortFieldLabel: 'Sort field',
  },
  slot: 'content',
  index: 10,
  components: [],
};

const selectedSchema: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'address',
  label: 'Address',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    defaultSort: { field: 'code', direction: 'ASC' },
    filterFields: [
      {
        field: 'city',
        label: 'City',
        operators: ['EQUALS', 'CONTAINS'],
        type: 'string',
      },
    ],
    groupOperators: ['AND', 'OR'],
    maximumPageSize: 50,
    searchableFields: ['code', 'city'],
    sortableFields: ['code', 'city'],
    textOperator: 'CONTAINS',
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read'],
  fields: [],
  relationships: [],
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    screenLockEnabled: true,
    source: 'DEFAULT',
  },
  documentationSources: [],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {},
  navigation: [],
  tenantCode: 'default',
};

const runtime: AxisRuntimeConfig = {
  assistantIdleTimeoutMs: 1_000,
  assistantMaximumEventBytes: 1_024,
  assistantReconnectWindowMs: 1_000,
  backofficeBaseUrl: 'http://localhost:3000',
  browserSessionCsrfCookieName: 'csrf',
  clientContractVersion: 1,
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  requestTimeoutMs: 1_000,
};

function workbenchController(
  overrides: Partial<WorkbenchRendererController>,
): WorkbenchRendererController {
  return {
    accessToken: 'employee-token',
    applyView: vi.fn(),
    beginCreate: vi.fn(),
    beginDelete: vi.fn(),
    beginEdit: vi.fn(),
    bootstrap,
    bulkDeleteSelected: vi.fn(),
    cancelCreate: vi.fn(),
    cancelDelete: vi.fn(),
    cancelEdit: vi.fn(),
    confirmDelete: vi.fn(),
    createOpen: false,
    createRecord: vi.fn(),
    creating: false,
    deleteOpen: false,
    deleting: false,
    deleteView: vi.fn(),
    editOpen: false,
    enterpriseCode: 'default',
    favoriteSchemas: [],
    recentSchemas: [],
    recordFilters: undefined,
    recordPageNumber: 1,
    recordPageSize: 25,
    recordSearch: '',
    recordSort: { field: 'code', direction: 'ASC' },
    recordTotalCount: 0,
    records: [],
    recordsLoading: false,
    relationshipRuntime: {
      createRecord: vi.fn(),
      loadRecords: vi.fn(),
      queryScope: [],
      schemas: [],
    },
    retryRecords: vi.fn(),
    retrySchemas: vi.fn(),
    runtime,
    saveView: vi.fn(),
    schemas: selectedSchema ? [selectedSchema] : [],
    schemasLoading: false,
    selectRecord: vi.fn(),
    selectSchema: vi.fn(),
    selectedRecordKeys: [],
    selectedSchema,
    setRecordFilters: vi.fn(),
    setRecordPageNumber: vi.fn(),
    setRecordPageSize: vi.fn(),
    setRecordSearch: vi.fn(),
    setRecordSort: vi.fn(),
    setRecordSortOverride: vi.fn(),
    setSelectedRecordKeys: vi.fn(),
    setVisibleColumns: vi.fn(),
    tenantCode: 'default',
    toggleFavoriteSchema: vi.fn(),
    updateRecord: vi.fn(),
    updating: false,
    visibleColumns: [],
    savedViews: [],
    closeRecord: vi.fn(),
    ...overrides,
  };
}

describe('SchemaQueryBuilderRenderer', () => {
  it('renders CMS-owned copy and emits backend-scoped filters', async () => {
    const user = userEvent.setup();
    const setRecordFilters = vi.fn();
    const setRecordSort = vi.fn();

    render(
      <SchemaQueryBuilderRenderer
        actions={{
          workbench: workbenchController({
            recordFilters: undefined,
            recordSort: { field: 'code', direction: 'ASC' },
            selectedSchema,
            setRecordFilters,
            setRecordSort,
          }),
        }}
        component={component}
      />,
    );

    expect(screen.getByText('Advanced filters')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.type(screen.getByRole('textbox', { name: 'Value' }), 'Dubai');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(setRecordFilters).toHaveBeenCalledWith({
      operator: 'AND',
      items: [{ field: 'city', operator: 'EQUALS', value: 'Dubai' }],
    });
    expect(setRecordSort).not.toHaveBeenCalled();
  });

  it('renders nothing without a selected backend schema', () => {
    const { container } = render(
      <SchemaQueryBuilderRenderer
        actions={{
          workbench: workbenchController({
            recordFilters: undefined,
            recordSort: { field: 'code', direction: 'ASC' },
            selectedSchema: undefined,
            setRecordFilters: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride: vi.fn(),
          }),
        }}
        component={component}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
