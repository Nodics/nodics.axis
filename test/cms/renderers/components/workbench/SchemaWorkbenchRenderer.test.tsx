import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { SchemaWorkbenchRenderer } from '../../../../../src/cms/renderers/components/workbench/SchemaWorkbenchRenderer';
import type { WorkbenchRendererController } from '../../../../../src/cms/renderers/shared/rendererTypes';
import type { AxisAuthenticatedBootstrap } from '../../../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../../../src/runtime/runtimeConfig';
import type { WorkbenchSchema } from '../../../../../src/workbench/api/workbenchContracts';

const component: CmsComponentContract = {
  code: 'axisSchemaWorkbenchComponent',
  typeCode: 'axisSchemaWorkbenchComponentType',
  renderer: 'axis.component.schema-workbench',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    title: 'Business data',
    introduction: 'Use authorized data types.',
    schemaSearchLabel: 'Find a data type',
    schemaSearchPlaceholder: 'Search types',
    schemasLabel: 'Available data types',
    recordsLabel: 'Records',
    noSchemasLabel: 'No data types',
    noRecordsLabel: 'No records',
    selectSchemaLabel: 'Select a data type',
    loadingLabel: 'Loading data',
    retryLabel: 'Try again',
    createLabel: 'Create',
    cancelLabel: 'Cancel',
    savingLabel: 'Saving',
    selectExistingLabel: 'Select existing',
    createRelatedLabel: 'Create related',
    editRelatedLabel: 'Edit related',
    addToDraftLabel: 'Add to draft',
    loadMoreRelatedLabel: 'Load more',
    manySelectionHintLabel: 'Select one or more related records.',
    removeRelatedLabel: 'Close',
    noRelatedRecordsLabel: 'No related records',
    pendingReferencesLabel: 'Pending create',
    relatedSearchLabel: 'Search related records',
    relatedResultsLabel: '{shown} shown from {total}',
    removeReferenceLabel: 'Remove',
    actionsLabel: 'Actions',
    selectedReferencesLabel: 'Selected existing',
    singleSelectionHintLabel: 'Selecting a record replaces the current reference.',
    viewLabel: 'View',
    editLabel: 'Edit',
    updateLabel: 'Update',
    updatingLabel: 'Updating',
    closeLabel: 'Close',
    trueLabel: 'Yes',
    falseLabel: 'No',
    deleteLabel: 'Delete',
    deletingLabel: 'Deleting',
    confirmDeleteLabel: 'Delete record',
    deleteTitle: 'Delete this record?',
    deleteWarning: 'This action cannot be undone.',
    tenantLabel: 'Tenant',
    enterpriseLabel: 'Enterprise',
    searchRecordsLabel: 'Search records',
    searchRecordsPlaceholder: 'Search values',
    moduleLabel: 'Owning module',
    availableOperationsLabel: 'Available operations',
    resultsLabel: 'records',
    pageSizeLabel: 'Records per page',
    paginationLabel: 'Record pages',
    filterBuilderLabel: 'Advanced filters',
    addConditionLabel: 'Add condition',
    addGroupLabel: 'Add group',
    applyFiltersLabel: 'Apply filters',
    clearFiltersLabel: 'Clear filters',
    filterFieldLabel: 'Field',
    filterOperatorLabel: 'Operator',
    filterValueLabel: 'Value',
    filterMatchLabel: 'Match',
    removeFilterLabel: 'Remove',
    requestPreviewLabel: 'Request preview',
    addFavouriteLabel: 'Add favourite',
    removeFavouriteLabel: 'Remove favourite',
    gridSettingsLabel: 'Grid settings',
    savedViewNameLabel: 'View name',
    saveViewLabel: 'Save view',
    selectVisibleRecordsLabel: 'Select visible records',
    selectRecordLabel: 'Select record',
    selectedRecordsLabel: 'records selected',
  },
  slot: 'content',
  index: 20,
  components: [],
};

const address: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'address',
  label: 'Address',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    searchableFields: ['code', 'city'],
    sortableFields: ['code', 'city'],
    filterFields: [
      {
        field: 'city',
        label: 'City',
        type: 'string',
        operators: ['EQUALS', 'CONTAINS'],
      },
    ],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update', 'delete'],
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      searchable: true,
    },
    {
      name: 'city',
      label: 'City',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
  ],
  relationships: [],
};

