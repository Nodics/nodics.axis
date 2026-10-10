import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentationArticleRenderer } from '../../../../../src/cms/renderers/components/documentation/DocumentationArticleRenderer';
import { loadApplicationArtwork } from '../../../../../src/operations/setupAccelerators/api/applicationArtworkClient';
import type { AxisAuthenticatedBootstrap } from '../../../../../src/bootstrap/publicBootstrap';
import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';

vi.mock(
  '../../../../../src/operations/setupAccelerators/api/applicationArtworkClient',
  () => ({ loadApplicationArtwork: vi.fn() }),
);
const connection = {
  moduleName: 'media',
  instanceId: 'online',
  endpoint: 'https://media.test/nodics/media',
  environment: 'test',
  runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
  state: 'UP',
};
const media = {
  bootstrap: {
    moduleConnections: { media: [connection] },
  } as unknown as AxisAuthenticatedBootstrap,
  accessToken: 'test-principal',
  enterpriseCode: 'test-enterprise',
  timeoutMs: 1000,
};
const article: CmsComponentContract = {
  code: 'article',
  typeCode: 'article',
  renderer: 'documentation.component.article',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  properties: {
    title: 'Media-backed article',
    blocks: [
      {
        kind: 'image',
        mediaCode: 'documentation-image',
        alt: 'Documentation diagram',
        source: '/docs-assets/legacy.png',
      },
    ],
  },
  slot: 'article',
  index: 1,
  components: [],
};
const create = vi.fn(() => 'blob:documentation');
const revoke = vi.fn();
beforeEach(() => {
  vi.mocked(loadApplicationArtwork).mockResolvedValue(
    new Blob(['image'], { type: 'image/png' }),
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const reader = (accessToken = media.accessToken, component = article) => (
  <MemoryRouter>
    <DocumentationArticleRenderer
      component={component}
      actions={{ documentationMedia: { ...media, accessToken } }}
    />
  </MemoryRouter>
);

describe('Documentation Media references', () => {
  it('reuses the registered Online Media client and retains the enlarge viewer', async () => {
    const view = render(reader());
    expect(
      await screen.findByRole('img', { name: 'Documentation diagram' }),
    ).toHaveAttribute('src', 'blob:documentation');
    expect(
      screen.getByRole('button', { name: 'Enlarge Documentation diagram' }),
    ).toBeInTheDocument();
    const request = vi.mocked(loadApplicationArtwork).mock.calls[0]?.[0];
    expect(request?.connection).toEqual(connection);
    expect(request?.accessToken).toBe('test-principal');
    expect(request?.enterpriseCode).toBe('test-enterprise');
    expect(request?.visual.mediaCode).toBe('documentation-image');
    expect(request?.visual.runtimeRole).toBe('WCMS_ONLINE');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:documentation');
    expect(vi.mocked(loadApplicationArtwork).mock.calls[0]?.[0].signal.aborted).toBe(
      true,
    );
  });
  it('never falls back to a source URL after Media denial or an invalid identity', async () => {
    vi.mocked(loadApplicationArtwork).mockRejectedValue(new Error('denied'));
    const view = render(reader());
    await waitFor(() => expect(loadApplicationArtwork).toHaveBeenCalledOnce());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    view.rerender(
      reader(media.accessToken, {
        ...article,
        properties: {
          ...article.properties,
          blocks: [
            {
              kind: 'image',
              mediaCode: '../escape',
              source: '/docs-assets/legacy.png',
              alt: 'Invalid identity',
            },
          ],
        },
      }),
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(loadApplicationArtwork).toHaveBeenCalledOnce();
  });
  it('removes the old image on principal change and ignores a late response after unmount', async () => {
    const view = render(reader());
    await screen.findByRole('img');
    let complete!: (value: Blob) => void;
    vi.mocked(loadApplicationArtwork).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    view.rerender(reader('new-principal'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(revoke).toHaveBeenCalledWith('blob:documentation');
    view.unmount();
    await act(async () => {
      complete(new Blob(['late']));
      await Promise.resolve();
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
