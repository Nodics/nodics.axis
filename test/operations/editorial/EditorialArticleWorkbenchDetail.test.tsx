import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchRendererController } from '../../../src/cms/renderers/shared/rendererTypes';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { EditorialArticleWorkbenchDetail } from '../../../src/operations/editorial/EditorialArticleWorkbenchDetail';
import {
  editorialPresentationKeys,
  type EditorialCommand,
  type EditorialWorkspace,
} from '../../../src/operations/editorial/editorialAuthoringClient';

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), inspect: vi.fn() }));
vi.mock(
  '../../../src/operations/editorial/editorialAuthoringClient',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../../src/operations/editorial/editorialAuthoringClient')
    >()),
    loadEditorialWorkspace: api.load,
    executeEditorialCommand: api.save,
    inspectEditorialCommand: api.inspect,
  }),
);
const source = {
  moduleName: 'editorial',
  instanceId: 'staged',
  endpoint: 'http://localhost:4312/nodics/editorial',
  server: 'content',
  environment: 'local',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
};
const schema = {
  moduleName: 'editorial',
  schemaName: 'editorialArticle',
  fields: [],
  connectionServer: 'content',
  connectionEnvironment: 'local',
  connectionInstanceId: 'staged',
  authoring: { stage: 'STAGED', authoringAllowed: true },
} as unknown as WorkbenchSchema;
const root = {
  code: 'article-a',
  revision: 1,
  status: 'DRAFT',
  contentTypeCode: 'BLOG',
  internalName: 'Working title',
  slug: 'article-a',
  siteCodes: ['site-a'],
  authorCodes: ['author-a'],
};
const english = {
  code: 'article-a-en',
  articleCode: root.code,
  localeCode: 'en',
  revision: 1,
  status: 'READY',
  title: 'English title',
  slug: 'english-url',
  body: { blocks: [{ type: 'paragraph', text: 'Saved English story' }] },
  seo: { title: 'SEO title', robots: 'index' },
};
const presentation = {
  ...Object.fromEntries(editorialPresentationKeys.map((key) => [key, key])),
  editLabel: 'Edit content',
  previewLabel: 'Preview',
  saveLabel: 'Save article',
  refreshLabel: 'Refresh',
  localeLabel: 'Content language',
  inspectLabel: 'Inspect save',
  closeLabel: 'Close',
  closeTitle: 'Leave this article?',
  confirmCloseLabel: 'Leave article',
  cancelLabel: 'Cancel',
} as EditorialWorkspace['presentation'];
function workspace(changes: Partial<EditorialWorkspace> = {}): EditorialWorkspace {
  return {
    article: { ...root },
    localizations: [{ ...english }],
    supportedLocaleCodes: ['en', 'ar'],
    requiredLocaleCodes: ['en'],
    operations: ['SAVE', 'ARCHIVE', 'INSPECT'],
    presentation,
    ...changes,
  };
}
const close = vi.fn(),
  lifecycle = vi.fn(),
  retryRecords = vi.fn();
function controller(token = 'actor-a') {
  return {
    accessToken: token,
    enterpriseCode: 'default',
    tenantCode: 'default',
    locale: 'en',
    runtime: { requestTimeoutMs: 360000, projectCode: 'one-project' },
    bootstrap: { moduleConnections: { editorial: [source] }, navigation: [] },
    retryRecords,
    retrySchemas: vi.fn(),
    closeRecord: close,
    executeLifecycleAction: lifecycle,
    scope: {
      lifecycleActions: [{ id: 'validate', label: 'Validate', featureState: 'ACTIVE' }],
    },
  } as unknown as WorkbenchRendererController;
}
function view(current = controller()) {
  return (
    <MemoryRouter>
      <EditorialArticleWorkbenchDetail
        controller={current}
        record={root}
        schema={schema}
      />
    </MemoryRouter>
  );
}
async function editTitle(value = 'Changed title') {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit content' }));
  await user.clear(screen.getByRole('textbox', { name: 'Title' }));
  await user.type(screen.getByRole('textbox', { name: 'Title' }), value);
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  api.load.mockResolvedValue(workspace());
  api.save.mockImplementation((_source, _schema, command: EditorialCommand) =>
    Promise.resolve({
      outcome: 'SAVED_DRAFT',
      commandId: command.commandId,
      article: { ...root, revision: 2 },
      localizations: [{ ...english, revision: 2, title: 'Changed title' }],
    }),
  );
});