const relationshipRuntime = {
  schemas: [address],
  queryScope: ['default'],
  createRecord: vi.fn(),
  loadRecords: vi.fn(),
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
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

function schemaVariant(
  label: string,
  moduleName: string,
  schemaName: string,
): WorkbenchSchema {
  return {
    ...address,
    moduleName,
    schemaName,
    label,
  };
}

function workbenchController(
  overrides: Partial<WorkbenchRendererController> = {},
): WorkbenchRendererController {
  return {
    accessToken: 'employee-token',
    bootstrap,
    runtime,
    schemas: [address],
    schemasLoading: false,
    selectedSchema: address,
    records: [],
    recordSearch: '',
    recordPageNumber: 1,
    recordPageSize: 25,
    recordTotalCount: 0,
    recordSort: { field: 'code', direction: 'ASC' },
    visibleColumns: ['code', 'city'],
    favoriteSchemas: [],
    recentSchemas: [],
    selectedRecordKeys: [],
    savedViews: [],
    recordsLoading: false,
    creating: false,
    createOpen: false,
    relationshipRuntime,
    editOpen: false,
    updating: false,
    deleteOpen: false,
    deleting: false,
    tenantCode: 'default',
    enterpriseCode: 'default',
    selectSchema: vi.fn(),
    setRecordSearch: vi.fn(),
    setRecordFilters: vi.fn(),
    setRecordPageNumber: vi.fn(),
    setRecordPageSize: vi.fn(),
    setRecordSort: vi.fn(),
    setRecordSortOverride: vi.fn(),
    setVisibleColumns: vi.fn(),
    toggleFavoriteSchema: vi.fn(),
    setSelectedRecordKeys: vi.fn(),
    saveView: vi.fn(),
    deleteView: vi.fn(),
    applyView: vi.fn(),
    beginCreate: vi.fn(),
    cancelCreate: vi.fn(),
    createRecord: vi.fn(),
    selectRecord: vi.fn(),
    closeRecord: vi.fn(),
    beginEdit: vi.fn(),
    cancelEdit: vi.fn(),
    updateRecord: vi.fn(),
    beginDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    retrySchemas: vi.fn(),
    retryRecords: vi.fn(),
    ...overrides,
  };
}

async function openModelTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Model' }));
}

