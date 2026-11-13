import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentDesignerFailedSaveInspection } from '../../../src/operations/contentExperience/ContentDesignerFailedSaveInspection';
import * as api from '../../../src/operations/contentExperience/api/contentDesignerClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';

const draft: api.ContentDesignerDraft = {
  catalogCode: 'catalog',
  siteCode: 'site',
  templateCode: 'template',
  page: { code: 'page', name: 'Local review', typeCode: 'pageType' },
  sections: [],
};
const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'staged',
  endpoint: 'https://cms.example/nodics/cms',
  environment: 'local',
  state: 'UP',
};
function setup(onMissing = vi.fn()) {
  const read = vi.spyOn(api, 'loadContentDesignerPage');
  const page = render(
    <QueryClientProvider client={new QueryClient()}>
      <ContentDesignerFailedSaveInspection
        connection={connection}
        configuration={{
          accessToken: 'employee',
          enterpriseCode: 'enterprise',
          timeoutMs: 1000,
        }}
        draft={draft}
        enabled
        onMissingConfirmed={onMissing}
      />
    </QueryClientProvider>,
  );
  return { ...page, read, onMissing };
}
afterEach(() => vi.restoreAllMocks());
describe('failed new-page save inspection', () => {
  it('releases only on typed exact owner not-found without repeating the save', async () => {
    const page = setup();
    page.read.mockRejectedValue(
      new api.ContentDesignerRequestError(404, 'No saved page', 'ERR_CMS_00088'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inspect saved page result' }));
    await waitFor(() => expect(page.onMissing).toHaveBeenCalledOnce());
    expect(page.read).toHaveBeenCalledExactlyOnceWith(connection, expect.anything(), {
      catalogCode: 'catalog',
      siteCode: 'site',
      pageCode: 'page',
    });
  });
  it.each([
    new api.ContentDesignerRequestError(404, 'Route not found'),
    new api.ContentDesignerRequestError(403, 'Denied', 'ERR_AUTH_00003'),
    new Error('Unavailable'),
  ])('retains the hold on unconfirmed read outcomes: %s', async (error) => {
    const page = setup();
    page.read.mockRejectedValue(error);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect saved page result' }));
    await screen.findByText(/The save hold remains in place/);
    expect(page.onMissing).not.toHaveBeenCalled();
    expect(page.read).toHaveBeenCalledOnce();
  });
  it('reports saved content without authorizing another create', async () => {
    const page = setup();
    page.read.mockResolvedValue({
      draft,
      sourceVersion: 'a'.repeat(64),
      editable: true,
      issues: [],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inspect saved page result' }));
    await screen.findByText(/The owner confirms a saved page with 0 content blocks/);
    expect(page.onMissing).not.toHaveBeenCalled();
  });
  it('does not release a retired view from a late not-found response', async () => {
    const page = setup();
    let reject!: (error: Error) => void;
    page.read.mockImplementation(
      () =>
        new Promise((_resolve, failure) => {
          reject = failure;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inspect saved page result' }));
    await waitFor(() => expect(page.read).toHaveBeenCalledOnce());
    page.unmount();
    await act(async () => {
      reject(
        new api.ContentDesignerRequestError(404, 'No saved page', 'ERR_CMS_00088'),
      );
      await Promise.resolve();
    });
    expect(page.onMissing).not.toHaveBeenCalled();
  });
});
