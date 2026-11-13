import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ContentDesignerSavedPagePanel } from '../../../src/operations/contentExperience/ContentDesignerSavedPagePanel';
import * as api from '../../../src/operations/contentExperience/api/contentDesignerClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';

const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'staged',
  endpoint: 'https://cms.example/nodics/cms',
  environment: 'local',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = {
  accessToken: 'employee',
  enterpriseCode: 'enterprise',
  timeoutMs: 1000,
};
const model: api.ContentDesignerAuthoringModel = {
  defaults: {
    componentKinds: [
      {
        label: 'Hero',
        typeCode: 'hero',
        renderer: 'heroRenderer',
        fields: [
          { property: 'title', label: 'Heading', control: 'text', required: true },
        ],
      },
      {
        label: 'Story',
        typeCode: 'story',
        renderer: 'storyRenderer',
        fields: [
          {
            property: 'body',
            label: 'Story text',
            control: 'multiline',
            required: true,
          },
        ],
      },
    ],
    draftDefaults: { catalogCode: 'catalog' },
    requireNavigationForPublish: false,
  },
  hierarchy: [],
  rules: {
    arbitrarySlots: true,
    catalogFirst: true,
    frontendPersistence: false,
    pixelPerfectRendering: false,
  },
  operations: [
    'listDraftPages',
    'getDraftComposition',
    'validateDraftComposition',
    'saveDraftComposition',
    'submitForPublication',
  ],
  metadata: {
    contentCatalogs: [{ code: 'catalog', name: 'Brand content' }],
    sites: [{ code: 'site', name: 'Business website', catalogCode: 'catalog' }],
    pageTemplates: [],
    pageTypes: [],
    componentTypeGroups: [],
    componentTypes: [
      { code: 'hero', name: 'Hero', propertySchema: { title: { localized: true } } },
      { code: 'story', name: 'Story', propertySchema: {} },
    ],
    slotDefinitions: [{ code: 'main-slot', name: 'main', templateCode: 'template' }],
    mediaFolders: [],
    mediaFormats: [],
    mediaTypes: [],
    navigationNodes: [],
    localization: {
      defaultLocale: 'en',
      supportedLocales: ['en', 'ar'],
      fallbackLocales: [],
    },
    publicationReadiness: {
      requiredDraftParts: [],
      requireNavigationForPublish: false,
    },
  },
};
function saved(): api.ContentDesignerSavedPage {
  const sourceVersion = 'a'.repeat(64);
  return {
    sourceVersion,
    editable: true,
    issues: [],
    draft: {
      sourceVersion,
      catalogCode: 'catalog',
      siteCode: 'site',
      templateCode: 'template',
      page: { code: 'page', name: 'Business page', typeCode: 'pageType' },
      route: { code: 'route', path: '/business', locale: 'en' },
      sections: [
        {
          code: 'hero-placement',
          slot: 'main',
          index: 0,
          components: [
            {
              code: 'hero-block',
              typeCode: 'hero',
              renderer: 'heroRenderer',
              properties: { title: 'Welcome', extension: { keep: true } },
              localizations: [
                {
                  code: 'legacy-english',
                  locale: 'en',
                  properties: { title: 'Welcome' },
                  seo: { keep: true },
                  status: 'READY',
                },
              ],
              media: [{ code: 'hero-media', mediaCode: 'image' }],
            },
          ],
        },
        {
          code: 'story-placement',
          slot: 'main',
          index: 1,
          components: [
            {
              code: 'story-block',
              typeCode: 'story',
              renderer: 'storyRenderer',
              properties: { body: 'Original story' },
              localizations: [],
              media: [],
            },
          ],
        },
      ],
    },
  };
}
function setup(
  value = saved(),
  authority = model,
  canInspectPublishing = false,
  initialSelection?: { catalogCode: string; siteCode: string; pageCode: string },
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  vi.spyOn(api, 'listContentDesignerPages').mockResolvedValue([
    { code: 'page', name: 'Business page' },
  ]);
  const read = vi
    .spyOn(api, 'loadContentDesignerPage')
    .mockImplementation(() => Promise.resolve(structuredClone(value)));
  const validate = vi
    .spyOn(api, 'validateContentDesignerDraft')
    .mockResolvedValue({ valid: true, status: 'VALID_DRAFT' });
  const save = vi
    .spyOn(api, 'saveContentDesignerDraft')
    .mockResolvedValue({ status: 'DRAFT_SAVED' });
  const publish = vi
    .spyOn(api, 'submitContentDesignerDraftForPublication')
    .mockResolvedValue({ status: 'PENDING_APPROVAL' });
  const pending = vi.fn();
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ContentDesignerSavedPagePanel
          initialSelection={initialSelection}
          cachePartition="actor"
          connection={connection}
          configuration={configuration}
          model={authority}
          canInspectPublishing={canInspectPublishing}
          disabled={false}
          onPendingChange={pending}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { read, validate, save, publish, pending };
}
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Exact saved page code' }));
  await screen.findByRole('textbox', { name: 'Exact saved page code' });
  fireEvent.change(screen.getByLabelText('Exact saved page code'), {
    target: { value: 'page' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open saved page' }));
  await screen.findByRole('heading', { name: 'Business page' });
}
afterEach(() => vi.restoreAllMocks());

describe('saved Designer business editing', () => {
  it('checks the current owner before editing a continuation with an older cached result', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const prior = saved();
    const cached = {
      ...prior,
      draft: {
        ...prior.draft,
        page: { ...prior.draft.page, name: 'Older cached page' },
      },
    };
    queryClient.setQueryData(
      [
        'designer-created-page',
        'actor',
        connection.endpoint,
        configuration.enterpriseCode,
        'catalog',
        'site',
        'page',
      ],
      cached,
    );
    const calls = setup(
      saved(),
      model,
      false,
      { catalogCode: 'catalog', siteCode: 'site', pageCode: 'page' },
      queryClient,
    );
    await screen.findByRole('heading', { name: 'Business page' });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Heading' })).toBeEnabled(),
    );
    expect(screen.queryByRole('heading', { name: 'Older cached page' })).toBeNull();
    expect(calls.read).toHaveBeenCalledOnce();
    expect(calls.save).not.toHaveBeenCalled();
  });
  it('continues an explicit created-page selection with one exact read and compact accessible fields', async () => {
    const calls = setup(saved(), model, false, {
      catalogCode: 'catalog',
      siteCode: 'site',
      pageCode: 'page',
    });
    await screen.findByRole('heading', { name: 'Business page' });
    expect(calls.read).toHaveBeenCalledOnce();
    expect(calls.read.mock.calls[0]?.[2]).toEqual({
      catalogCode: 'catalog',
      siteCode: 'site',
      pageCode: 'page',
    });
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('Welcome');
    expect(screen.queryByRole('heading', { name: 'Page content' })).toBeNull();
    expect(screen.getAllByRole('region', { name: 'Content for main' })).toHaveLength(2);
    fireEvent.change(screen.getByRole('textbox', { name: 'Story text' }), {
      target: { value: 'Local update' },
    });
    await waitFor(() => expect(calls.pending).toHaveBeenLastCalledWith(true));
    expect(calls.read).toHaveBeenCalledOnce();
    expect(calls.save).not.toHaveBeenCalled();
    expect(calls.publish).not.toHaveBeenCalled();
  });

  it('does not substitute another website for a no-longer-admitted created-page selection', async () => {
    const calls = setup(saved(), model, false, {
      catalogCode: 'catalog',
      siteCode: 'foreign',
      pageCode: 'page',
    });
    expect(screen.getByRole('button', { name: 'Open saved page' })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Saved page website' }),
    ).not.toHaveTextContent('Business website');
    await Promise.resolve();
    expect(calls.read).not.toHaveBeenCalled();
    expect(calls.save).not.toHaveBeenCalled();
  });
  it('retains unconfirmed local content and the parent hold until the user explicitly selects inspected saved state', async () => {
    const calls = setup();
    calls.save.mockRejectedValue(new Error('Partial save unconfirmed'));
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: /^Story text/ }), {
      target: { value: 'Retain this local story' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save page changes' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save page changes' }));
    await screen.findByText('Partial save unconfirmed');
    expect(calls.pending).toHaveBeenLastCalledWith(true);
    const partial = saved();
    calls.read.mockResolvedValueOnce({
      ...partial,
      sourceVersion: 'b'.repeat(64),
      draft: {
        ...partial.draft,
        sourceVersion: 'b'.repeat(64),
        sections: partial.draft.sections.slice(0, 1),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open saved page' }));
    await screen.findByText(/The saved owner composition has 1 content blocks/);
    expect(screen.getByRole('textbox', { name: /^Story text/ })).toHaveValue(
      'Retain this local story',
    );
    expect(screen.getByRole('textbox', { name: /^Story text/ })).toBeDisabled();
    expect(calls.pending).toHaveBeenLastCalledWith(true);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use saved version and discard local page edits',
      }),
    );
    await waitFor(() => expect(calls.pending).toHaveBeenLastCalledWith(false));
    expect(
      screen.queryByRole('textbox', { name: /^Story text/ }),
    ).not.toBeInTheDocument();
    expect(calls.save).toHaveBeenCalledOnce();
    expect(calls.publish).not.toHaveBeenCalled();
  });

  it('a CMS page read cannot resolve an uncertain publication outcome or permit another submission', async () => {
    const calls = setup(saved(), model, true);
    calls.publish.mockRejectedValue(new Error('Publication outcome unconfirmed'));
    await open();
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Submit saved page for approval' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit saved page for approval' }),
    );
    await screen.findByText('Publication outcome unconfirmed');
    fireEvent.click(screen.getByRole('button', { name: 'Open saved page' }));
    await screen.findByText(/publication outcome remains unconfirmed/);
    expect(
      screen.getByRole('button', {
        name: 'Use saved version and discard local page edits',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submit saved page for approval' }),
    ).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^Story text/ })).toBeDisabled();
    expect(calls.pending).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole('link', { name: 'Inspect publication request' }),
    ).toHaveAttribute(
      'href',
      '/publishing/requests?sourceServer=&sourceEnvironment=local',
    );
    expect(calls.publish).toHaveBeenCalledOnce();
  });

  it('a confirmed publication retains its exact inspection link and cannot be submitted twice from this view', async () => {
    const calls = setup(saved(), model, true);
    calls.publish.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      publication: { code: 'cms-site-route-0' },
    });
    await open();
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Submit saved page for approval' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit saved page for approval' }),
    );
    await screen.findByText(/Publication requested/);
    fireEvent.click(screen.getByRole('button', { name: 'Open saved page' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^Story text/ })).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Submit saved page for approval' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'Inspect publication request' }),
    ).toHaveAttribute(
      'href',
      '/publishing/requests?publicationCode=cms-site-route-0&sourceServer=&sourceEnvironment=local',
    );
    expect(calls.publish).toHaveBeenCalledOnce();
  });
  it('edits separate block types while retaining source, sibling, placement, translation and Media identities', async () => {
    const calls = setup();
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: /^Story text/ }), {
      target: { value: 'Updated story' },
    });
    expect(screen.getByRole('button', { name: 'Save page changes' })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save page changes' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save page changes' }));
    await screen.findByText(
      'Draft saved. Reopen the saved page to inspect the result and continue.',
    );
    expect(calls.save).toHaveBeenCalledTimes(1);
    expect(calls.publish).not.toHaveBeenCalled();
    const submitted = calls.save.mock.calls[0]![2];
    expect(submitted.sourceVersion).toBe('a'.repeat(64));
    expect(submitted.sections[0]).toEqual(saved().draft.sections[0]);
    expect(submitted.sections[1]?.code).toBe('story-placement');
    expect(submitted.sections[1]?.components[0]?.properties?.body).toBe(
      'Updated story',
    );
    expect(screen.getByRole('textbox', { name: /^Story text/ })).toBeDisabled();
    expect(calls.read).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open saved page' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /^Story text/ })).toBeEnabled(),
    );
    expect(calls.read).toHaveBeenCalledTimes(2);
    expect(calls.save).toHaveBeenCalledTimes(1);
  });

  it('adds and reorders distinct blocks locally without retiring saved placements or sending writes', async () => {
    const calls = setup();
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add content block' }));
    expect(screen.getAllByRole('textbox', { name: /^Heading/ })).toHaveLength(2);
    // Complete the new block before checking owner-bound ordering and identity.
    fireEvent.change(screen.getAllByRole('textbox', { name: /^Heading/ })[1]!, {
      target: { value: 'Added hero heading' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move block 2 up' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() => expect(calls.validate).toHaveBeenCalledTimes(1));
    const draft = calls.validate.mock.calls[0]![2];
    expect(draft.sections.map((section) => section.code)).toEqual([
      'story-placement',
      'hero-placement',
      undefined,
    ]);
    expect(draft.sections.map((section) => section.index)).toEqual([0, 1, 2]);
    expect(calls.save).not.toHaveBeenCalled();
    expect(calls.publish).not.toHaveBeenCalled();
  });

  it('marks edited translations unfinished while preserving their identity and metadata', async () => {
    const calls = setup();
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: /^Heading/ }), {
      target: { value: 'New heading' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark block en ready' })[0]!);
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() => expect(calls.validate).toHaveBeenCalledTimes(1));
    const block = calls.validate.mock.calls[0]![2].sections[0]!.components[0]!;
    expect(block.properties).toEqual({
      title: 'New heading',
      extension: { keep: true },
    });
    expect(block.localizations?.[0]).toEqual({
      code: 'legacy-english',
      locale: 'en',
      properties: { title: 'New heading' },
      seo: { keep: true },
      status: 'READY',
    });
  });

  it('holds an ambiguous save outcome and permits only explicit saved inspection before another command', async () => {
    const calls = setup();
    calls.save.mockRejectedValue(new Error('Outcome not confirmed'));
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: /^Story text/ }), {
      target: { value: 'Changed' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save page changes' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save page changes' }));
    await screen.findByText('Outcome not confirmed');
    expect(screen.getByRole('button', { name: 'Save page changes' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Validate saved page changes' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open saved page' })).toBeEnabled();
    expect(calls.save).toHaveBeenCalledTimes(1);
  });

  it('keeps View and unsupported owner layouts read-only without publication authority', async () => {
    const value = {
      ...saved(),
      editable: false,
      issues: ['Nested content requires its specialized editor.'],
    };
    const calls = setup(value, {
      ...model,
      operations: ['listDraftPages', 'getDraftComposition'],
    });
    await open();
    expect(
      screen.getByText('Nested content requires its specialized editor.'),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: /^Heading/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save page changes' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submit saved page for approval' }),
    ).toBeDisabled();
    expect(calls.save).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('button', { name: 'Open saved page' })).getByText(
        'Open saved page',
      ),
    ).toBeVisible();
  });
});

