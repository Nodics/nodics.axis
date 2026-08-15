import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { WorkbenchRecordDetail } from '../../../src/workbench/detail/WorkbenchRecordDetail';

const schema: WorkbenchSchema = {
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
  operations: ['search', 'read'],
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
  ],
  relationships: [],
};

describe('WorkbenchRecordDetail', () => {
  it('does not expose mutation actions absent from the backend descriptor', () => {
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{ code: 'DXB-OFFICE' }}
        schema={schema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('renders backend-declared Order lifecycle operator action panels with disposition inputs', async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue({ status: 'DISPOSITION_RECORDED' });
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        lifecycleActions={[
          {
            id: 'record-disposition',
            label: 'Record disposition',
            intent: 'OTHER',
            ownerModule: 'order',
            operationRoute: '/operator/order-lifecycle/:requestCode/actions/DISPOSITION',
            order: 70,
            inputFields: [
              {
                name: 'requestCode',
                label: 'Request code',
                type: 'HIDDEN',
                required: true,
                valueFromRecord: 'code',
                maximumLength: 128,
              },
              {
                name: 'rmaCode',
                label: 'RMA code',
                type: 'TEXT',
                required: false,
                valueFromRecord: 'evidence.rmaCode',
                maximumLength: 128,
              },
              {
                name: 'disposition',
                label: 'Disposition',
                type: 'SELECT',
                required: true,
                options: ['RESTOCK', 'REFURBISH', 'SCRAP', 'REJECT_RETURN'],
                defaultValue: 'RESTOCK',
                maximumLength: 32,
              },
            ],
          },
        ]}
        record={{ code: 'order-1:return:1', status: 'SUBMITTED', evidence: { rmaCode: 'RMA-1' } }}
        schema={{ ...schema, moduleName: 'order', schemaName: 'orderLifecycleRequest' }}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onLifecycleAction={execute}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Record disposition/ }));

    expect(screen.getByText(/Confirm backend action/)).toBeVisible();
    expect(screen.getByText(/\/operator\/order-lifecycle\/:requestCode\/actions\/DISPOSITION/)).toBeVisible();
    expect(screen.getByLabelText('RMA code')).toHaveValue('RMA-1');
    expect(screen.getByText('Disposition')).toBeVisible();
    expect(screen.getByText('RESTOCK')).toBeVisible();

    await user.click(screen.getAllByRole('button', { name: /Record disposition/ }).at(-1)!);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'record-disposition' }),
      expect.objectContaining({ code: 'order-1:return:1' }),
      expect.objectContaining({
        requestCode: 'order-1:return:1',
        rmaCode: 'RMA-1',
        disposition: 'RESTOCK',
      }),
    );
  });

  it('renders backend lifecycle action result summaries passed by the route controller', () => {
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        lifecycleActionResult={{ status: 'DISPOSITION_RECORDED' }}
        lifecycleActions={[
          {
            id: 'record-disposition',
            label: 'Record disposition',
            intent: 'OTHER',
            ownerModule: 'order',
            operationRoute: '/operator/order-lifecycle/:requestCode/actions/DISPOSITION',
            order: 70,
          },
        ]}
        record={{ code: 'order-1:return:1', status: 'SUBMITTED' }}
        schema={{ ...schema, moduleName: 'order', schemaName: 'orderLifecycleRequest' }}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onLifecycleAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Backend lifecycle action completed.')).toBeVisible();
    expect(screen.getByText(/DISPOSITION_RECORDED/)).toBeVisible();
  });

  it('renders Promotion Builder coupon and analytics actions from backend metadata', async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue({ batch: { status: 'GENERATED' } });
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        lifecycleActions={[
          {
            id: 'promotion-create-coupon-batch',
            label: 'Create coupon batch',
            intent: 'CREATE',
            ownerModule: 'promotion',
            handlerAction: 'createCouponBatch',
            httpMethod: 'POST',
            operationRoute: '/backoffice/promotions/:promotionCode/coupon-batches',
            order: 70,
            inputFields: [
              {
                name: 'promotionCode',
                label: 'Promotion code',
                type: 'HIDDEN',
                required: true,
                valueFromRecord: 'code',
                maximumLength: 128,
              },
              {
                name: 'batchCode',
                label: 'Coupon batch code',
                type: 'TEXT',
                required: true,
                maximumLength: 128,
              },
              {
                name: 'couponCodes',
                label: 'Coupon codes JSON',
                type: 'JSON',
                required: true,
                defaultValue: '["PROMO10A","PROMO10B"]',
                maximumLength: 4000,
              },
            ],
          },
          {
            id: 'promotion-analytics',
            label: 'Analytics',
            intent: 'VALIDATE',
            ownerModule: 'promotion',
            handlerAction: 'analytics',
            httpMethod: 'GET',
            operationRoute: '/backoffice/promotions/:promotionCode/analytics',
            order: 110,
            inputFields: [
              {
                name: 'promotionCode',
                label: 'Promotion code',
                type: 'HIDDEN',
                required: true,
                valueFromRecord: 'code',
                maximumLength: 128,
              },
            ],
          },
        ]}
        record={{ code: 'agoraWelcome10', status: 'APPROVED' }}
        schema={{ ...schema, moduleName: 'promotion', schemaName: 'promotion' }}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onLifecycleAction={execute}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Create coupon batch/ }));

    expect(screen.getByText(/POST \/backoffice\/promotions\/:promotionCode\/coupon-batches/)).toBeVisible();
    expect(screen.getByDisplayValue('["PROMO10A","PROMO10B"]')).toBeVisible();
    await user.type(screen.getAllByRole('textbox')[0]!, 'agoraWelcome10-batch');
    await user.click(screen.getAllByRole('button', { name: /Create coupon batch/ }).at(-1)!);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ handlerAction: 'createCouponBatch' }),
      expect.objectContaining({ code: 'agoraWelcome10' }),
      expect.objectContaining({
        promotionCode: 'agoraWelcome10',
        batchCode: 'agoraWelcome10-batch',
        couponCodes: '["PROMO10A","PROMO10B"]',
      }),
    );
  });

  it('executes hidden-field Promotion Builder analytics actions without opening a form', async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue({ redemptionCount: 2 });
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        lifecycleActions={[
          {
            id: 'promotion-analytics',
            label: 'Analytics',
            intent: 'VALIDATE',
            ownerModule: 'promotion',
            handlerAction: 'analytics',
            httpMethod: 'GET',
            operationRoute: '/backoffice/promotions/:promotionCode/analytics',
            order: 110,
            inputFields: [
              {
                name: 'promotionCode',
                label: 'Promotion code',
                type: 'HIDDEN',
                required: true,
                valueFromRecord: 'code',
                maximumLength: 128,
              },
            ],
          },
        ]}
        record={{ code: 'agoraWelcome10', status: 'APPROVED' }}
        schema={{ ...schema, moduleName: 'promotion', schemaName: 'promotion' }}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onLifecycleAction={execute}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Analytics/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ handlerAction: 'analytics', httpMethod: 'GET' }),
      expect.objectContaining({ code: 'agoraWelcome10' }),
      expect.objectContaining({ promotionCode: 'agoraWelcome10' }),
    );
  });

  it('renders dates and booleans as user-friendly localized values', () => {
    const formattedSchema: WorkbenchSchema = {
      ...schema,
      fields: [
        ...schema.fields,
        {
          name: 'enabled',
          label: 'Enabled',
          type: 'boolean',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
        {
          name: 'created',
          label: 'Created',
          type: 'date',
          required: false,
          readOnly: true,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
    };
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{
          code: 'DXB-OFFICE',
          enabled: true,
          created: '2026-07-25T10:00:00.000Z',
        }}
        schema={formattedSchema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Yes')).toBeVisible();
    expect(screen.getByText(/2026/)).toBeVisible();
    expect(screen.queryByText('2026-07-25T10:00:00.000Z')).not.toBeInTheDocument();
  });

  it('renders inline nested fields without showing the parent object as related data', () => {
    const employeeSchema: WorkbenchSchema = {
      ...schema,
      label: 'Employee',
      displayProperty: 'loginId',
      displayProperties: ['loginId', 'name.firstName', 'name.lastName'],
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
    };
    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{
          loginId: 'admin',
          name: { firstName: 'Admin', lastName: 'User' },
        }}
        schema={employeeSchema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Admin')).toBeVisible();
    expect(screen.getByText('User')).toBeVisible();
    expect(screen.queryByText('Related data')).not.toBeInTheDocument();
  });

  it('opens referenced schema records from backend relationship descriptors', async () => {
    const user = userEvent.setup();
    const enterpriseSchema: WorkbenchSchema = {
      ...schema,
      schemaName: 'enterprise',
      label: 'Enterprise',
      fields: [
        ...schema.fields,
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
          description: '',
          targetModule: 'profile',
          targetSchema: 'tenant',
          cardinality: 'ONE',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: true,
          maximumDepth: 3,
        },
      ],
    };
    const tenantSchema: WorkbenchSchema = {
      ...schema,
      schemaName: 'tenant',
      label: 'Tenant',
      fields: [
        ...schema.fields,
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
    };
    const resolveRecord = vi.fn().mockResolvedValue({
      record: { code: 'default', description: 'Default tenant' },
      schema: tenantSchema,
    });

    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{ code: 'defaultEnterprise', tenant: 'default' }}
        relationshipRuntime={{
          schemas: [tenantSchema],
          queryScope: ['default'],
          createRecord: vi.fn(),
          loadRecords: vi.fn(),
          resolveRecord,
        }}
        schema={enterpriseSchema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'default' }));

    expect(resolveRecord).toHaveBeenCalledWith(
      enterpriseSchema.relationships[0],
      'default',
    );
    expect(await screen.findByText('Default tenant')).toBeVisible();
  });

  it('opens individual references from one-to-many relationship fields', async () => {
    const user = userEvent.setup();
    const workflowActionSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowAction',
      label: 'Workflow Action',
      fields: [
        ...schema.fields,
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
          description: '',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          cardinality: 'MANY',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
          maximumDepth: 3,
        },
      ],
    };
    const workflowChannelSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowChannel',
      label: 'Channels',
      fields: [
        ...schema.fields,
        {
          name: 'target',
          label: 'Target',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
    };
    const resolveRecord = vi.fn().mockResolvedValue({
      record: { code: 'defaultRejectChannel', target: 'defaultRejectAction' },
      schema: workflowChannelSchema,
    });

    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{
          code: 'reviewCmsPageAction',
          channels: ['publishCmsPageChannel', 'defaultRejectChannel'],
        }}
        relationshipRuntime={{
          schemas: [workflowChannelSchema],
          queryScope: ['default'],
          createRecord: vi.fn(),
          loadRecords: vi.fn(),
          resolveRecord,
        }}
        schema={workflowActionSchema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'defaultRejectChannel' }));

    expect(resolveRecord).toHaveBeenCalledWith(
      workflowActionSchema.relationships[0],
      'defaultRejectChannel',
    );
    expect(await screen.findByText('Channels: defaultRejectChannel')).toBeVisible();
    expect(screen.getByText('defaultRejectAction')).toBeVisible();
  });

  it('expands additional one-to-many detail references before opening them', async () => {
    const user = userEvent.setup();
    const workflowActionSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowAction',
      label: 'Workflow Action',
      fields: [
        ...schema.fields,
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
          description: '',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          cardinality: 'MANY',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
          maximumDepth: 3,
        },
      ],
    };
    const workflowChannelSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowChannel',
      label: 'Channels',
      fields: [
        ...schema.fields,
        {
          name: 'target',
          label: 'Target',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
    };
    const resolveRecord = vi.fn().mockResolvedValue({
      record: { code: 'auditChannel', target: 'auditAction' },
      schema: workflowChannelSchema,
    });

    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        editLabel="Edit"
        falseLabel="No"
        record={{
          code: 'reviewCmsPageAction',
          channels: ['successChannel', 'rejectChannel', 'errorChannel', 'auditChannel'],
        }}
        relationshipRuntime={{
          schemas: [workflowChannelSchema],
          queryScope: ['default'],
          createRecord: vi.fn(),
          loadRecords: vi.fn(),
          resolveRecord,
        }}
        schema={workflowActionSchema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'auditChannel' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+1 more' }));
    await user.click(screen.getByRole('button', { name: 'auditChannel' }));

    expect(resolveRecord).toHaveBeenCalledWith(
      workflowActionSchema.relationships[0],
      'auditChannel',
    );
    expect(await screen.findByText('Channels: auditChannel')).toBeVisible();
    expect(screen.getByText('auditAction')).toBeVisible();
  });

  it('opens references from related-record detail panel tables', async () => {
    const user = userEvent.setup();
    const workflowChannelSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowChannel',
      label: 'Workflow Channel',
      displayProperty: 'code',
      displayProperties: ['code', 'target'],
      fields: [
        ...schema.fields,
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
    const workflowStepSchema: WorkbenchSchema = {
      ...schema,
      moduleName: 'workflow',
      schemaName: 'workflowStep',
      label: 'Workflow Step',
      displayProperty: 'code',
      displayProperties: ['code', 'channels'],
      fields: [
        ...schema.fields,
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
          description: '',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          cardinality: 'MANY',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
          maximumDepth: 3,
        },
      ],
    };
    const resolveRecord = vi.fn().mockResolvedValue({
      record: { code: 'defaultRejectChannel', target: 'defaultRejectAction' },
      schema: workflowChannelSchema,
    });

    render(
      <WorkbenchRecordDetail
        closeLabel="Close"
        deleteLabel="Delete"
        detailPanels={[
          {
            panel: {
              id: 'steps',
              label: 'Workflow steps',
              order: 0,
              target: {
                moduleName: 'workflow',
                schemaName: 'workflowStep',
              },
              relation: {
                sourceField: 'code',
                targetField: 'workflowCode',
                cardinality: 'MANY',
              },
              summary: 'Steps linked to this workflow.',
            },
            schema: workflowStepSchema,
            page: {
              records: [
                {
                  code: 'reviewStep',
                  channels: ['defaultRejectChannel'],
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            },
            loading: false,
          },
        ]}
        editLabel="Edit"
        falseLabel="No"
        record={{ code: 'reviewWorkflow' }}
        relationshipRuntime={{
          schemas: [workflowStepSchema, workflowChannelSchema],
          queryScope: ['default'],
          createRecord: vi.fn(),
          loadRecords: vi.fn(),
          resolveRecord,
        }}
        schema={schema}
        trueLabel="Yes"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'defaultRejectChannel' }));

    expect(resolveRecord).toHaveBeenCalledWith(
      workflowStepSchema.relationships[0],
      'defaultRejectChannel',
    );
    expect(
      await screen.findByText('Workflow Channel: defaultRejectChannel'),
    ).toBeVisible();
    expect(screen.getByText('defaultRejectAction')).toBeVisible();
  });
});
