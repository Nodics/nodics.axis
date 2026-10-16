/** Isolated human-command/owner-readback fixtures; no native or installed authority. */
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteListingRequestsPanel } from '../../src/operations/wasteManagement/WasteListingRequestsPanel';
import {
  loadWasteListing,
  loadWasteListings,
} from '../../src/operations/wasteManagement/api/wasteListingClient';
import {
  authorable,
  authorConfiguration,
  authorAcknowledgment,
  authoredReadback,
  authorPresentation,
} from './listingAuthoringFixtures';

vi.mock(
  '../../src/operations/wasteManagement/api/wasteListingClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/wasteManagement/api/wasteListingClient')
    >()),
    loadWasteListing: vi.fn(),
    loadWasteListings: vi.fn(),
  }),
);
const props = {
  configuration: authorConfiguration,
  presentation: authorPresentation,
  employeeId: 'synthetic-operator',
  sessionGeneration: 1,
};
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
function page(selected = props) {
  return (
    <MemoryRouter>
      <WasteListingRequestsPanel {...selected} />
      <Location />
    </MemoryRouter>
  );
}
function transport(value: unknown = authorAcknowledgment, status = 200) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ data: value }), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
async function inspect() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Inspect listing: SYNTHETIC_ASSET' }),
  );
  return screen.findByRole('dialog', { name: 'SYNTHETIC_ASSET' });
}
async function review() {
  const detail = await inspect();
  await userEvent.click(
    await within(detail).findByRole('button', { name: 'Author Product source' }),
  );
  return screen.findByRole('dialog', {
    name: authorPresentation.authoring!.reviewTitle,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadWasteListings).mockResolvedValue({
    contractVersion: 1,
    items: [authorable],
    total: 1,
    page: 1,
    limit: 25,
  });
  vi.mocked(loadWasteListing).mockResolvedValue(authorable);
});
afterEach(() => vi.unstubAllGlobals());
describe('reviewed Product authoring and normal publication handoff', () => {
  it('requires confirmation, exposes exact pinned selectors, cancels without writes and submits only once', async () => {
    const fetch = transport();
    render(page());
    let dialog = await review();
    expect(within(dialog).getByText(/"expectedRevision": 3/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: authorPresentation.authoring!.cancelLabel,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: authorPresentation.authoring!.reviewTitle,
        }),
      ).not.toBeInTheDocument(),
    );
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Author Product source' }),
    );
    dialog = await screen.findByRole('dialog', {
      name: authorPresentation.authoring!.reviewTitle,
    });
    vi.mocked(loadWasteListing).mockResolvedValue(authoredReadback);
    const confirm = within(dialog).getByRole('button', {
      name: authorPresentation.authoring!.confirmLabel,
    });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(
      await screen.findByText(/Source saved; publication still required/),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledOnce();
    expect(loadWasteListing).toHaveBeenCalledTimes(2);
    const publication = await screen.findByRole('link', { name: 'Review publication' });
    expect(publication).toHaveAttribute('href', '/publishing/requests');
    await userEvent.click(publication);
    expect(screen.getByLabelText('Current route')).toHaveTextContent(
      '/publishing/requests',
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('holds uncertainty across close/reopen and only GET inspection reconciles the original intent', async () => {
    const fetch = transport();
    fetch.mockRejectedValue(new Error('PRIVATE lost reply'));
    render(page());
    const dialog = await review();
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: authorPresentation.authoring!.confirmLabel,
      }),
    );
    expect(await screen.findByText(/Outcome unconfirmed/)).toBeVisible();
    expect(screen.queryByText('PRIVATE lost reply')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Author Product source' }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await inspect();
    expect(
      screen.getByRole('button', { name: 'Author Product source' }),
    ).toBeDisabled();
    vi.mocked(loadWasteListing).mockResolvedValue(authoredReadback);
    await userEvent.click(
      screen.getByRole('button', { name: authorPresentation.authoring!.inspectLabel }),
    );
    expect(
      await screen.findByText(/Source saved; publication still required/),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST');
  });
  it('reconciles a lost POST reply with the first independent same-intent source read', async () => {
    const fetch = transport();
    fetch.mockRejectedValue(new Error('Lost reply'));
    render(page());
    const dialog = await review();
    vi.mocked(loadWasteListing).mockResolvedValue(authoredReadback);
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: authorPresentation.authoring!.confirmLabel,
      }),
    );
    expect(
      await screen.findByText(/Source saved; publication still required/),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('keeps an acknowledged command held when readback drifts and never enables another POST', async () => {
    const fetch = transport();
    render(page());
    const dialog = await review();
    vi.mocked(loadWasteListing).mockResolvedValue({
      ...authoredReadback,
      assetRevision: 4,
    });
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: authorPresentation.authoring!.confirmLabel,
      }),
    );
    expect(await screen.findByText(/Outcome unconfirmed/)).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Review publication' }),
    ).toBeDisabled();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('retires confirmation on a new employee admission and ignores a stale button handler', async () => {
    const fetch = transport();
    const view = render(page());
    const dialog = await review();
    const confirm = within(dialog).getByRole('button', {
      name: authorPresentation.authoring!.confirmLabel,
    });
    view.rerender(
      page({
        ...props,
        configuration: { ...authorConfiguration, accessToken: 'other-synthetic-token' },
        sessionGeneration: 2,
      }),
    );
    fireEvent.click(confirm);
    expect(fetch).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: authorPresentation.authoring!.reviewTitle,
        }),
      ).not.toBeInTheDocument(),
    );
  });
  it('does not adopt a late Product response or read using an old admission', async () => {
    let finish!: (value: Response) => void;
    const fetch = transport();
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(page());
    const dialog = await review();
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: authorPresentation.authoring!.confirmLabel,
      }),
    );
    expect(await screen.findByText(/Authoring source/)).toBeVisible();
    view.rerender(
      page({
        ...props,
        configuration: { ...authorConfiguration, accessToken: 'other-synthetic-token' },
        sessionGeneration: 2,
      }),
    );
    await act(async () => {
      finish(
        new Response(JSON.stringify({ data: authorAcknowledgment }), { status: 200 }),
      );
      await Promise.resolve();
    });
    expect(
      screen.queryByText(/Source saved; publication still required/),
    ).not.toBeInTheDocument();
    expect(loadWasteListing).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('invalidates a confirmation when a fresh detail changes the pinned asset revision', async () => {
    const fetch = transport();
    const view = render(page());
    const dialog = await review();
    const confirm = within(dialog).getByRole('button', {
      name: authorPresentation.authoring!.confirmLabel,
    });
    vi.mocked(loadWasteListing).mockResolvedValue({ ...authorable, assetRevision: 4 });
    view.rerender(
      page({
        ...props,
        configuration: {
          ...authorConfiguration,
          bootstrap: structuredClone(authorConfiguration.bootstrap),
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: authorPresentation.authoring!.reviewTitle,
        }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(confirm);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never enables authoring without owner confirmation/outcome copy', async () => {
    const fetch = transport();
    const presentation = {
      labels: authorPresentation.labels,
      states: authorPresentation.states,
    };
    render(page({ ...props, presentation }));
    await inspect();
    expect(
      screen.getByRole('button', { name: 'Author Product source' }),
    ).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps publication disabled without an admitted existing destination', async () => {
    const fetch = transport();
    vi.mocked(loadWasteListing).mockResolvedValue(authoredReadback);
    render(
      page({
        ...props,
        configuration: {
          ...authorConfiguration,
          bootstrap: { ...authorConfiguration.bootstrap, navigation: [] },
        },
      }),
    );
    await inspect();
    expect(screen.getByRole('button', { name: 'Review publication' })).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: 'Review publication' }),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
