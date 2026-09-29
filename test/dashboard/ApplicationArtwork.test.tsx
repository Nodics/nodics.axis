import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationArtwork } from '../../src/dashboard/ApplicationArtwork';
import { parseApplicationVisual } from '../../src/operations/setupAccelerators/api/applicationVisual';
import { loadApplicationArtwork } from '../../src/operations/setupAccelerators/api/applicationArtworkClient';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../src/bootstrap/publicBootstrap';

vi.mock('../../src/operations/setupAccelerators/api/applicationArtworkClient', () => ({
  loadApplicationArtwork: vi.fn(),
}));
const connection: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'staged',
  endpoint: 'https://media.test/nodics/media',
  environment: 'test',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
  state: 'UP',
};
const bootstrap = {
  moduleConnections: { media: [connection] },
} as unknown as AxisAuthenticatedBootstrap;
const media = {
  bootstrap,
  accessToken: 'test-token',
  enterpriseCode: 'enterprise',
  timeoutMs: 1000,
};
const visual = {
  active: true,
  mediaCode: 'owner-hero',
  alt: 'Application preview',
  runtimeRole: 'WCMS_STAGED',
};

const createObjectURL = vi.fn<() => string>();
const revokeObjectURL = vi.fn();
beforeEach(() => {
  vi.mocked(loadApplicationArtwork).mockResolvedValue(
    new Blob(['image'], { type: 'image/png' }),
  );
  let sequence = 0;
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: createObjectURL.mockImplementation(
        () => `blob:test-${++sequence}`,
      ),
      revokeObjectURL,
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Owner-provided application artwork', () => {
  it('accepts only a media reference while stripping arbitrary fields', () => {
    expect(
      parseApplicationVisual({
        ...visual,
        src: 'https://untrusted.test/image',
        onClick: 'script',
      }),
    ).toEqual(visual);
  });
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    '//other.test/img',
    'https://user:secret@other.test/img',
    'http://other.test/img',
    '/\\other.test/img',
    'relative.jpg',
  ])('ignores unsafe artwork %s without blocking setup', (src) => {
    expect(parseApplicationVisual({ src, alt: 'Preview' })).toBeUndefined();
  });
  it('falls back on error and recovers when the media reference changes', async () => {
    const { rerender } = render(<ApplicationArtwork media={media} visual={visual} />);
    const image = await screen.findByRole('img', { name: visual.alt });
    expect(image).toHaveAttribute('src', 'blob:test-1');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('crossorigin', 'anonymous');
    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Nodics' })).toBeInTheDocument();
    rerender(
      <ApplicationArtwork
        media={media}
        visual={{ ...visual, mediaCode: 'owner-second', alt: 'Second offering' }}
      />,
    );
    expect(
      await screen.findByRole('img', { name: 'Second offering' }),
    ).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });
  it.each(['../secret', 'x/y', 'x?token=secret', '', 'a'.repeat(161)])(
    'rejects invalid media code %s',
    (mediaCode) => {
      expect(parseApplicationVisual({ ...visual, mediaCode })).toBeUndefined();
    },
  );
  it('does not request an unavailable or different runtime', () => {
    render(
      <ApplicationArtwork
        media={media}
        visual={{ ...visual, runtimeRole: 'WCMS_ONLINE' }}
      />,
    );
    expect(loadApplicationArtwork).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Nodics' })).toBeInTheDocument();
  });
  it('keeps a neutral placeholder when media is missing or denied', async () => {
    vi.mocked(loadApplicationArtwork).mockRejectedValue(new Error('not available'));
    render(<ApplicationArtwork media={media} visual={visual} />);
    await waitFor(() => expect(loadApplicationArtwork).toHaveBeenCalledOnce());
    expect(screen.getByRole('img', { name: 'Nodics' })).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
  it('does not retain media across a principal change and revokes URLs on unmount', async () => {
    const { rerender, unmount } = render(
      <ApplicationArtwork media={media} visual={visual} />,
    );
    await screen.findByRole('img', { name: visual.alt });
    vi.mocked(loadApplicationArtwork).mockImplementation(() => new Promise(() => {}));
    rerender(
      <ApplicationArtwork
        media={{ ...media, accessToken: 'other-principal' }}
        visual={visual}
      />,
    );
    expect(screen.getByRole('img', { name: 'Nodics' })).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    unmount();
    expect(
      vi.mocked(loadApplicationArtwork).mock.calls.at(-1)?.[0].signal.aborted,
    ).toBe(true);
  });
  it('discards a late response after unmount', async () => {
    let resolve!: (value: Blob) => void;
    vi.mocked(loadApplicationArtwork).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<ApplicationArtwork media={media} visual={visual} />);
    unmount();
    await act(async () => {
      resolve(new Blob(['late']));
      await Promise.resolve();
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
  it('does not fetch before activation and replaces the logo after activation', async () => {
    const { rerender } = render(
      <ApplicationArtwork media={media} visual={{ ...visual, active: false }} />,
    );
    expect(screen.getByRole('img', { name: 'Nodics' })).toHaveAttribute(
      'src',
      '/brand/application-fallback-v1.png',
    );
    expect(loadApplicationArtwork).not.toHaveBeenCalled();
    rerender(<ApplicationArtwork media={media} visual={visual} />);
    await screen.findByRole('img', { name: visual.alt });
    rerender(
      <ApplicationArtwork media={media} visual={{ ...visual, active: false }} />,
    );
    expect(screen.getByRole('img', { name: 'Nodics' })).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });
});
