import { WorkbenchRecordForm } from '../../../src/workbench/form/WorkbenchRecordForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import type {
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../../../src/workbench/api/workbenchContracts';
import { RelationshipFieldRenderer } from '../../../src/workbench/form/RelationshipFieldRenderer';
import {
  defaultRelationshipCopy,
  type WorkbenchRelationshipDraft,
  type WorkbenchRelationshipRuntime,
} from '../../../src/workbench/form/WorkbenchRelationshipRuntime';

const website: WorkbenchSchema = {
  moduleName: 'cms',
  schemaName: 'cmssite',
  label: 'Website',
  description: '',
  connectionInstanceId: 'staged-owner',
  connectionServer: 'staged',
  connectionEnvironment: 'local',
  displayProperty: 'name',
  displayProperties: ['name', 'code'],
  queryCapabilities: {
    searchableFields: ['name', 'code'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [25],
    defaultPageSize: 25,
    maximumPageSize: 25,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'READ_ONLY',
  operations: ['search', 'read'],
  fields: [],
  relationships: [],
};
const relationship: WorkbenchRelationship = {
  field: 'sites',
  label: 'Websites',
  description: 'Choose the website where this content belongs.',
  targetModule: 'cms',
  targetSchema: 'cmssite',
  cardinality: 'MANY',
  referenceProperty: 'code',
  resolution: 'LOCAL_OR_REMOTE',
  actions: ['SELECT_EXISTING', 'UNLINK'],
  required: true,
};
function mount() {
  const loadRecords = vi
    .fn()
    .mockResolvedValue([{ code: 'site-a', name: 'North Star' }]);
  const createRecord = vi.fn();
  const onChange = vi.fn();
  const runtime: WorkbenchRelationshipRuntime = {
    schemas: [website],
    queryScope: ['actor-a', 'tenant-a', 'enterprise-a'],
    loadRecords,
    createRecord,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness({
    currentRuntime = runtime,
    schema = website,
  }: {
    currentRuntime?: WorkbenchRelationshipRuntime;
    schema?: WorkbenchSchema;
  }) {
    const [draft, setDraft] = useState<WorkbenchRelationshipDraft>({
      references: [],
      pending: [],
    });
    return (
      <RelationshipFieldRenderer
        copy={defaultRelationshipCopy}
        disabled={false}
        draft={draft}
        relationship={relationship}
        runtime={currentRuntime}
        targetSchema={schema}
        depth={0}
        lineage={[]}
        onChange={(next) => {
          onChange(next);
          setDraft(next);
        }}
      />
    );
  }
  const tree = (currentRuntime = runtime, schema = website) => (
    <QueryClientProvider client={client}>
      <Harness currentRuntime={currentRuntime} schema={schema} />
    </QueryClientProvider>
  );
  const view = render(tree());
  return {
    ...view,
    runtime,
    loadRecords,
    createRecord,
    onChange,
    update: (currentRuntime = runtime, schema = website) =>
      view.rerender(tree(currentRuntime, schema)),
    user: userEvent.setup(),
  };
}
async function choose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Select existing' }));
  await user.click(
    await screen.findByRole('checkbox', { name: 'North Star - site-a' }),
  );
  await user.click(screen.getByRole('button', { name: 'Select existing' }));
}
it('retains the owner display name after selection without changing the saved reference or adding reads', async () => {
  const f = mount();
  await choose(f.user);
  expect(screen.getByRole('button', { name: 'North Star - site-a' })).toBeVisible();
  expect(f.onChange).toHaveBeenLastCalledWith({ references: ['site-a'], pending: [] });
  expect(f.loadRecords).toHaveBeenCalledOnce();
  expect(f.createRecord).not.toHaveBeenCalled();
});
it('shows the owner relationship guidance next to its field', () => {
  mount();
  expect(screen.getByText(relationship.description)).toBeVisible();
  expect(screen.getByRole('group', { name: /Websites/ })).toHaveAccessibleDescription(
    relationship.description,
  );
});

it('keeps a chosen label when the user searches again and closes the picker', async () => {
  const f = mount();
  await choose(f.user);
  await f.user.click(screen.getByRole('button', { name: 'Select existing' }));
  await f.user.type(screen.getByRole('textbox', { name: 'Search records' }), 'other');
  await f.user.click(screen.getByRole('button', { name: 'Select existing' }));
  expect(screen.getByRole('button', { name: 'North Star - site-a' })).toBeVisible();
  expect(f.onChange).toHaveBeenCalledOnce();
});
it('uses the readable removal label but submits only removal of the original reference', async () => {
  const f = mount();
  await choose(f.user);
  await f.user.click(
    screen.getByRole('button', { name: 'Remove association North Star - site-a' }),
  );
  expect(f.onChange).toHaveBeenLastCalledWith({ references: [], pending: [] });
  expect(
    screen.queryByRole('button', { name: 'North Star - site-a' }),
  ).not.toBeInTheDocument();
  expect(f.createRecord).not.toHaveBeenCalled();
});
it('keeps labels through an unchanged source snapshot but retires them on actor replacement', async () => {
  const f = mount();
  await choose(f.user);
  f.update({ ...f.runtime, queryScope: [...f.runtime.queryScope] });
  expect(screen.getByRole('button', { name: 'North Star - site-a' })).toBeVisible();
  f.update({ ...f.runtime, queryScope: ['actor-b', 'tenant-b', 'enterprise-b'] });
  expect(
    screen.queryByRole('button', { name: 'North Star - site-a' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'site-a' })).toBeVisible();
  expect(f.onChange).toHaveBeenCalledOnce();
});
it('retires source labels when a connection partition changes without issuing another lookup', async () => {
  const f = mount();
  await choose(f.user);
  f.update({
    ...f.runtime,
    queryScope: [...f.runtime.queryScope, 'new-endpoint-scope'],
  });
  expect(
    screen.queryByRole('button', { name: 'North Star - site-a' }),
  ).not.toBeInTheDocument();
  expect(f.loadRecords).toHaveBeenCalledOnce();
});
it('does not reuse labels under a different owner display projection', async () => {
  const f = mount();
  await choose(f.user);
  f.update(f.runtime, { ...website, displayProperties: ['code'] });
  expect(
    screen.queryByRole('button', { name: 'North Star - site-a' }),
  ).not.toBeInTheDocument();
  expect(f.onChange).toHaveBeenCalledOnce();
});
it('retires a pending explicit record inspection when its private scope changes', async () => {
  const f = mount();
  await choose(f.user);
  let resolve!: (value: {
    record: Readonly<Record<string, unknown>>;
    schema: WorkbenchSchema;
  }) => void;
  const old = new Promise<{
    record: Readonly<Record<string, unknown>>;
    schema: WorkbenchSchema;
  }>((r) => {
    resolve = r;
  });
  const resolveRecord = vi.fn().mockReturnValue(old);
  f.update({ ...f.runtime, resolveRecord });
  await f.user.click(screen.getByRole('button', { name: 'North Star - site-a' }));
  expect(resolveRecord).toHaveBeenCalledOnce();
  f.update({
    ...f.runtime,
    resolveRecord,
    queryScope: ['new-actor', 'tenant-b', 'enterprise-b'],
  });
  await act(async () => {
    resolve({
      record: { code: 'site-a', name: 'Prior private website' },
      schema: website,
    });
    await old;
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('Prior private website')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'North Star - site-a' }),
  ).not.toBeInTheDocument();
});

it('keeps readable references in review and back navigation while saving only canonical values', async () => {
  const schema: WorkbenchSchema = {
    ...website,
    schemaName: 'campaign',
    label: 'Campaign',
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
        name: 'sites',
        label: 'Websites',
        type: 'array',
        required: true,
        readOnly: false,
        primary: false,
        description: '',
        searchable: false,
      },
    ],
    relationships: [relationship],
    form: {
      contractVersion: 1,
      hiddenFields: [],
      managedCreateFields: [],
      defaultColumns: ['code'],
      copy: {},
      sections: [
        { id: 'identity', label: 'Identity', fields: ['code'] },
        { id: 'placement', label: 'Placement', fields: ['sites'] },
      ],
    },
  };
  const submit = vi.fn();
  const loadRecords = vi
    .fn()
    .mockResolvedValue([{ code: 'site-a', name: 'North Star' }]);
  const runtime: WorkbenchRelationshipRuntime = {
    schemas: [website],
    queryScope: ['actor-a', 'tenant-a', 'enterprise-a'],
    loadRecords,
    createRecord: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkbenchRecordForm
        schema={schema}
        initialModel={{ code: 'campaign-a' }}
        relationshipRuntime={runtime}
        relationshipCopy={defaultRelationshipCopy}
        saving={false}
        savingLabel="Saving"
        submitLabel="Save"
        cancelLabel="Cancel"
        onSubmit={submit}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await choose(user);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('North Star - site-a')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Edit Placement' }));
  expect(screen.getByRole('button', { name: 'North Star - site-a' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({ code: 'campaign-a', sites: ['site-a'] }),
  );
  expect(loadRecords).toHaveBeenCalledOnce();
});