describe('SchemaWorkbenchRenderer', () => {
  it('exports the selected schema definition as JSON from the schema tab', async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
      URL,
      'createObjectURL',
    );
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
      URL,
      'revokeObjectURL',
    );
    let exportedBlob: Blob | undefined;
    const createObjectURL = vi.fn((object: Blob | MediaSource) => {
      exportedBlob = object as Blob;
      return 'blob:schema-definition';
    });
    const revokeObjectURL = vi.fn();
    const anchor = document.createElement('a');
    const anchorClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName.toLowerCase() === 'a') {
          Object.defineProperty(anchor, 'click', {
            configurable: true,
            value: anchorClick,
          });
          return anchor;
        }
        return originalCreateElement(tagName, options);
      });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    try {
      render(
        <SchemaWorkbenchRenderer
          actions={{ workbench: workbenchController() }}
          component={component}
        />,
      );

      await user.click(screen.getByRole('tab', { name: 'Schema' }));
      await user.click(
        screen.getByRole('button', { name: 'Export schema definition' }),
      );

      expect(anchor.download).toBe('profile.address.schema.json');
      expect(anchor.href).toBe('blob:schema-definition');
      expect(anchorClick).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:schema-definition');
      expect(exportedBlob).toBeDefined();
      await expect(exportedBlob!.text()).resolves.toContain('"schemaName": "address"');
      await expect(exportedBlob!.text()).resolves.toContain('"fields"');
    } finally {
      createElement.mockRestore();
      if (originalCreateObjectURL)
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (originalRevokeObjectURL)
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('places the horizontal data-type navigator before the independently scrolling workspace', () => {
    render(
      <SchemaWorkbenchRenderer
        actions={{ workbench: workbenchController() }}
        component={component}
      />,
    );

    expect(screen.getByTestId('workbench-pane-grid')).toHaveStyle({
      minHeight: 0,
      gridTemplateColumns: 'minmax(0, 1fr)',
    });
    expect(
      screen
        .getByTestId('workbench-schema-navigation-pane')
        .compareDocumentPosition(screen.getByTestId('workbench-record-pane')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId('workbench-record-pane')).toHaveStyle({
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      scrollbarGutter: 'stable',
    });
    expect(screen.getByTestId('workbench-schema-navigation-pane')).toHaveStyle({
      overflow: 'hidden',
    });
    expect(screen.getByTestId('workbench-schema-list-scroll-region')).toHaveStyle({
      display: 'grid',
      maxHeight: '144px',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      scrollbarGutter: 'stable',
    });
    expect(
      screen.queryByRole('button', { name: 'Add favourite Address' }),
    ).not.toBeInTheDocument();
  });

  it('shows fixed route scope without opening or populating advanced filters', async () => {
    const user = userEvent.setup();

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            scope: {
              kind: 'navigation',
              workbenchPresentation: {
                fixedFilters: [
                  {
                    id: 'city-dubai',
                    label: 'City scope',
                    field: 'city',
                    value: 'Dubai',
                    order: 10,
                  },
                ],
              },
            },
          }),
        }}
        component={component}
      />,
    );

    await openModelTab(user);
    expect(screen.getByText('Scope')).toBeVisible();
    expect(screen.getByText('City scope: Dubai')).toBeVisible();
    expect(screen.queryByText('Sort results')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Advanced search' }));

    expect(screen.getByText('Sort results')).toBeVisible();
    expect(screen.queryByDisplayValue('Dubai')).not.toBeInTheDocument();
  });

  it('selects an authorized schema and renders its records', async () => {
    const user = userEvent.setup();
    const selectSchema = vi.fn();
    const selectRecord = vi.fn();
    const beginCreate = vi.fn();
    const setRecordFilters = vi.fn();
    const setRecordSortOverride = vi.fn();
    const { rerender } = render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            schemas: [address],
            schemasLoading: false,
            records: [],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 0,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: ['code', 'city'],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema,
            setRecordSearch: vi.fn(),
            setRecordFilters,
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride,
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate,
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord,
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Address profile$/ }));
    expect(selectSchema).toHaveBeenCalledWith(address);

    rerender(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            schemas: [address],
            schemasLoading: false,
            selectedSchema: address,
            records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 1,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: ['code', 'city'],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema,
            setRecordSearch: vi.fn(),
            setRecordFilters,
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride,
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate,
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord,
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );
    await openModelTab(user);
    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'DXB-OFFICE' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Dubai' })).toBeVisible();
    expect(screen.getByText('Schema: address')).not.toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Create Address' }),
    ).not.toBeInTheDocument();
    const createButton = screen.getByRole('button', { name: 'Create new model' });
    expect(createButton).toBeEnabled();
    await user.hover(createButton);
    expect(await screen.findByText('Create new model')).toBeVisible();
    await user.click(createButton);
    expect(beginCreate).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Code' }));
    expect(setRecordSortOverride).toHaveBeenCalledWith({
      field: 'code',
      direction: 'ASC',
    });
    await user.click(screen.getByRole('button', { name: 'Advanced search' }));
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(setRecordFilters).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Value'), 'Dubai');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(setRecordFilters).toHaveBeenCalledWith({
      operator: 'AND',
      items: [{ field: 'city', operator: 'EQUALS', value: 'Dubai' }],
    });
    await user.click(screen.getByRole('cell', { name: 'DXB-OFFICE' }));
    expect(selectRecord).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      city: 'Dubai',
    });
  });

  it('keeps the selected schema list visible while rendering the update form', async () => {
    const user = userEvent.setup();
    const updateRecord = vi.fn();

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            editOpen: true,
            records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
            recordTotalCount: 1,
            selectedRecord: { code: 'DXB-OFFICE', city: 'Dubai' },
            updateRecord,
          }),
        }}
        component={component}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'DXB-OFFICE' })).toBeVisible();

    const city = screen.getByDisplayValue('Dubai');
    expect(city).toBeVisible();
    await user.clear(city);
    await user.type(city, 'Abu Dhabi');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(updateRecord).toHaveBeenCalledWith({
      city: 'Abu Dhabi',
      code: 'DXB-OFFICE',
    });
  });

  it('renders backend-provided quick filters and guided actions through the shared workbench renderer', async () => {
    const user = userEvent.setup();
    const setRecordFilters = vi.fn();

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            scope: {
              kind: 'navigation',
              label: 'Checkout reverse runs',
              workbenchPresentation: {
                quickFilters: [
                  {
                    id: 'dubai',
                    label: 'Dubai records',
                    field: 'city',
                    value: 'Dubai',
                    order: 0,
                  },
                ],
                recoveryActions: [
                  {
                    id: 'review',
                    label: 'Review fulfilment return',
                    ownerModule: 'order',
                    strategy: 'FULFILLMENT_RETURN_REVIEW',
                    handlerAction: 'reviewFulfilmentReturn',
                    summary: 'Review return state before retrying.',
                    order: 0,
                  },
                ],
              },
            },
            setRecordFilters,
          }),
        }}
        component={component}
      />,
    );

    await openModelTab(user);
    await user.click(screen.getByRole('button', { name: 'Dubai records' }));

    expect(setRecordFilters).toHaveBeenCalledWith({
      operator: 'AND',
      items: [{ field: 'city', operator: 'EQUALS', value: 'Dubai' }],
    });
    expect(screen.getByText('Review fulfilment return')).toBeVisible();
  });

  it('shows a retryable safe discovery failure', () => {
    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            schemas: [],
            schemasError: 'Authorized schema discovery is currently unavailable',
            schemasLoading: false,
            records: [],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 0,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: [],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema: vi.fn(),
            setRecordSearch: vi.fn(),
            setRecordFilters: vi.fn(),
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride: vi.fn(),
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate: vi.fn(),
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord: vi.fn(),
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );

    expect(
      screen.getByText('Authorized schema discovery is currently unavailable'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('collapses and restores the horizontal data type browser without losing its search', async () => {
    const user = userEvent.setup();
    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            schemas: [address],
            schemasLoading: false,
            selectedSchema: address,
            records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 1,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: ['code', 'city'],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema: vi.fn(),
            setRecordSearch: vi.fn(),
            setRecordFilters: vi.fn(),
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride: vi.fn(),
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate: vi.fn(),
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord: vi.fn(),
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Available data types' })).toBeVisible();
    await user.type(
      screen.getByRole('textbox', { name: 'Find a data type' }),
      'Address',
    );

    await user.click(screen.getByRole('button', { name: 'Hide data types' }));

    expect(screen.getByRole('heading', { name: 'Available data types' })).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: 'Find a data type' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show data types' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Show data types' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Show data types' }));

    expect(screen.getByRole('heading', { name: 'Available data types' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Find a data type' })).toHaveValue(
      'Address',
    );
    expect(screen.getByRole('button', { name: 'Hide data types' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('filters the data type browser by backend-discovered module', async () => {
    const user = userEvent.setup();
    const productSchema = schemaVariant('Product', 'catalog', 'product');

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            schemas: [address, productSchema],
            records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
            recordTotalCount: 1,
          }),
        }}
        component={component}
      />,
    );

    expect(screen.getByRole('button', { name: /^Address profile$/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Product catalog$/ })).toBeVisible();

    await user.click(screen.getByRole('combobox', { name: 'Module' }));
    await user.click(screen.getByRole('option', { name: 'catalog' }));

    expect(
      screen.queryByRole('button', { name: /^Address profile$/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Product catalog$/ })).toBeVisible();
  });

  it('distinguishes real runtime copies while keeping one module filter option', async () => {
    const user = userEvent.setup();
    const selectSchema = vi.fn();
    const online = {
      ...address,
      connectionInstanceId: 'online-1',
      connectionServer: 'onlineServer',
      connectionEnvironment: 'local',
    };
    const staged = {
      ...address,
      connectionInstanceId: 'staged-1',
      connectionServer: 'stagedServer',
      connectionEnvironment: 'local',
    };
    render(
      <SchemaWorkbenchRenderer
        component={component}
        actions={{
          workbench: workbenchController({
            schemas: [online, staged],
            selectedSchema: staged,
            selectSchema,
          }),
        }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Address profile / onlineServer / local' }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Address profile / stagedServer / local' }),
    );
    expect(selectSchema).toHaveBeenCalledWith(staged);
    await user.click(screen.getByRole('combobox', { name: 'Module' }));
    expect(screen.getAllByRole('option', { name: 'profile' })).toHaveLength(1);
    await user.click(screen.getByRole('option', { name: 'profile' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Find a data type' }),
      'onlineServer',
    );
    expect(
      screen.getByRole('button', { name: 'Address profile / onlineServer / local' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Address profile / stagedServer / local' }),
    ).not.toBeInTheDocument();
  });

  it('lists only Staged authoring for publishable schemas and does not fall back to Online', async () => {
    const user = userEvent.setup();
    const selectSchema = vi.fn();
    const online: WorkbenchSchema = {
      ...address,
      connectionInstanceId: 'online-1',
      connectionServer: 'onlineServer',
      connectionEnvironment: 'local',
      authoring: { publishRequired: true, stage: 'ONLINE', authoringAllowed: false },
      mutationMode: 'READ_ONLY',
      operations: ['search', 'read'],
    };
    const staged: WorkbenchSchema = {
      ...address,
      connectionInstanceId: 'staged-1',
      connectionServer: 'stagedServer',
      connectionEnvironment: 'local',
      authoring: { publishRequired: true, stage: 'STAGED', authoringAllowed: true },
    };
    const { rerender } = render(
      <SchemaWorkbenchRenderer
        component={component}
        actions={{
          workbench: workbenchController({
            schemas: [online, staged],
            selectedSchema: staged,
            selectSchema,
          }),
        }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Address profile / onlineServer / local' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Address profile / stagedServer / local' }),
    );
    expect(selectSchema).toHaveBeenCalledWith(staged);
    rerender(
      <SchemaWorkbenchRenderer
        component={component}
        actions={{
          workbench: workbenchController({
            schemas: [online],
            selectedSchema: undefined,
            selectSchema,
          }),
        }}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /^Address profile/ }),
    ).not.toBeInTheDocument();
  });

  it('loads long schema browser lists incrementally', async () => {
    const user = userEvent.setup();
    const schemas = Array.from({ length: 22 }, (_value, index) =>
      schemaVariant(
        `Type ${String(index).padStart(2, '0')}`,
        'profile',
        `schema${String(index).padStart(2, '0')}`,
      ),
    );

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            schemas,
            selectedSchema: schemas[0],
          }),
        }}
        component={component}
      />,
    );

    expect(screen.getByText('20 shown from 22')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /^Type 21 profile$/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(screen.getByText('22 shown from 22')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Type 21 profile$/ })).toBeVisible();
  });

  it('renders a route-scoped schema workspace without the global schema browser', async () => {
    const user = userEvent.setup();
    const selectRecord = vi.fn();
    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            scope: {
              kind: 'navigation',
              label: 'Websites',
              parentLabel: 'Web Content Management System',
              help: {
                summary: 'Manage CMS websites for an enterprise experience.',
                documentationRoute:
                  '/docs/capabilities/content-publishing/wcms-authoring-model',
                documentationFragment: 'websites',
              },
            },
            schemas: [address],
            schemasLoading: false,
            selectedSchema: address,
            records: [{ code: 'axis-site', city: 'Dubai' }],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 1,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: ['code', 'city'],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema: vi.fn(),
            setRecordSearch: vi.fn(),
            setRecordFilters: vi.fn(),
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride: vi.fn(),
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate: vi.fn(),
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord,
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );

    expect(screen.queryByText('Available data types')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Actions' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.getByText('Web Content Management System')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Websites' })).toBeVisible();
    expect(screen.getByText('Schema: address')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Websites help' })).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open Websites documentation' }),
    ).toHaveAttribute(
      'href',
      '/docs/capabilities/content-publishing/wcms-authoring-model#websites',
    );
    await openModelTab(user);
    expect(screen.getByRole('cell', { name: 'axis-site' })).toBeVisible();
    expect(selectRecord).not.toHaveBeenCalled();
  });

  it('shows selected record detail beneath the schema list', () => {
    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: {
            ...workbenchController(),
            scope: {
              kind: 'navigation',
              label: 'Websites',
              parentLabel: 'Web Content Management System',
            },
            schemas: [address],
            schemasLoading: false,
            selectedSchema: address,
            selectedRecord: { code: 'axis-site', city: 'Dubai' },
            selectedRecordDetailPanels: [
              {
                panel: {
                  id: 'slots',
                  label: 'Slots',
                  order: 0,
                  target: {
                    moduleName: 'cms',
                    schemaName: 'address',
                  },
                  relation: {
                    sourceField: 'code',
                    targetField: 'pageCode',
                    cardinality: 'MANY',
                  },
                  summary: 'Slots assigned to the selected page or site.',
                },
                schema: address,
                page: {
                  records: [{ code: 'header-slot', city: 'Dubai' }],
                  totalCount: 1,
                  pageNumber: 1,
                  pageSize: 10,
                  sort: { field: 'code', direction: 'ASC' },
                },
                loading: false,
              },
            ],
            records: [{ code: 'axis-site', city: 'Dubai' }],
            recordSearch: '',
            recordPageNumber: 1,
            recordPageSize: 25,
            recordTotalCount: 1,
            recordSort: { field: 'code', direction: 'ASC' },
            visibleColumns: ['code', 'city'],
            favoriteSchemas: [],
            recentSchemas: [],
            selectedRecordKeys: [],
            savedViews: [],
            recordsLoading: false,
            creating: false,
            createOpen: false,
            relationshipRuntime,
            editOpen: false,
            updating: false,
            deleteOpen: false,
            deleting: false,
            tenantCode: 'default',
            enterpriseCode: 'default',
            selectSchema: vi.fn(),
            setRecordSearch: vi.fn(),
            setRecordFilters: vi.fn(),
            setRecordPageNumber: vi.fn(),
            setRecordPageSize: vi.fn(),
            setRecordSort: vi.fn(),
            setRecordSortOverride: vi.fn(),
            setVisibleColumns: vi.fn(),
            toggleFavoriteSchema: vi.fn(),
            setSelectedRecordKeys: vi.fn(),
            saveView: vi.fn(),
            deleteView: vi.fn(),
            applyView: vi.fn(),
            beginCreate: vi.fn(),
            cancelCreate: vi.fn(),
            createRecord: vi.fn(),
            selectRecord: vi.fn(),
            closeRecord: vi.fn(),
            beginEdit: vi.fn(),
            cancelEdit: vi.fn(),
            updateRecord: vi.fn(),
            beginDelete: vi.fn(),
            cancelDelete: vi.fn(),
            confirmDelete: vi.fn(),
            retrySchemas: vi.fn(),
            retryRecords: vi.fn(),
          },
        }}
        component={component}
      />,
    );

    const table = screen.getByRole('table', { name: 'Address Records' });
    const detailHeading = screen.getByRole('heading', { name: 'axis-site' });
    expect(table.compareDocumentPosition(detailHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('heading', { name: 'Slots' })).toBeVisible();
    expect(
      screen.getByText('Slots assigned to the selected page or site.'),
    ).toBeVisible();
    expect(screen.getByRole('table', { name: 'Slots related records' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'header-slot' })).toBeVisible();
  });

  it('shows selected record detail before opened reference detail', () => {
    const workflowAction: WorkbenchSchema = {
      ...schemaVariant('Workflow Action', 'workflow', 'workflowAction'),
      label: 'Workflow Action',
      description: 'Workflow action schema.',
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'string',
          required: true,
          readOnly: false,
          primary: true,
          description: '',
          searchable: true,
        },
        {
          name: 'channels',
          label: 'Channels',
          type: 'array',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
      relationships: [
        {
          field: 'channels',
          label: 'Channels',
          description: 'Action channels.',
          cardinality: 'MANY',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
        },
      ],
    };
    const workflowChannel: WorkbenchSchema = {
      ...schemaVariant('Workflow Channel', 'workflow', 'workflowChannel'),
      label: 'Workflow Channel',
      relationships: [],
      fields: [
        workflowAction.fields[0]!,
        {
          name: 'target',
          label: 'Target',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: true,
        },
      ],
    };
    const selectedRecord = {
      code: 'cmsPagesApprovalFlowHead',
      channels: ['reviewCmsPageChannel'],
    };
    const referenceRecord = {
      code: 'reviewCmsPageChannel',
      target: 'reviewCmsPageAction',
    };

    render(
      <SchemaWorkbenchRenderer
        actions={{
          workbench: workbenchController({
            schemas: [workflowAction, workflowChannel],
            selectedSchema: workflowAction,
            selectedRecord,
            openedReferenceRecord: {
              relationship: workflowAction.relationships[0]!,
              reference: 'reviewCmsPageChannel',
              schema: workflowChannel,
              record: referenceRecord,
            },
            records: [selectedRecord],
            recordTotalCount: 1,
            visibleColumns: ['code', 'channels'],
            relationshipRuntime: {
              ...relationshipRuntime,
              schemas: [workflowChannel],
            },
          }),
        }}
        component={component}
      />,
    );

    const selectedDetail = screen.getByRole('heading', {
      name: 'cmsPagesApprovalFlowHead',
      hidden: true,
    });
    const referenceDetail = screen.getByRole('heading', {
      name: 'reviewCmsPageChannel',
    });
    expect(selectedDetail.compareDocumentPosition(referenceDetail)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
