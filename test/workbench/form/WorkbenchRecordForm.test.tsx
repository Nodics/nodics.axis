import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { WorkbenchRecordForm } from '../../../src/workbench/form/WorkbenchRecordForm';

const contact: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'contact',
  label: 'Contact',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code', 'description'],
  queryCapabilities: {
    searchableFields: ['code', 'description'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create'],
  fields: [
    {
      name: 'created',
      label: 'Created',
      type: 'date',
      required: true,
      readOnly: true,
      primary: false,
      description: '',
      searchable: true,
    },
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
      name: 'type',
      label: 'Type',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      enum: ['EMAIL', 'PHONE'],
      searchable: false,
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'int',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      default: 0,
      searchable: false,
    },
  ],
  relationships: [],
};

it('walks backend sections, validates before continuing and saves only after review', async () => {
  const user = userEvent.setup();
  const submit = vi.fn();
  const schema: WorkbenchSchema = {
    ...contact,
    form: {
      contractVersion: 1,
      hiddenFields: [],
      managedCreateFields: [],
      defaultColumns: ['code'],
      sections: [
        { id: 'identity', label: 'Contact identity', fields: ['code'] },
        { id: 'details', label: 'Contact details', fields: ['type', 'priority'] },
      ],
      copy: {},
    },
  };
  render(
    <WorkbenchRecordForm
      schema={schema}
      saving={false}
      savingLabel="Saving"
      submitLabel="Create"
      cancelLabel="Cancel"
      onSubmit={submit}
      onCancel={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Code is required')).toBeVisible();
  await user.type(screen.getByRole('textbox', { name: /Code/ }), 'business-contact');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByRole('textbox', { name: /Code/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('combobox', { name: /Type/ }));
  await user.click(screen.getByRole('option', { name: 'EMAIL' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByText('business-contact')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Edit Contact identity' }));
  expect(screen.getByRole('textbox', { name: /Code/ })).toHaveValue('business-contact');
  await user.click(screen.getByRole('tab', { name: 'Review' }));
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(submit).toHaveBeenCalledWith({
    code: 'business-contact',
    type: 'EMAIL',
    priority: 0,
  });
});

it('asks before discarding changes and keeps the form when declined', async () => {
  const user = userEvent.setup();
  const cancel = vi.fn();
  render(
    <WorkbenchRecordForm
      schema={contact}
      saving={false}
      savingLabel="Saving"
      submitLabel="Create"
      cancelLabel="Cancel"
      onSubmit={vi.fn()}
      onCancel={cancel}
    />,
  );
  await user.type(screen.getByRole('textbox', { name: /Code/ }), 'keep-me');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancel).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(await screen.findByRole('textbox', { name: /Code/ })).toHaveValue('keep-me');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(cancel).toHaveBeenCalledOnce();
});

it('excludes backend-managed create fields without requiring a tenant selection', async () => {
  const user = userEvent.setup();
  const submit = vi.fn();
  const schema: WorkbenchSchema = {
    ...contact,
    form: {
      contractVersion: 1,
      hiddenFields: [],
      managedCreateFields: ['code'],
      defaultColumns: [],
      sections: [],
      copy: {},
      createOperation: 'setup',
    },
  };
  render(
    <WorkbenchRecordForm
      schema={schema}
      saving={false}
      savingLabel="Saving"
      submitLabel="Create"
      cancelLabel="Cancel"
      onSubmit={submit}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.queryByRole('textbox', { name: /Code/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('combobox', { name: /Type/ }));
  await user.click(screen.getByRole('option', { name: 'PHONE' }));
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(submit).toHaveBeenCalledWith({ type: 'PHONE', priority: 0 });
});

it('preserves a failed edit and displays the same mutation error only once', async () => {
  const user = userEvent.setup();
  const message = 'This record changed after it was read.';
  const submit = vi.fn().mockRejectedValue(new Error(message));
  render(
    <WorkbenchRecordForm
      schema={contact}
      initialModel={{ code: 'edit-draft', type: 'EMAIL', priority: 0 }}
      error={message}
      saving={false}
      savingLabel="Saving"
      submitLabel="Update"
      cancelLabel="Cancel"
      onSubmit={submit}
      onCancel={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Update' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: /Code/ })).toHaveValue('edit-draft');
});

const address: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'address',
  label: 'Address',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    searchableFields: ['code'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create'],
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
      name: 'contacts',
      label: 'Contacts',
      type: 'array',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'verificationStatus',
      label: 'Verification status',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Reusable address verification state',
      enum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'STALE'],
      enumOptions: [
        {
          value: 'UNVERIFIED',
          label: 'Unverified',
          description: '',
          disabled: false,
        },
        { value: 'PENDING', label: 'Pending', description: '', disabled: false },
        { value: 'VERIFIED', label: 'Verified', description: '', disabled: false },
        { value: 'REJECTED', label: 'Rejected', description: '', disabled: false },
        { value: 'STALE', label: 'Stale', description: '', disabled: false },
      ],
      searchable: false,
    },
    {
      name: 'countryCode',
      label: 'Country',
      type: 'string',
      required: true,
      readOnly: true,
      primary: false,
      description: 'Backend fixed country scope',
      fixedValue: 'AE',
      searchable: false,
    },
  ],
  relationships: [
    {
      field: 'contacts',
      label: 'Contact methods',
      description: 'Linked contacts',
      targetModule: 'profile',
      targetSchema: 'contact',
      cardinality: 'MANY',
      referenceProperty: 'code',
      resolution: 'LOCAL_OR_REMOTE',
      actions: ['SELECT_EXISTING', 'CREATE_RELATED', 'UNLINK'],
      required: false,
    },
  ],
};

const employee: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'employee',
  label: 'Employee',
  description: '',
  displayProperty: 'loginId',
  displayProperties: ['loginId', 'name.firstName', 'name.lastName'],
  queryCapabilities: {
    searchableFields: ['loginId', 'name.firstName', 'name.lastName'],
    sortableFields: ['loginId'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'loginId', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update'],
  fields: [
    {
      name: 'loginId',
      label: 'Login',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      searchable: true,
    },
    {
      name: 'name',
      label: 'Name',
      type: 'object',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'name.firstName',
      label: 'First name',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'name.middleName',
      label: 'Middle name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'name.lastName',
      label: 'Last name',
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

const tenant: WorkbenchSchema = {
  ...contact,
  schemaName: 'tenant',
  label: 'Tenant',
  displayProperties: ['code', 'description'],
  fields: [
    contact.fields[1]!,
    {
      name: 'description',
      label: 'Description',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
  ],
  relationships: [],
};

const enterprise: WorkbenchSchema = {
  ...address,
  schemaName: 'enterprise',
  label: 'Enterprise',
  fields: [
    address.fields[0]!,
    {
      name: 'tenant',
      label: 'Tenant',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
  ],
  relationships: [
    {
      field: 'tenant',
      label: 'Tenant',
      description: 'Owning tenant',
      targetModule: 'profile',
      targetSchema: 'tenant',
      cardinality: 'ONE',
      referenceProperty: 'code',
      resolution: 'LOCAL_OR_REMOTE',
      actions: ['SELECT_EXISTING'],
      required: true,
    },
  ],
};

const relationshipCopy = {
  addToDraftLabel: 'Add to draft',
  cancelLabel: 'Cancel',
  createRelatedLabel: 'Create related',
  editRelatedLabel: 'Edit related',
  loadMoreRelatedLabel: 'Load more',
  manySelectionHintLabel: 'Select one or more related records.',
  missingReferencePropertyLabel:
    'Related records were found, but none expose the required reference property: {property}.',
  noRelatedRecordsLabel: 'No related records',
  pendingReferencesLabel: 'Pending create',
  relatedSearchLabel: 'Search related records',
  relatedResultsLabel: '{shown} shown from {total}',
  removeReferenceLabel: 'Remove',
  removeRelatedLabel: 'Close',
  selectedReferencesLabel: 'Selected existing',
  selectExistingLabel: 'Select existing',
  singleSelectionHintLabel: 'Selecting a record replaces the current reference.',
};

describe('WorkbenchRecordForm', () => {
  it('renders typed fields, excludes managed fields, and submits a valid draft', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        saving={false}
        savingLabel="Saving"
        schema={contact}
        submitLabel="Create"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );

    expect(screen.queryByLabelText('Created')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Code/), 'DXB-EMAIL');
    await user.click(screen.getByLabelText(/Type/));
    await user.click(screen.getByRole('option', { name: 'EMAIL' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-EMAIL',
      type: 'EMAIL',
      priority: 0,
    });
  });

  it('blocks an incomplete draft before it reaches the backend', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        saving={false}
        savingLabel="Saving"
        schema={contact}
        submitLabel="Create"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByText('Code is required')).toBeVisible();
    expect(screen.getByText('Type is required')).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });

  it('initializes an update draft from an existing record', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        initialModel={{
          code: 'DXB-EMAIL',
          type: 'EMAIL',
          priority: 2,
          created: '2026-07-25T10:00:00.000Z',
        }}
        saving={false}
        savingLabel="Updating"
        schema={contact}
        submitLabel="Update"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );

    expect(screen.getByLabelText(/Code/)).toHaveValue('DXB-EMAIL');
    expect(screen.queryByLabelText('Created')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-EMAIL',
      type: 'EMAIL',
      priority: 2,
    });
  });

  it('renders address verification status as a backend enum selector', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        initialModel={{
          code: 'DXB-OFFICE',
          verificationStatus: 'PENDING',
        }}
        saving={false}
        savingLabel="Updating"
        schema={address}
        submitLabel="Update"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );

    expect(screen.getByLabelText(/Verification status/)).toHaveTextContent('Pending');
    await user.click(screen.getByLabelText(/Verification status/));
    expect(screen.getByRole('option', { name: 'Unverified' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Pending' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Verified' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Rejected' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Stale' })).toBeVisible();

    await user.click(screen.getByRole('option', { name: 'Verified' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      verificationStatus: 'VERIFIED',
    });
  });

  it('renders fixed backend values as locked form fields without submitting them', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        saving={false}
        savingLabel="Saving"
        schema={address}
        submitLabel="Create"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );

    expect(screen.getByLabelText(/Country/)).toHaveValue('AE');
    expect(screen.getByLabelText(/Country/)).toBeDisabled();
    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
    });
  });

  it('edits inline nested fields and submits nested model objects', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <WorkbenchRecordForm
        cancelLabel="Cancel"
        initialModel={{
          loginId: 'admin',
          name: { firstName: 'Admin', lastName: 'User' },
        }}
        saving={false}
        savingLabel="Updating"
        schema={employee}
        submitLabel="Update"
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );

    expect(screen.queryByLabelText(/^Name$/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Admin');
    await user.clear(screen.getByLabelText(/Middle name/));
    await user.type(screen.getByLabelText(/Middle name/), 'Ops');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(submit).toHaveBeenCalledWith({
      loginId: 'admin',
      name: { firstName: 'Admin', middleName: 'Ops', lastName: 'User' },
    });
  });

  it('retains a created related reference when the parent save fails and retries', async () => {
    const user = userEvent.setup();
    const createRelated = vi.fn().mockResolvedValue({ code: 'DXB-EMAIL' });
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Address save failed'))
      .mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: createRelated,
            loadRecords: vi.fn().mockResolvedValue([]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={address}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    await user.click(screen.getByRole('button', { name: 'Create related Contact' }));
    await user.type(screen.getAllByLabelText(/Code/)[1]!, 'DXB-EMAIL');
    await user.click(screen.getByLabelText(/Type/));
    await user.click(screen.getByRole('option', { name: 'EMAIL' }));
    await user.click(screen.getByRole('button', { name: 'Add to draft' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Address save failed')).toBeVisible();
    expect(createRelated).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenLastCalledWith({
      code: 'DXB-OFFICE',
      contacts: ['DXB-EMAIL'],
    });

    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(createRelated).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('previews and edits pending related records before parent save', async () => {
    const user = userEvent.setup();
    const createRelated = vi.fn().mockResolvedValue({ code: 'DXB-EMAIL' });
    const submit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: createRelated,
            loadRecords: vi.fn().mockResolvedValue([]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={address}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    await user.click(screen.getByRole('button', { name: 'Create related Contact' }));
    await user.type(screen.getAllByLabelText(/Code/)[1]!, 'DXB-EMAIL');
    await user.click(screen.getByLabelText(/Type/));
    await user.click(screen.getByRole('option', { name: 'EMAIL' }));
    await user.click(screen.getByRole('button', { name: 'Add to draft' }));

    expect(screen.getByText('Pending create')).toBeVisible();
    expect(screen.getByText('1 pending')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'DXB-EMAIL' }));
    expect(await screen.findByText('Pending Contact methods: DXB-EMAIL')).toBeVisible();
    expect(screen.getByText('EMAIL')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Edit related' }));
    await user.click(screen.getByLabelText(/Type/));
    await user.click(screen.getByRole('option', { name: 'PHONE' }));
    await user.click(screen.getByRole('button', { name: 'Edit related' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(createRelated).toHaveBeenCalledWith(contact, {
      code: 'DXB-EMAIL',
      type: 'PHONE',
      priority: 0,
    });
    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      contacts: ['DXB-EMAIL'],
    });
  });

  it('removes pending related records before parent save', async () => {
    const user = userEvent.setup();
    const createRelated = vi.fn().mockResolvedValue({ code: 'DXB-EMAIL' });
    const submit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: createRelated,
            loadRecords: vi.fn().mockResolvedValue([]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={address}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    await user.click(screen.getByRole('button', { name: 'Create related Contact' }));
    await user.type(screen.getAllByLabelText(/Code/)[1]!, 'DXB-EMAIL');
    await user.click(screen.getByLabelText(/Type/));
    await user.click(screen.getByRole('option', { name: 'EMAIL' }));
    await user.click(screen.getByRole('button', { name: 'Add to draft' }));

    await user.click(screen.getByRole('button', { name: 'Remove DXB-EMAIL' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(createRelated).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
    });
  });

  it('selects an existing related record without creating a duplicate', async () => {
    const user = userEvent.setup();
    const createRelated = vi.fn();
    const submit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: createRelated,
            loadRecords: vi.fn().mockResolvedValue([
              {
                code: 'DXB-PHONE',
                description:
                  'Primary office telephone contact used by the Dubai operations support team every day',
                type: 'PHONE',
              },
              {
                code: 'HOME-PHONE',
                description: 'Short home contact',
                type: 'PHONE',
              },
            ]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={address}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    expect(screen.getByText('Contact methods')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Select existing' }));
    expect(
      screen.getByRole('button', { name: 'Create related Contact' }),
    ).toBeVisible();
    const relatedRecord = await screen.findByText(
      'DXB-PHONE - Primary office telephone contact used...',
    );
    await user.hover(relatedRecord);
    expect(
      await screen.findByRole('tooltip', {
        name: 'Primary office telephone contact used by the Dubai operations support team every day',
      }),
    ).toBeVisible();
    await user.unhover(relatedRecord);
    const shortDescription = screen.getByText('HOME-PHONE - Short home contact');
    await user.hover(shortDescription);
    expect(
      await screen.findByRole('tooltip', { name: 'Short home contact' }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', {
        name: 'DXB-PHONE - Primary office telephone contact used...',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(createRelated).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      contacts: ['DXB-PHONE'],
    });
  });

  it('edits one-to-one references through backend-searchable lookup values', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const loadRecords = vi.fn().mockResolvedValue([
      {
        code: 'default',
        description: 'Default tenant',
      },
      {
        code: 'qa',
        description: 'QA tenant',
      },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          initialModel={{ code: 'defaultEnterprise', tenant: 'default' }}
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [tenant],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords,
          }}
          saving={false}
          savingLabel="Updating"
          schema={enterprise}
          submitLabel="Update"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByLabelText(/^Tenant$/)).not.toBeInTheDocument();
    expect(screen.getByText('Selected existing')).toBeVisible();
    expect(screen.getByText('1 selected')).toBeVisible();
    expect(screen.getByText('default')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Select existing' }));
    await user.type(screen.getByLabelText('Search related records'), 'qa');

    await waitFor(() =>
      expect(loadRecords).toHaveBeenCalledWith(tenant, {
        search: 'qa',
        pageNumber: 1,
        pageSize: 10,
      }),
    );
    expect(
      screen.getByText('Selecting a record replaces the current reference.'),
    ).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'qa - QA tenant' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(submit).toHaveBeenCalledWith({
      code: 'defaultEnterprise',
      tenant: 'qa',
    });
  });

  it('replaces a pending one-to-one related draft when an existing reference is selected', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const createRelated = vi.fn().mockResolvedValue({ code: 'newTenant' });
    const loadRecords = vi.fn().mockResolvedValue([
      {
        code: 'qa',
        description: 'QA tenant',
      },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const creatableTenantEnterprise: WorkbenchSchema = {
      ...enterprise,
      relationships: [
        {
          ...enterprise.relationships[0]!,
          actions: ['SELECT_EXISTING', 'CREATE_RELATED'],
        },
      ],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          initialModel={{ code: 'defaultEnterprise', tenant: 'default' }}
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [tenant],
            queryScope: ['default'],
            createRecord: createRelated,
            loadRecords,
          }}
          saving={false}
          savingLabel="Updating"
          schema={creatableTenantEnterprise}
          submitLabel="Update"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Create related Tenant' }));
    await user.type(screen.getAllByLabelText(/Code/)[1]!, 'newTenant');
    await user.click(screen.getByRole('button', { name: 'Add to draft' }));

    expect(screen.getByText('Pending create')).toBeVisible();
    expect(screen.getByRole('button', { name: 'newTenant' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Select existing' }));
    await user.type(screen.getByLabelText('Search related records'), 'qa');

    await waitFor(() =>
      expect(loadRecords).toHaveBeenCalledWith(tenant, {
        search: 'qa',
        pageNumber: 1,
        pageSize: 10,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'qa - QA tenant' }));
    expect(screen.queryByRole('button', { name: 'newTenant' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(createRelated).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith({
      code: 'defaultEnterprise',
      tenant: 'qa',
    });
  });

  it('submits the remaining one-to-many references after removing a selected reference', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          initialModel={{ code: 'DXB-OFFICE', contacts: ['DXB-PHONE', 'DXB-EMAIL'] }}
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords: vi.fn().mockResolvedValue([]),
          }}
          saving={false}
          savingLabel="Updating"
          schema={address}
          submitLabel="Update"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: 'DXB-PHONE' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'DXB-EMAIL' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove DXB-PHONE' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      contacts: ['DXB-EMAIL'],
    });
  });

  it('loads additional backend pages while selecting many related records', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const loadRecords = vi
      .fn()
      .mockResolvedValueOnce({
        records: [
          {
            code: 'DXB-PHONE',
            description: 'Dubai phone contact',
            type: 'PHONE',
          },
        ],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 10,
      })
      .mockResolvedValueOnce({
        records: [
          {
            code: 'DXB-EMAIL',
            description: 'Dubai email contact',
            type: 'EMAIL',
          },
        ],
        totalCount: 2,
        pageNumber: 2,
        pageSize: 10,
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [address, contact],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords,
          }}
          saving={false}
          savingLabel="Saving"
          schema={address}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/Code/), 'DXB-OFFICE');
    await user.click(screen.getByRole('button', { name: 'Select existing' }));

    expect(
      await screen.findByText('Select one or more related records.'),
    ).toBeVisible();
    expect(screen.getByText('1 shown from 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('DXB-EMAIL - Dubai email contact')).toBeVisible();
    expect(screen.getByText('2 shown from 2')).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: 'DXB-PHONE - Dubai phone contact' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'DXB-EMAIL - Dubai email contact' }),
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(loadRecords).toHaveBeenNthCalledWith(1, contact, {
      search: '',
      pageNumber: 1,
      pageSize: 10,
    });
    expect(loadRecords).toHaveBeenNthCalledWith(2, contact, {
      search: '',
      pageNumber: 2,
      pageSize: 10,
    });
    expect(submit).toHaveBeenCalledWith({
      code: 'DXB-OFFICE',
      contacts: ['DXB-PHONE', 'DXB-EMAIL'],
    });
  });

  it('opens selected reference chips through the shared schema detail preview', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          initialModel={{ code: 'defaultEnterprise', tenant: 'default' }}
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [tenant],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords: vi.fn().mockResolvedValue([]),
            resolveRecord: vi.fn().mockResolvedValue({
              record: {
                code: 'default',
                description: 'Default tenant',
              },
              schema: tenant,
            }),
          }}
          saving={false}
          savingLabel="Updating"
          schema={enterprise}
          submitLabel="Update"
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'default' }));

    expect(await screen.findByRole('dialog')).toHaveAccessibleName(/Tenant.*default/);
    expect(screen.getByText('Description')).toBeVisible();
    expect(screen.getByText('Default tenant')).toBeVisible();
  });

  it('warns when related records do not expose the configured reference property', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [tenant],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords: vi.fn().mockResolvedValue([
              {
                description: 'Default tenant without projected code',
              },
            ]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={enterprise}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Select existing' }));

    expect(
      await screen.findByText(
        'Related records were found, but none expose the required reference property: code.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('stops nested creation when a relationship would repeat the schema path', () => {
    const cyclicContact: WorkbenchSchema = {
      ...contact,
      fields: [
        ...contact.fields,
        {
          name: 'parent',
          label: 'Parent contact',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
      relationships: [
        {
          field: 'parent',
          label: 'Parent contact',
          description: '',
          targetModule: 'profile',
          targetSchema: 'contact',
          cardinality: 'ONE',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING', 'CREATE_RELATED'],
          required: false,
          maximumDepth: 3,
          cycleHandling: 'SELECT_EXISTING',
        },
      ],
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchRecordForm
          cancelLabel="Cancel"
          relationshipCopy={relationshipCopy}
          relationshipRuntime={{
            schemas: [cyclicContact],
            queryScope: ['default'],
            createRecord: vi.fn(),
            loadRecords: vi.fn().mockResolvedValue([]),
          }}
          saving={false}
          savingLabel="Saving"
          schema={cyclicContact}
          submitLabel="Create"
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: 'Select existing' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Create related/ }),
    ).not.toBeInTheDocument();
  });
});
