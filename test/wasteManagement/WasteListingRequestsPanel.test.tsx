import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteListingRequestsPanel } from '../../src/operations/wasteManagement/WasteListingRequestsPanel';
import {
  loadWasteListing,
  loadWasteListings,
  parseWasteListing,
  type WasteListingPage,
  type WasteListingRequest,
} from '../../src/operations/wasteManagement/api/wasteListingClient';
import { configuration, listing, presentation } from './listingFixtures';

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
const row = parseWasteListing(listing, configuration.enterpriseCode);
const page = (
  items: readonly WasteListingRequest[] = [row],
  total = items.length,
  number = 1,
): WasteListingPage => ({ contractVersion: 1, items, total, page: number, limit: 25 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const props = {
  configuration,
  presentation,
  employeeId: 'synthetic-operator',
  sessionGeneration: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadWasteListings).mockResolvedValue(page());
  vi.mocked(loadWasteListing).mockResolvedValue(row);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('No UI mutations allowed')),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function inspect() {
  await userEvent
    .setup()
    .click(
      await screen.findByRole('button', { name: 'Inspect listing: SYNTHETIC_ASSET' }),
    );
  return screen.findByRole('dialog');
}
describe('read-only retained listing panel', () => {
  it('loads the owner page, inspects the exact row and keeps qualified authoring disabled while its API is pending', async () => {
    vi.mocked(loadWasteListing).mockResolvedValue(
      parseWasteListing(
        {
          ...listing,
          state: 'AWAITING_AUTHORING',
          eligibility: { ...listing.eligibility, canAuthor: true },
          actions: ['READ_DETAILS', 'AUTHOR_PRODUCT_SOURCE'],
        },
        configuration.enterpriseCode,
      ),
    );
    render(<WasteListingRequestsPanel {...props} />);
    const dialog = await inspect();
    expect(
      await within(dialog).findByText('Read-only listing inspection'),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Author Product source' }),
    ).toBeDisabled();
    expect(loadWasteListing).toHaveBeenCalledExactlyOnceWith(
      configuration,
      'SYNTHETIC_ASSET',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows original signed and required enterprise and retains wrong-context controls read-only', async () => {
    const scoped = { ...configuration, enterpriseCode: 'Default' };
    const value = parseWasteListing(
      {
        ...listing,
        eligibility: {
          ...listing.eligibility,
          signedEnterpriseCode: 'Default',
          blockerCode: 'ERR_EWASTE_LISTING_STORE_ENTERPRISE_REQUIRED',
        },
      },
      'Default',
    );
    vi.mocked(loadWasteListings).mockResolvedValue(page([value]));
    vi.mocked(loadWasteListing).mockResolvedValue(value);
    render(<WasteListingRequestsPanel {...props} configuration={scoped} />);
    const dialog = await inspect();
    expect(
      await within(dialog).findByText(presentation.labels.wrongEnterprise),
    ).toBeVisible();
    expect(within(dialog).getByText('Default')).toBeVisible();
    expect(within(dialog).getByText('STORE_ENTERPRISE')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Author Product source' }),
    ).toBeDisabled();
    expect(loadWasteListing).toHaveBeenCalledWith(scoped, listing.assetCode);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['OWNER_UNAVAILABLE', 'RECONCILIATION_REQUIRED'] as const)(
    'renders %s without treating null Product evidence as authoring permission',
    async (state) => {
      const value = parseWasteListing(
        {
          ...listing,
          state,
          listingKey: null,
          intentDigest: null,
          requestRevision: null,
          storeContext: null,
          authoringContext: null,
          productCommand: null,
          priceRowIntent: null,
          eligibility: {
            ...listing.eligibility,
            requiredEnterpriseCode: null,
            blockerCode:
              state === 'OWNER_UNAVAILABLE'
                ? 'ERR_EWASTE_LISTING_OWNER_UNAVAILABLE'
                : 'ERR_EWASTE_LISTING_RECONCILIATION_REQUIRED',
          },
        },
        configuration.enterpriseCode,
      );
      vi.mocked(loadWasteListings).mockResolvedValue(page([value]));
      vi.mocked(loadWasteListing).mockResolvedValue(value);
      render(<WasteListingRequestsPanel {...props} />);
      const dialog = await inspect();
      expect(
        await within(dialog).findByText(
          state === 'OWNER_UNAVAILABLE'
            ? presentation.labels.ownerUnavailable
            : presentation.labels.reconciliationRequired,
        ),
      ).toBeVisible();
      expect(
        within(dialog).queryByRole('button', { name: 'Author Product source' }),
      ).not.toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('uses owner publication references as read-only text without navigating or approving', async () => {
    const value: WasteListingRequest = {
      ...row,
      state: 'AWAITING_PUBLICATION',
      actions: ['READ_DETAILS', 'OPEN_PUBLICATION_WORKFLOW'],
      publicationReferences: [
        {
          domain: 'product',
          code: 'SYNTHETIC_PUBLICATION',
          state: 'PENDING_APPROVAL',
          processCode: 'SYNTHETIC_PROCESS',
        },
      ],
    };
    vi.mocked(loadWasteListing).mockResolvedValue(value);
    render(<WasteListingRequestsPanel {...props} />);
    const dialog = await inspect();
    expect(await within(dialog).findByText(/SYNTHETIC_PUBLICATION/)).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Review publication' }),
    ).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('distinguishes failed queue reads from empty results and permits an explicit GET refresh', async () => {
    const user = userEvent.setup();
    vi.mocked(loadWasteListings).mockRejectedValueOnce(
      new Error('PRIVATE dependency text'),
    );
    render(<WasteListingRequestsPanel {...props} />);
    expect(await screen.findByText(presentation.labels.unavailable)).toBeVisible();
    expect(screen.queryByText(presentation.labels.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    expect(loadWasteListings).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: presentation.labels.refresh }));
    expect(await screen.findByText('SYNTHETIC_ASSET')).toBeVisible();
    expect(loadWasteListings).toHaveBeenCalledTimes(2);
  });
  it('removes old queue content after a failed explicit refresh rather than showing a stale empty/success state', async () => {
    const user = userEvent.setup();
    render(<WasteListingRequestsPanel {...props} />);
    await screen.findByText('SYNTHETIC_ASSET');
    vi.mocked(loadWasteListings).mockRejectedValueOnce(new Error('Denied'));
    await user.click(screen.getByRole('button', { name: presentation.labels.refresh }));
    expect(await screen.findByText(presentation.labels.unavailable)).toBeVisible();
    expect(screen.queryByText('SYNTHETIC_ASSET')).not.toBeInTheDocument();
  });
  it('can close a pending detail read and never reopens from its late response', async () => {
    const pending = deferred<WasteListingRequest>(),
      user = userEvent.setup();
    vi.mocked(loadWasteListing).mockReturnValueOnce(pending.promise);
    render(<WasteListingRequestsPanel {...props} />);
    const dialog = await inspect();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await act(async () => {
      pending.resolve(row);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(loadWasteListing).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retires previous-token reads and private detail immediately on a new session admission', async () => {
    const old = deferred<WasteListingPage>(),
      current = deferred<WasteListingPage>();
    vi.mocked(loadWasteListings)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const view = render(<WasteListingRequestsPanel {...props} />);
    view.rerender(
      <WasteListingRequestsPanel
        {...props}
        sessionGeneration={2}
        configuration={{ ...configuration, accessToken: 'new-synthetic-access' }}
      />,
    );
    await act(async () => {
      current.resolve(page([{ ...row, assetCode: 'CURRENT_ASSET' }]));
      await Promise.resolve();
    });
    expect(await screen.findByText('CURRENT_ASSET')).toBeVisible();
    await act(async () => {
      old.resolve(page());
      await Promise.resolve();
    });
    expect(screen.queryByText('SYNTHETIC_ASSET')).not.toBeInTheDocument();
    expect(screen.getByText('CURRENT_ASSET')).toBeVisible();
  });
  it('pages through owner reads and restores the first page without invoking an action', async () => {
    const user = userEvent.setup();
    vi.mocked(loadWasteListings).mockImplementation((_cfg, number) =>
      Promise.resolve(
        number === 2
          ? page([{ ...row, assetCode: 'PAGE_TWO' }], 26, 2)
          : page(
              Array.from({ length: 25 }, (_, index) => ({
                ...row,
                assetCode: `PAGE_ONE_${index}`,
              })),
              26,
            ),
      ),
    );
    render(<WasteListingRequestsPanel {...props} />);
    expect(await screen.findByText('PAGE_ONE_0')).toBeVisible();
    await user.click(screen.getByRole('button', { name: presentation.labels.next }));
    expect(await screen.findByText('PAGE_TWO')).toBeVisible();
    expect(
      screen.getByRole('button', { name: presentation.labels.next }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: presentation.labels.previous }),
    );
    expect(await screen.findByText('PAGE_ONE_0')).toBeVisible();
    await waitFor(() => expect(loadWasteListings).toHaveBeenCalledTimes(3));
    expect(fetch).not.toHaveBeenCalled();
  });
});
