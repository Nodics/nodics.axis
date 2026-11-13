import { lazy, Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CmsRenderBoundary } from '../../src/cms/renderers/shared/CmsRenderBoundary';
import { LoadingScreen } from '../../src/app/LoadingScreen';
it('keeps the shell available and announces pending code until the requested workspace arrives', async () => {
  let resolve!: (value: { default: () => React.ReactNode }) => void;
  const Page = lazy(
    () =>
      new Promise<{ default: () => React.ReactNode }>((done) => {
        resolve = done;
      }),
  );
  render(
    <>
      <button>Navigate elsewhere</button>
      <CmsRenderBoundary>
        <Suspense fallback={<LoadingScreen embedded label="Loading workspace" />}>
          <Page />
        </Suspense>
      </CmsRenderBoundary>
    </>,
  );
  expect(screen.getByRole('button', { name: 'Navigate elsewhere' })).toBeEnabled();
  expect(screen.getByRole('status')).toHaveTextContent('Loading workspace');
  await act(async () => {
    resolve({ default: () => <h1>Requested workspace</h1> });
    await Promise.resolve();
  });
  expect(screen.getByRole('heading', { name: 'Requested workspace' })).toBeVisible();
});
it('contains download failures, exposes no raw error, and requires explicit recovery', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined),
    recover = vi.fn();
  const Failure = () => {
    throw new Error('private module diagnostic');
  };
  try {
    const view = render(
      <CmsRenderBoundary
        key="failed"
        fallback={
          <div role="alert">
            Workspace unavailable<button onClick={recover}>Reload workspace</button>
          </div>
        }
      >
        <Failure />
      </CmsRenderBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace unavailable');
    expect(screen.queryByText('private module diagnostic')).not.toBeInTheDocument();
    expect(recover).not.toHaveBeenCalled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reload workspace' }));
    expect(recover).toHaveBeenCalledOnce();
    view.rerender(
      <CmsRenderBoundary key="different-route">
        <h1>Another workspace</h1>
      </CmsRenderBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Another workspace' })).toBeVisible();
  } finally {
    log.mockRestore();
  }
});
