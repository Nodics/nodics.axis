import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CmsRoutePage } from '../../src/app/CmsRoutePage';
import { resolveCmsPage, type ResolveCmsPageResult } from '../../src/cms/cmsClient';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';
vi.mock('../../src/cms/cmsClient', () => ({ resolveCmsPage: vi.fn() }));
vi.mock('../../src/cms/CmsPageRenderer', () => ({
  CmsPageRenderer: ({ contract }: { contract: { path: string } }) => (
    <div>{contract.path}</div>
  ),
}));
beforeEach(() => {
  vi.mocked(resolveCmsPage).mockReset();
});
const base = {
  cmsBaseUrl: 'https://cms.example.test',
  enterpriseCode: 'one',
  site: 'siteOne',
  locale: 'en',
  channel: 'web',
  path: '/page',
  timeoutMs: 1000,
  accessToken: 'old-token',
  sessionGeneration: 1,
};
const result = (path: string): ResolveCmsPageResult => ({
  status: 'resolved',
  page: { ...validResolvedPage, path },
});
it('hides old ready content immediately while the next actor or Site response is pending', async () => {
  let finish: ((value: ResolveCmsPageResult) => void) | undefined;
  vi.mocked(resolveCmsPage)
    .mockResolvedValueOnce(result('/old-content'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const view = render(<CmsRoutePage {...base} />);
  await screen.findByText('/old-content');
  view.rerender(
    <CmsRoutePage
      {...base}
      site="siteTwo"
      sessionGeneration={2}
      accessToken="new-token"
    />,
  );
  expect(screen.queryByText('/old-content')).toBeNull();
  await act(async () => {
    finish?.(result('/new-content'));
    await Promise.resolve();
  });
  expect(screen.getByText('/new-content')).toBeInTheDocument();
});
it('does not resurrect an old actor page from a transport that ignores request cancellation', async () => {
  const pending: ((value: ResolveCmsPageResult) => void)[] = [];
  vi.mocked(resolveCmsPage).mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const view = render(<CmsRoutePage {...base} />);
  view.rerender(
    <CmsRoutePage
      {...base}
      enterpriseCode="two"
      sessionGeneration={2}
      accessToken="new-token"
    />,
  );
  expect(pending).toHaveLength(2);
  await act(async () => {
    pending[1]?.(result('/new-content'));
    await Promise.resolve();
  });
  expect(screen.getByText('/new-content')).toBeInTheDocument();
  await act(async () => {
    pending[0]?.(result('/old-content'));
    await Promise.resolve();
  });
  expect(screen.queryByText('/old-content')).toBeNull();
  expect(screen.getByText('/new-content')).toBeInTheDocument();
});

it('keeps secure sign-out retry and its failure guidance available when CMS delivery is down', async () => {
  vi.mocked(resolveCmsPage).mockRejectedValue(new Error('CMS unavailable'));
  const signOut = vi.fn();
  render(
    <CmsRoutePage
      {...base}
      authenticationError="Secure logout could not be completed. Please retry before leaving this device."
      actions={{ onEmployeeSignOut: signOut }}
    />,
  );
  const retry = await screen.findByRole('button', { name: 'Retry secure sign-out' });
  expect(
    screen.getByText(
      'Secure logout could not be completed. Please retry before leaving this device.',
    ),
  ).toBeInTheDocument();
  act(() => retry.click());
  expect(signOut).toHaveBeenCalledTimes(1);
});
