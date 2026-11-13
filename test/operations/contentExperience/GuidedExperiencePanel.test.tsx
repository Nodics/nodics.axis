import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { GuidedExperiencePanel } from '../../../src/operations/contentExperience/GuidedExperiencePanel';
import * as cms from '../../../src/operations/contentExperience/api/contentDesignerClient';
import * as experience from '../../../src/operations/contentExperience/api/wcmsExperienceClient';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
vi.mock(
  '../../../src/operations/contentExperience/ContentDesignerSavedPagePanel',
  () => ({ ContentDesignerSavedPagePanel: () => <div>Saved content editor</div> }),
);
const connection: AxisModuleConnection = {
  moduleName: 'wcmsExperience',
  instanceId: 'staged',
  endpoint: 'https://owner.example/nodics/wcmsExperience',
  environment: 'local',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const bootstrap = {
  moduleConnections: { cms: [{ ...connection, moduleName: 'cms' }] },
  navigation: [],
} as unknown as AxisAuthenticatedBootstrap;
const placement: experience.GuidedExperiencePlacement = {
  code: 'selected',
  site: 'site',
  pageType: 'HOME',
  slot: 'hero',
  targetType: 'COLLECTION',
  targetCode: 'summer',
  component: 'hero',
  rendererKey: 'hero',
  contractVersion: 0,
  priority: 20,
  revision: 4,
  locale: 'en',
  channel: 'web',
};
const inspection: experience.GuidedExperienceInspection = {
  catalogCode: 'catalog',
  siteCode: 'site',
  pageCode: 'page',
  sourceVersion: 'a'.repeat(64),
  pageSourceVersion: 'b'.repeat(64),
  pageName: 'Business page',
  canEdit: true,
  maximumAbsolutePriority: 100,
  pageTypes: ['HOME'],
  slots: ['hero'],
  targets: [
    { targetType: 'COLLECTION', targetCode: 'summer', label: 'Summer collection' },
  ],
  components: [{ code: 'hero', label: 'Welcome' }],
  placements: [placement],
  competingPlacements: [placement, { ...placement, code: 'overlap' }],
  presentation: { targetHelp: 'Choose an existing configured target.' },
};
async function setup(value = inspection) {
  vi.spyOn(cms, 'loadContentDesignerAuthoringModel').mockResolvedValue({
    metadata: {
      contentCatalogs: [{ code: 'catalog', name: 'Catalog' }],
      sites: [{ code: 'site', name: 'Website', catalogCode: 'catalog' }],
    },
  } as unknown as cms.ContentDesignerAuthoringModel);
  vi.spyOn(cms, 'listContentDesignerPages').mockResolvedValue([
    { code: 'page', name: 'Page' },
  ]);
  const inspect = vi
    .spyOn(experience, 'inspectGuidedExperience')
    .mockResolvedValue(value);
  const save = vi
    .spyOn(experience, 'saveGuidedExperience')
    .mockRejectedValue(new Error('Acknowledgement unavailable'));
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <GuidedExperiencePanel
          bootstrap={bootstrap}
          connection={connection}
          configuration={{
            accessToken: 'employee',
            enterpriseCode: 'enterprise',
            timeoutMs: 1000,
          }}
          cachePartition="employee-scope"
          locale="en"
          channel="web"
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Content catalog' }));
  await user.click(screen.getByRole('option', { name: 'Catalog' }));
  await user.click(screen.getByRole('combobox', { name: 'Experience website' }));
  await user.click(screen.getByRole('option', { name: 'Website' }));
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Experience page' }),
    ).not.toHaveAttribute('aria-disabled', 'true'),
  );
  await user.click(screen.getByRole('combobox', { name: 'Experience page' }));
  await user.click(screen.getByRole('option', { name: 'Page' }));
  await user.click(await screen.findByRole('combobox', { name: 'Saved placement' }));
  await user.click(screen.getByRole('option', { name: /selected · hero/ }));
  return { user, inspect, save };
}
afterEach(() => vi.restoreAllMocks());
it('requires distinct priority and explicit confirmation, then holds an unknown write until owner inspection', async () => {
  const { user, inspect, save } = await setup();
  expect(screen.getByText(/Choose a distinct priority before saving/)).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Review placement changes' }),
  ).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Placement priority' }), {
    target: { value: '30' },
  });
  await user.click(screen.getByRole('button', { name: 'Review placement changes' }));
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save inspected placement' }));
  await screen.findByText('Acknowledgement unavailable');
  expect(save).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Saved placement' })).toHaveAttribute(
      'aria-disabled',
      'true',
    ),
  );
  expect(
    screen.getByRole('button', { name: 'Review placement changes' }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Inspect saved placements' }));
  await waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(1);
});
it('preserves read-only owner admission and allows discarding an unsubmitted edit', async () => {
  const { save } = await setup({ ...inspection, canEdit: false });
  expect(screen.getByRole('spinbutton', { name: 'Placement priority' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Review placement changes' }),
  ).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
});
it('discards local placement changes without invoking a command', async () => {
  const { user, save } = await setup();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Placement priority' }), {
    target: { value: '30' },
  });
  await user.click(
    screen.getByRole('button', { name: 'Discard local placement changes' }),
  );
  expect(screen.getByRole('spinbutton', { name: 'Placement priority' })).toHaveValue(
    20,
  );
  expect(save).not.toHaveBeenCalled();
});

it('announces pending progress inside the modal and cannot submit twice', async () => {
  const { user, save } = await setup();
  let resolve!: (value: { code: string; revision: number }) => void;
  save.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Placement priority' }), {
    target: { value: '30' },
  });
  await user.click(screen.getByRole('button', { name: 'Review placement changes' }));
  await user.click(screen.getByRole('button', { name: 'Save inspected placement' }));
  const dialog = screen.getByRole('dialog', { name: 'Save this placement revision?' });
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'Saving the inspected placement',
  );
  const submit = within(dialog).getByRole('button', {
    name: 'Save inspected placement',
  });
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(save).toHaveBeenCalledOnce();
  await act(async () => {
    resolve({ code: 'selected', revision: 5 });
    await Promise.resolve();
  });
  expect(
    await screen.findByText(/Placement saved. Inspect saved placements/),
  ).toBeVisible();
});
