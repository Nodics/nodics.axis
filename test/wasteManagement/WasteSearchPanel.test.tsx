import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { WasteSearchPanel } from '../../src/operations/wasteManagement/WasteSearchPanel';
import type {
  WasteDashboardData,
  WasteReviewFilters,
} from '../../src/operations/wasteManagement/api/wasteReviewClient';
const labels = {
  dateFrom: 'Submitted from',
  dateTo: 'Submitted until',
  family: 'Waste family',
  centre: 'Collection centre',
  area: 'Area / city',
  channel: 'Channel',
  size: 'Handling size',
  all: 'All',
  apply: 'Apply search',
};
const data: WasteDashboardData = {
  contractVersion: 1,
  generatedAt: '',
  dateBasis: 'UTC',
  trend: [],
  centres: [{ code: 'CENTRE', name: 'City Centre', city: 'Dubai', countryCode: 'AE' }],
  unavailableSources: [],
  families: [{ code: 'CLOTHING', name: 'Clothing' }],
  categories: [],
  itemTypes: [],
  materials: [],
};
const apply = vi.fn();
function Harness() {
  const [query, setQuery] = useState('shirt'),
    [appliedQuery, setAppliedQuery] = useState('shirt');
  const [status, setStatus] = useState('SUBMITTED');
  const [draft, setDraft] = useState<WasteReviewFilters>({}),
    [applied, setApplied] = useState<WasteReviewFilters>({});
  return (
    <WasteSearchPanel
      ownerModule="clothing"
      labels={{
        advancedSearch: 'Advanced search',
        clearAll: 'Clear all',
        status: 'Submission status',
      }}
      filterLabels={labels}
      data={data}
      fixedFamily="CLOTHING"
      query={query}
      appliedQuery={appliedQuery}
      setQuery={setQuery}
      onSearch={() => setAppliedQuery(query)}
      status={status}
      defaultStatus="ALL"
      statuses={[
        { code: 'ALL', label: 'All submissions' },
        { code: 'SUBMITTED', label: 'Pending' },
      ]}
      counts={{ ALL: 4, SUBMITTED: 2 }}
      onStatus={setStatus}
      filters={draft}
      appliedFilters={applied}
      setFilters={setDraft}
      apply={() => {
        apply(draft);
        setApplied(draft);
      }}
      removeFilter={(key) => {
        const next = { ...applied };
        delete next[key];
        setApplied(next);
        setDraft(next);
      }}
      reset={() => {
        setQuery('');
        setAppliedQuery('');
        setStatus('ALL');
        setDraft({});
        setApplied({});
      }}
      loading={false}
      disabled={false}
      exporting={false}
      total={2}
      onExport={vi.fn()}
    />
  );
}
it('combines basic and advanced search, preserves drafts and clears optional criteria without losing family scope', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(
    screen.queryByRole('button', { name: 'Refine your view' }),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Waste family: Clothing')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Advanced search' }));
  expect(screen.getByRole('combobox', { name: 'Waste family' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByLabelText('Submitted from')).toBeVisible();
  expect(screen.getByLabelText('Submitted until')).toBeVisible();
  for (const name of ['Collection centre', 'Area / city', 'Channel', 'Handling size'])
    expect(screen.getByRole('combobox', { name })).toBeVisible();
  await user.click(screen.getByRole('combobox', { name: 'Channel' }));
  await user.click(screen.getByRole('option', { name: 'Telegram' }));
  await user.click(screen.getByRole('button', { name: 'Advanced search' }));
  await user.click(screen.getByRole('button', { name: 'Advanced search' }));
  expect(screen.getByRole('combobox', { name: 'Channel' })).toHaveTextContent(
    'Telegram',
  );
  await user.click(screen.getByRole('button', { name: 'Apply search' }));
  expect(apply).toHaveBeenCalledWith({ channel: 'TELEGRAM' });
  await user.click(screen.getByRole('button', { name: /Advanced search/ }));
  expect(screen.getByRole('button', { name: 'Channel: Telegram' })).toBeVisible();
  screen.getByRole('button', { name: 'Channel: Telegram' }).focus();
  await user.keyboard('{Delete}');
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Channel: Telegram' }),
    ).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByRole('textbox', { name: 'Search submissions' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Submission status' })).toHaveTextContent(
    'All submissions',
  );
  expect(screen.getByText('Waste family: Clothing')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
});