describe('Editorial business draft journey', () => {
  it.each([true, false])(
    'retires obsolete lifecycle feedback only after a confirmed owner read (success=%s)',
    async (success) => {
      const clearLifecycleFeedback = vi.fn();
      if (!success) api.load.mockRejectedValueOnce(new Error('Owner read unavailable'));
      render(
        view({
          ...controller(),
          clearLifecycleFeedback,
          lifecycleActionError: 'Previous workflow warning',
        }),
      );
      if (success) {
        await screen.findByRole('button', { name: 'Edit content' });
        expect(clearLifecycleFeedback).toHaveBeenCalledTimes(1);
      } else {
        await screen.findByText('Owner read unavailable');
        expect(clearLifecycleFeedback).not.toHaveBeenCalled();
      }
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    'shows a repeated lifecycle failure once while preserving distinct owner feedback (same=%s)',
    async (same) => {
      const message = 'Review setup is incomplete. Inspect its owner.';
      const ownerMessage = same ? message : 'Independent owner warning.';
      const rejected = vi.fn().mockRejectedValue(new Error(message));
      render(
        view({
          ...controller(),
          executeLifecycleAction: rejected,
          lifecycleActionError: ownerMessage,
        }),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Validate' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Edit content' })).toBeDisabled(),
      );
      expect(screen.getAllByText(message)).toHaveLength(1);
      if (!same) expect(screen.getByText(ownerMessage)).toBeVisible();
      expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
      expect(rejected).toHaveBeenCalledTimes(1);
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it('requires correction feedback and submits it for the inspected review revision', async () => {
    const reviewed = { ...root, status: 'IN_REVIEW', revision: 3 };
    const rejected = {
      ...reviewed,
      status: 'CHANGES_REQUESTED',
      decisionEvidence: { action: 'REJECT', reason: 'Clarify the scope.' },
    };
    const action = {
      id: 'reject',
      label: 'Request changes',
      featureState: 'ACTIVE',
      targetStatuses: ['IN_REVIEW'],
    };
    api.load
      .mockResolvedValueOnce(workspace({ article: reviewed }))
      .mockResolvedValue(workspace({ article: rejected }));
    lifecycle.mockResolvedValue({ article: rejected });
    const current = {
      ...controller(),
      scope: { lifecycleActions: [action] },
    } as unknown as WorkbenchRendererController;
    render(view(current));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Request changes' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Request changes' }));
    const submit = dialog.getByRole('button', { name: 'Request changes' });
    expect(submit).toBeDisabled();
    await user.type(
      dialog.getByRole('textbox', { name: 'Review feedback' }),
      '  Clarify the scope.  ',
    );
    await user.click(submit);
    await waitFor(() =>
      expect(lifecycle).toHaveBeenCalledWith(
        action,
        reviewed,
        expect.objectContaining({ reason: 'Clarify the scope.' }),
      ),
    );
    expect(await screen.findByText('Clarify the scope.')).toBeVisible();
  });

  it('blocks other editing commands while a lifecycle owner action is pending', async () => {
    render(
      view({
        ...controller(),
        lifecycleActionPendingId: 'withdraw',
      }),
    );
    await screen.findByRole('combobox', { name: 'Content language' });
    expect(screen.getByRole('button', { name: 'Edit content' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'archiveLabel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it('keeps unsaved edits through Preview, blocks lifecycle and sends one owner save with only changed copy', async () => {
    render(view());
    const user = await editTitle();
    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Content language' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      screen
        .getAllByText('Changed title')
        .some((node) => node.textContent === 'Changed title'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Edit content' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Changed title');
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const command = api.save.mock.calls[0]![2] as EditorialCommand;
    expect(command.expectedRevision).toBe(1);
    expect(command.payload).toMatchObject({
      changes: {},
      localization: { localeCode: 'en', changes: { title: 'Changed title' } },
      article: { code: root.code, revision: 1 },
    });
    expect(
      Object.keys((command.payload.localization as { changes: object }).changes),
    ).toEqual(['title']);
    expect(retryRecords).toHaveBeenCalledTimes(1);
    expect(lifecycle).not.toHaveBeenCalled();
  });

  it('holds uncertain saves until explicit inspection without replay or discarding the draft', async () => {
    api.save.mockRejectedValue(new Error('Connection interrupted'));
    api.inspect.mockResolvedValue({
      outcome: 'UNKNOWN',
      commandId: 'ignored',
      currentRevision: 1,
      currentStatus: 'DRAFT',
    });
    render(view());
    const user = await editTitle();
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    await screen.findByText('Connection interrupted');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save article' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Inspect save' }));
    expect(api.inspect).toHaveBeenCalledTimes(1);
    expect(api.inspect.mock.calls[0]![2]).toBe(api.save.mock.calls[0]![2]);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Changed title');
    expect(screen.getByRole('button', { name: 'Save article' })).toBeDisabled();
  });

  it('requires explicit confirmation to close with unsaved copy', async () => {
    render(view());
    const user = await editTitle();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Leave this article?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Changed title',
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Leave article' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('opens a missing language as empty copy rather than falling back to English', async () => {
    render(view());
    const user = userEvent.setup();
    await user.click(await screen.findByRole('combobox', { name: 'Content language' }));
    await user.click(screen.getByRole('option', { name: 'Arabic' }));
    await user.click(screen.getByRole('button', { name: 'Edit content' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Main story text' })).toHaveValue('');
    expect(screen.getByText('missingLocaleMessage')).toBeVisible();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('preserves unsupported structured bodies and SEO extensions when editing another field', async () => {
    api.load.mockResolvedValue(
      workspace({
        localizations: [
          { ...english, body: { blocks: [{ type: 'image', mediaCode: 'media-a' }] } },
        ],
      }),
    );
    render(view());
    const user = await editTitle();
    expect(screen.getByRole('textbox', { name: 'Main story text' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    const command = api.save.mock.calls[0]![2] as EditorialCommand;
    expect((command.payload.localization as { changes: object }).changes).toEqual({
      title: 'Changed title',
    });
  });

  it('retires a pending old-actor save so it cannot replace the new actor workspace', async () => {
    let resolveSave!: (result: unknown) => void;
    api.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const rendered = render(view());
    const user = await editTitle();
    await user.click(screen.getByRole('button', { name: 'Save article' }));
    api.load.mockResolvedValue(
      workspace({ localizations: [{ ...english, title: 'New actor copy' }] }),
    );
    rendered.rerender(view(controller('actor-b')));
    await screen.findAllByText('New actor copy');
    await act(async () => {
      resolveSave({
        outcome: 'SAVED_DRAFT',
        article: { ...root, revision: 2 },
        localizations: [{ ...english, revision: 2, title: 'Old actor completion' }],
      });
      await Promise.resolve();
    });
    expect(screen.queryByText('Old actor completion')).not.toBeInTheDocument();
    expect(screen.getAllByText('New actor copy').length).toBeGreaterThan(0);
    expect(retryRecords).not.toHaveBeenCalled();
  });
});

it('retained publication intent holds editing and offers only the original publication resume while preserving the older reference', async () => {
  const retained = {
    ...root,
    status: 'APPROVED',
    publicationCode: 'older-online',
    publicationSourceRevision: 1,
    publicationIntent: {
      contractVersion: 1,
      code: 'original-request',
      sourceRevision: 1,
    },
  };
  api.load.mockResolvedValue(workspace({ article: retained, operations: ['INSPECT'] }));
  lifecycle.mockResolvedValue(undefined);
  const current = controller();
  render(
    view({
      ...current,
      scope: {
        ...current.scope,
        lifecycleActions: [
          {
            id: 'publish',
            label: 'Publish now',
            intent: 'UPDATE',
            order: 50,
            featureState: 'ACTIVE',
            targetStatuses: ['APPROVED'],
          },
          {
            id: 'validate',
            label: 'Validate',
            featureState: 'ACTIVE',
            intent: 'UPDATE',
            order: 10,
          },
        ],
      },
    } as WorkbenchRendererController),
  );
  await screen.findByText('pendingPublicationMessage');
  expect(screen.getByText('original-request')).toBeInTheDocument();
  expect(screen.getByText('older-online')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit content' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'archiveLabel' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'resumePublicationLabel' }));
  expect(lifecycle).toHaveBeenCalledTimes(1);
  expect(lifecycle.mock.calls[0]?.[1]).toEqual(retained);
  expect(lifecycle.mock.calls[0]?.[2]).toMatchObject({
    publicationCode: 'original-request',
  });
  expect(api.save).not.toHaveBeenCalled();
});

it('Arabic copy uses its own language/direction in preview and inputs while the interface and URL remain independent', async () => {
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  const arabic = {
    ...english,
    code: 'article-a-ar',
    localeCode: 'ar',
    title: 'عنوان المقال العربي',
    summary: 'ملخص عربي محفوظ',
    body: { blocks: [{ type: 'paragraph', text: 'نص عربي محفوظ للمراجعة' }] },
  };
  api.load.mockResolvedValue(workspace({ localizations: [english, arabic] }));
  render(view());
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Content language' }));
  await user.click(screen.getByRole('option', { name: 'Arabic' }));
  for (const title of screen.getAllByText(arabic.title)) {
    expect(title).toHaveAttribute('lang', 'ar');
    expect(title).toHaveAttribute('dir', 'rtl');
  }
  expect(screen.getByText('نص عربي محفوظ للمراجعة')).toHaveAttribute('lang', 'ar');
  expect(screen.getByText('نص عربي محفوظ للمراجعة')).toHaveAttribute('dir', 'rtl');
  expect(screen.getByText('Editorial authoring')).toHaveAttribute('lang', 'en');
  await user.click(screen.getByRole('button', { name: 'Edit content' }));
  for (const name of [
    'Title',
    'Card summary / subtitle',
    'Main story text',
    'Key takeaways',
    'SEO title',
    'SEO description',
  ]) {
    expect(screen.getByRole('textbox', { name })).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('textbox', { name })).toHaveAttribute('dir', 'rtl');
  }
  expect(screen.getByRole('textbox', { name: 'URL slug' })).toHaveAttribute(
    'dir',
    'ltr',
  );
  expect(document.documentElement.lang).toBe('en');
  expect(document.documentElement.dir).toBe('ltr');
  await user.click(screen.getByRole('combobox', { name: 'Content language' }));
  await user.click(screen.getByRole('option', { name: 'English' }));
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('lang', 'en');
  expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('dir', 'ltr');
});

it('changing the content language clears the previous language save notice', async () => {
  render(view());
  const user = await editTitle();
  await user.click(screen.getByRole('button', { name: 'Save article' }));
  await screen.findByText('savedMessage');
  await user.click(screen.getByRole('combobox', { name: 'Content language' }));
  await user.click(screen.getByRole('option', { name: 'Arabic' }));
  expect(screen.queryByText('savedMessage')).not.toBeInTheDocument();
  expect(screen.getByText('missingLocaleMessage')).toBeInTheDocument();
});

it('verified deployment absence removes irrelevant withdrawal from a newer draft while keeping its publication history', async () => {
  api.load.mockResolvedValue(
    workspace({
      article: {
        ...root,
        publicationCode: 'rolled-back-request',
        publicationSourceRevision: root.revision,
      },
      deployment: { status: 'NONE', revision: 4 },
    }),
  );
  const current = controller();
  render(
    view({
      ...current,
      scope: {
        ...current.scope,
        lifecycleActions: [
          {
            id: 'withdraw',
            label: 'Withdraw',
            intent: 'UPDATE',
            featureState: 'ACTIVE',
            order: 1,
          },
        ],
      },
    } as WorkbenchRendererController),
  );
  await screen.findByText(
    'No copy is currently deployed. Publication history is retained.',
  );
  expect(screen.getByText('rolled-back-request')).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Publication withdrawal' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Prepare withdrawal' }),
  ).not.toBeInTheDocument();
});

it('holds unloaded copy without false missing translations or unsaved warnings and recovers a failed read', async () => {
  let rejectRead!: (error: Error) => void;
  api.load.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRead = reject;
      }),
  );
  render(view());
  expect(screen.getByRole('progressbar', { name: 'Loading article' })).toBeVisible();
  expect(screen.queryByText('No localized title yet')).not.toBeInTheDocument();
  expect(screen.queryByText('unsavedMessage')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Edit content' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    rejectRead(new Error('Owner unavailable'));
    await Promise.resolve();
  });
  expect(screen.getByText('Owner unavailable')).toBeVisible();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('button', { name: 'Edit content' })).toBeEnabled();
  expect(api.save).not.toHaveBeenCalled();
});

