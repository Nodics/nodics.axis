import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../../src/runtime/runtimeConfig';
import { MediaPublicationReviewPanel } from '../../../../src/operations/mediaManagement/components/MediaPublicationReviewPanel';
import {
  mediaReviewCopyKeys,
  type MediaPublicationReview,
  type MediaReviewIdentity,
} from '../../../../src/operations/mediaManagement/api/mediaPublicationReviewClient';
const api = vi.hoisted(() => ({ metadata: vi.fn(), image: vi.fn() }));
vi.mock(
  '../../../../src/operations/mediaManagement/api/mediaPublicationReviewClient',
  async (original) => ({
    ...(await original<
      typeof import('../../../../src/operations/mediaManagement/api/mediaPublicationReviewClient')
    >()),
    loadMediaPublicationReview: api.metadata,
    loadMediaPublicationReviewImage: api.image,
  }),
);
const source = {
  moduleName: 'media',
  endpoint: 'http://localhost:4312/nodics/media',
  instanceId: 'staged-media',
  server: 'content',
  environment: 'local',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
};
const bootstrap = {
  tenantCode: 'tenant-a',
  navigation: [
    {
      id: 'media-library',
      moduleName: 'media',
      route: '/media/library',
      featureState: 'ACTIVE',
      availability: 'UP',
    },
    {
      id: 'publishing-requests',
      moduleName: 'publish',
      route: '/publishing/requests',
      featureState: 'ACTIVE',
      availability: 'UP',
    },
  ],
  moduleConnections: {
    media: [source],
    publish: [
      {
        ...source,
        moduleName: 'publish',
        instanceId: 'staged-publish',
        endpoint: 'http://localhost:4312/nodics/publish',
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const runtime = {
  enterpriseCode: 'acme',
  projectCode: 'project-a',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
const identity: MediaReviewIdentity = {
  owner: 'media',
  rootType: 'media',
  rootCode: 'asset-a',
  publicationCode: 'publication-a',
  sourceVersion: 'a'.repeat(64),
};
function metadata(name = 'Captured original'): MediaPublicationReview {
  return {
    publicationCode: identity.publicationCode,
    mediaCode: identity.rootCode,
    sourceVersion: identity.sourceVersion,
    asset: {
      code: identity.rootCode,
      name,
      versionId: 0,
      mimeType: 'image/png',
      sizeBytes: 70,
      checksum: 'b'.repeat(64),
    },
    previewAvailable: true,
    presentation: Object.fromEntries(
      mediaReviewCopyKeys.map((key) => [key, key]),
    ) as MediaPublicationReview['presentation'],
  };
}
const props = { accessToken: 'actor-a-private', bootstrap, runtime, identity };
beforeEach(() => {
  vi.clearAllMocks();
  api.metadata.mockResolvedValue(metadata());
  api.image.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
});
describe('captured Media review inquiry', () => {
  it('shows business details and exact-source inspection, opening image bytes only by explicit action', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} />
      </MemoryRouter>,
    );
    await screen.findByText('Captured original');
    expect(screen.getByText('version: 0')).toBeInTheDocument();
    expect(api.image).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'publication' })).toHaveAttribute(
      'href',
      '/publishing/requests?publicationCode=publication-a&sourceServer=content&sourceEnvironment=local',
    );
    await user.click(screen.getByRole('button', { name: 'preview' }));
    await screen.findByRole('img', { name: 'Captured original' });
    expect(api.image).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'hide' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('retires a delayed image after actor replacement without constructing a stale Blob URL', async () => {
    let finish!: (value: Blob) => void;
    api.image.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const makeUrl = vi.spyOn(URL, 'createObjectURL');
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} />
      </MemoryRouter>,
    );
    await screen.findByText('Captured original');
    await user.click(screen.getByRole('button', { name: 'preview' }));
    api.metadata.mockResolvedValue(metadata('Current actor evidence'));
    view.rerender(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} accessToken="actor-b-private" />
      </MemoryRouter>,
    );
    await screen.findByText('Current actor evidence');
    await act(async () => {
      finish(new Blob(['retired']));
      await Promise.resolve();
    });
    expect(makeUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it('rejects unavailable Media navigation even when a connection remains in the catalogue', () => {
    const hidden = {
      ...bootstrap,
      navigation: bootstrap.navigation.map((item) =>
        item.moduleName === 'media'
          ? { ...item, featureState: 'DISABLED' as const }
          : item,
      ),
    };
    render(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} bootstrap={hidden} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText('Captured Media evidence is unavailable for this workspace.'),
    ).toBeInTheDocument();
    expect(api.metadata).not.toHaveBeenCalled();
  });
  it('keeps denied reads explicit and never exposes provider errors or retries automatically', async () => {
    api.metadata.mockRejectedValue(new Error('/private/provider-secret'));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} />
      </MemoryRouter>,
    );
    await screen.findByText('Captured Media evidence could not be loaded.');
    expect(screen.queryByText(/provider-secret/)).not.toBeInTheDocument();
    expect(api.metadata).toHaveBeenCalledTimes(1);
    api.metadata.mockResolvedValue(metadata());
    await user.click(screen.getByRole('button', { name: 'Refresh captured evidence' }));
    await screen.findByText('Captured original');
    expect(api.metadata).toHaveBeenCalledTimes(2);
    expect(api.image).not.toHaveBeenCalled();
  });
  it('does not fabricate raster access or refetch during unrelated parent edits', async () => {
    api.metadata.mockResolvedValue({ ...metadata(), previewAvailable: false });
    const view = render(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} />
      </MemoryRouter>,
    );
    await screen.findByText('Captured original');
    expect(screen.queryByRole('button', { name: 'preview' })).not.toBeInTheDocument();
    expect(screen.getByText('unsupported')).toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <MediaPublicationReviewPanel {...props} identity={{ ...identity }} />
      </MemoryRouter>,
    );
    expect(api.metadata).toHaveBeenCalledTimes(1);
  });
});
