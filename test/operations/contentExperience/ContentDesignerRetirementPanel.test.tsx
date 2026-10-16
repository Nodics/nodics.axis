/** Exact owner-command reviews, permission changes and uncertain outcomes without schema fallback/replay. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import { ContentDesignerRetirementPanel } from '../../../src/operations/contentExperience/ContentDesignerRetirementPanel';
import { retirementPresentation as copy } from './contentDesignerRetirementFixtures';

const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'staged-cms',
  environment: 'test',
  endpoint: 'http://localhost:4312/nodics/cms',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'enterprise-a',
  timeoutMs: 1_000,
};

function renderPanel(operations: readonly string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const onRetired = vi.fn();
  const onPendingChange = vi.fn();
  const content = (allowed: readonly string[], siteCode = 'site-a') => (
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ContentDesignerRetirementPanel
          connection={connection}
          configuration={configuration}
          operations={allowed}
          presentation={copy}
          siteCode={siteCode}
          catalogCode="catalog-a"
          disabled={false}
          onRetired={onRetired}
          onPendingChange={onPendingChange}
        />
      </QueryClientProvider>
    </AxisThemeProvider>
  );
  const rendered = render(content(operations));
  return {
    ...rendered,
    onRetired,
    onPendingChange,
    update: (allowed: readonly string[], siteCode = 'site-a') =>
      rendered.rerender(content(allowed, siteCode)),
  };
}

describe('Designer retirement review', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    { operations: [] },
    { operations: ['validateDraftComposition', 'saveDraftComposition'] },
  ])('does not expose retirement to View or Edit', ({ operations }) => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    renderPanel(operations);
    expect(screen.queryByLabelText(copy.title)).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(copy.actions)(
    'reviews $operation separately and sends its exact owner command once',
    async (action) => {
      const user = userEvent.setup();
      const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              code: 'record-a',
              active: false,
              versionId: 4,
              authoringScope: {
                enterpriseCode: 'enterprise-a',
                catalogCode: 'catalog-a',
                ...(action.operation === 'deleteSection' ? { siteCode: 'site-a' } : {}),
              },
            },
          }),
        ),
      );
      const view = renderPanel([action.operation]);
      await user.type(screen.getByLabelText(copy.codeLabel), 'record-a');
      await user.click(screen.getByRole('button', { name: copy.reviewLabel }));
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getByText(action.consequence)).toBeVisible();
      expect(dialog.getByText('Catalog: catalog-a')).toBeVisible();
      expect(dialog.getByText('Site: site-a')).toBeVisible();
      expect(dialog.getByText('Enterprise: enterprise-a')).toBeVisible();
      expect(dialog.getByRole('button', { name: copy.confirmLabel })).toBeDisabled();
      expect(fetcher).not.toHaveBeenCalled();
      await user.click(dialog.getByLabelText(copy.acknowledgeLabel));
      await user.click(dialog.getByRole('button', { name: copy.confirmLabel }));
      await waitFor(() => expect(view.onRetired).toHaveBeenCalledOnce());
      expect(fetcher).toHaveBeenCalledOnce();
      const segment = {
        deleteSection: 'sections',
        deleteComponent: 'components',
        detachMedia: 'media',
      }[action.operation];
      const url = fetcher.mock.calls[0]?.[0];
      const requestedUrl =
        typeof url === 'string' ? url : url instanceof URL ? url.href : url?.url;
      expect(requestedUrl).toBe(
        `http://localhost:4312/nodics/cms/v0/designer/composition/${segment}/delete`,
      );
      expect(fetcher.mock.calls[0]?.[1]?.method).toBe('POST');
      const body = fetcher.mock.calls[0]?.[1]?.body;
      if (typeof body !== 'string')
        throw new Error('Expected a serialized owner command');
      expect(JSON.parse(body)).toEqual({
        code: 'record-a',
        siteCode: 'site-a',
        catalogCode: 'catalog-a',
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByLabelText(copy.codeLabel)).toHaveValue('');
    },
  );

  it.each(['permission', 'scope'])(
    'pins a reviewed target when %s changes',
    async (change) => {
      const user = userEvent.setup();
      const fetcher = vi.spyOn(globalThis, 'fetch');
      const view = renderPanel(['deleteComponent']);
      await user.type(screen.getByLabelText(copy.codeLabel), 'shared-footer');
      await user.click(screen.getByRole('button', { name: copy.reviewLabel }));
      await user.click(screen.getByLabelText(copy.acknowledgeLabel));
      view.update(
        change === 'permission' ? [] : ['deleteComponent'],
        change === 'scope' ? 'site-b' : 'site-a',
      );
      expect(screen.getByText(copy.changedMessage)).toBeVisible();
      expect(screen.getByRole('button', { name: copy.confirmLabel })).toBeDisabled();
      expect(screen.getByText('Site: site-a')).toBeVisible();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('ignores repeated confirmation while a retirement outcome is pending', async () => {
    const user = userEvent.setup();
    let complete: ((response: Response) => void) | undefined;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const view = renderPanel(['deleteComponent']);
    await user.type(screen.getByLabelText(copy.codeLabel), 'component-a');
    await user.click(screen.getByRole('button', { name: copy.reviewLabel }));
    await user.click(screen.getByLabelText(copy.acknowledgeLabel));
    await user.dblClick(screen.getByRole('button', { name: copy.confirmLabel }));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: copy.confirmLabel })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.cancelLabel })).toBeDisabled();
    complete?.(
      new Response(
        JSON.stringify({
          result: {
            code: 'component-a',
            active: false,
            versionId: 1,
            authoringScope: {
              enterpriseCode: 'enterprise-a',
              catalogCode: 'catalog-a',
            },
          },
        }),
      ),
    );
    await waitFor(() => expect(view.onRetired).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('retains an uncertain target, requires inspection and a new review, and never replays', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Disconnected'));
    const view = renderPanel(['detachMedia']);
    await user.type(screen.getByLabelText(copy.codeLabel), 'image-link');
    await user.click(screen.getByRole('button', { name: copy.reviewLabel }));
    await user.click(screen.getByLabelText(copy.acknowledgeLabel));
    await user.click(screen.getByRole('button', { name: copy.confirmLabel }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: copy.confirmLabel })).toBeDisabled(),
    );
    await waitFor(() =>
      expect(screen.getAllByText(copy.uncertainMessage).length).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole('button', { name: copy.cancelLabel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText(copy.codeLabel)).toHaveValue('image-link');
    expect(screen.getByRole('button', { name: copy.reviewLabel })).toBeDisabled();
    await user.click(screen.getByLabelText(copy.inspectionLabel));
    await user.click(screen.getByRole('button', { name: copy.reviewLabel }));
    expect(screen.getByRole('button', { name: copy.confirmLabel })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(view.onRetired).not.toHaveBeenCalled();
  });
});