it('edits nested content without flattening its parent or losing unexposed attributes', async () => {
  const page = saved();
  const parent = page.draft.sections[0]!.components[0]!;
  const nestedSections: api.ContentDesignerDraft['sections'] = [
    {
      code: 'nested-placement',
      slot: 'default',
      index: 0,
      components: [
        {
          code: 'nested-story',
          typeCode: 'story',
          renderer: 'storyRenderer',
          properties: { body: 'Nested original', extension: 'preserve' },
          localizations: [],
          media: [],
        },
      ],
    },
  ];
  const value = {
    ...page,
    draft: {
      ...page.draft,
      sections: page.draft.sections.map((section, index) =>
        index === 0
          ? { ...section, components: [{ ...parent, sections: nestedSections }] }
          : section,
      ),
    },
  };
  const f = setup(value);
  await open();
  const region = screen.getByRole('region', { name: 'Content for default' });
  fireEvent.change(within(region).getByRole('textbox', { name: 'Story text' }), {
    target: { value: 'Nested correction' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Validate saved page changes' }));
  await waitFor(() => expect(f.validate).toHaveBeenCalledTimes(1));
  const draft = f.validate.mock.calls[0]![2];
  expect(draft.sections).toHaveLength(2);
  expect(
    draft.sections[0]!.components[0]!.sections![0]!.components[0]!.properties,
  ).toEqual({ body: 'Nested correction', extension: 'preserve' });
  expect(draft.sections[0]!.components[0]!.properties!.extension).toEqual({
    keep: true,
  });
});

it('focuses the first missing declared content field and sends no validation request until corrected', async () => {
  const calls = setup();
  await open();
  const heading = screen.getByRole('textbox', { name: 'Heading' });
  fireEvent.change(heading, { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validate saved page changes' }));
  await waitFor(() => expect(heading).toHaveFocus());
  expect(heading).toHaveAttribute('aria-invalid', 'true');
  expect(heading).toHaveAccessibleDescription(
    'Complete the required headings, card details, and default language content before validating.',
  );
  expect(screen.getByRole('textbox', { name: 'Story text' })).toHaveValue(
    'Original story',
  );
  expect(calls.validate).not.toHaveBeenCalled();
  expect(calls.save).not.toHaveBeenCalled();
  fireEvent.change(heading, { target: { value: 'Corrected heading' } });
  expect(heading).toHaveAttribute('aria-invalid', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Validate saved page changes' }));
  await waitFor(() => expect(calls.validate).toHaveBeenCalledOnce());
  expect(calls.save).not.toHaveBeenCalled();
});