it('keeps archive review copy through exit, shows archive progress and never reports unsaved changes or saving a draft', async () => {
  let resolveArchive!: (result: unknown) => void;
  api.save.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveArchive = resolve;
      }),
  );
  render(view());
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'archiveLabel' }));
  expect(screen.getByRole('dialog', { name: 'archiveTitle' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'confirmArchiveLabel' }));
  expect(screen.queryByText('refreshTitle')).not.toBeInTheDocument();
  expect(screen.queryByText('refreshMessage')).not.toBeInTheDocument();
  expect(screen.queryByText('unsavedMessage')).not.toBeInTheDocument();
  expect(screen.queryByText('savingLabel')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'archiveLabel…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save article' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(api.save.mock.calls[0]![2]).toMatchObject({
    operation: 'ARCHIVE',
    articleCode: root.code,
    expectedRevision: 1,
  });
  await act(async () => {
    resolveArchive({
      outcome: 'ARCHIVED',
      article: { ...root, status: 'ARCHIVED' },
      localizations: [{ ...english, status: 'DRAFT' }],
    });
    await Promise.resolve();
  });
  expect(screen.getByText('archivedMessage')).toBeVisible();
  expect(screen.queryByText('draftLocaleMessage')).not.toBeInTheDocument();
  expect(screen.queryByText('missingLocaleMessage')).not.toBeInTheDocument();
  expect(screen.queryByText('savingLabel')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'archiveLabel' })).toBeDisabled();
});

it('blocks submission and publication for an unqualified saved featured image while preserving validation', async () => {
  api.load.mockResolvedValue(
    workspace({
      article: { ...root, featuredMediaCode: 'image-a' },
      featuredMedia: {
        mediaCode: 'image-a',
        ready: false,
        status: 'PENDING',
        presentation: {
          ready: 'Image ready',
          pending: 'Approve the saved image before publication',
          unavailable: 'Image inspection unavailable',
          open: 'Review image',
          saveFirst: 'Save this image selection first',
        },
      },
    }),
  );
  const current = controller();
  const actions = ['validate', 'submit', 'publish'].map((id) => ({
    id,
    label: id,
    featureState: 'ACTIVE',
  }));
  render(
    view({
      ...current,
      scope: { ...current.scope, lifecycleActions: actions },
    } as unknown as WorkbenchRendererController),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled(),
  );
  expect(screen.getByRole('button', { name: 'publish' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'validate' })).toBeEnabled();
  expect(lifecycle).not.toHaveBeenCalled();
  expect(
    await screen.findByText('Approve the saved image before publication'),
  ).toBeVisible();
});
