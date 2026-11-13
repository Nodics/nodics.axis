import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesManagementRoutePage } from '../../src/operations/rulesManagement/RulesManagementRoutePage';
import * as client from '../../src/operations/rulesManagement/api/rulesClient';
import { catalogue, rule, bandSet } from './fixtures';
vi.mock('../../src/operations/rulesManagement/api/rulesClient', () => ({
  loadRuleDefinition: vi.fn(),
  loadRuleDefinitions: vi.fn(),
  loadRuleAudit: vi.fn(),
  loadRuleVersions: vi.fn(),
  loadPropertyCatalogue: vi.fn(),
  loadScoreBandSets: vi.fn(),
  loadScoreBandSet: vi.fn(),
  prepareRuleDraft: vi.fn(),
  prepareScoreBandDraft: vi.fn(),
  publishScoreBandDraft: vi.fn(),
  saveScoreBandDraft: vi.fn(),
  saveRuleDraft: vi.fn(),
  simulateRuleDraft: vi.fn(),
  submitRuleDraft: vi.fn(),
  validateRuleDraft: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(client.loadRuleDefinitions).mockResolvedValue([rule]);
  vi.mocked(client.loadRuleDefinition).mockResolvedValue(rule);
  vi.mocked(client.loadRuleVersions).mockResolvedValue([
    { version: 1, status: 'ACTIVE' },
  ]);
  vi.mocked(client.loadRuleAudit).mockResolvedValue([
    { eventType: 'DRAFT_SAVED', actor: 'operator' },
  ]);
  vi.mocked(client.loadPropertyCatalogue).mockResolvedValue(catalogue);
  vi.mocked(client.loadScoreBandSets).mockResolvedValue([bandSet]);
  vi.mocked(client.loadScoreBandSet).mockResolvedValue(bandSet);
  vi.mocked(client.saveScoreBandDraft).mockResolvedValue(bandSet);
  vi.mocked(client.saveRuleDraft).mockResolvedValue(rule);
});
const navigation = {
  id: 'rules-management',
  moduleName: 'rulesApi',
  label: 'Rules Management',
  route: '/rules/management',
  category: 'operations',
  icon: 'rules',
  order: 1700,
  availability: 'UP',
  featureState: 'PREVIEW',
  perspectives: [],
  contexts: [],
} as const;
const props = {
  accessToken: 'token',
  bootstrap: { navigation: [navigation], moduleConnections: {} } as never,
  navigation,
  runtime: { enterpriseCode: 'default', requestTimeoutMs: 1000 } as never,
};
function renderPage(token = 'token') {
  return render(
    <MemoryRouter>
      <RulesManagementRoutePage {...props} accessToken={token} />
    </MemoryRouter>,
  );
}
const ready = async () => {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled(),
  );
};

describe('RulesManagementRoutePage structured lifecycle', () => {
  it('authors nested conditions with owner-selected properties and typed ranges, retaining the reviewed revision', async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    expect(screen.queryByRole('textbox', { name: /JSON/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add nested group' }));
    const child = screen.getByRole('group', { name: 'Group 1.1' });
    await user.click(within(child).getByRole('button', { name: 'Add condition' }));
    await user.click(within(child).getByRole('combobox', { name: 'Property' }));
    await user.click(screen.getByRole('option', { name: 'Quantity' }));
    await user.click(within(child).getByRole('combobox', { name: 'Comparison' }));
    await user.click(screen.getByRole('option', { name: 'between' }));
    fireEvent.change(within(child).getByRole('spinbutton', { name: 'Value' }), {
      target: { value: '2' },
    });
    fireEvent.change(within(child).getByRole('spinbutton', { name: 'Upper value' }), {
      target: { value: '5' },
    });
    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(client.saveRuleDraft).toHaveBeenCalledOnce());
    expect(client.saveRuleDraft).toHaveBeenCalledWith(
      expect.anything(),
      rule.code,
      expect.objectContaining({
        groups: [
          expect.objectContaining({
            childGroups: [
              expect.objectContaining({
                conditions: [
                  expect.objectContaining({
                    propertyCode: 'asset.quantity',
                    operatorCode: 'BETWEEN',
                    value: 2,
                    valueTo: 5,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      3,
    );
  });
  it('refuses write presentation without exact owner operation eligibility', async () => {
    vi.mocked(client.loadRuleDefinition).mockResolvedValue({
      ...rule,
      allowedOperations: [],
    });
    renderPage();
    await screen.findByText('Rule builder');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add group' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(client.saveRuleDraft).not.toHaveBeenCalled();
  });
  it('saves typed bands with the exact owner revision and requires a separate publication review', async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    await user.click(screen.getByRole('tab', { name: 'Bands' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum score' }), {
      target: { value: '4' },
    });
    expect(
      screen.getByRole('button', { name: 'Review and publish bands' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save score-band draft' }));
    await waitFor(() =>
      expect(client.saveScoreBandDraft).toHaveBeenCalledWith(
        expect.anything(),
        bandSet.code,
        {
          bands: [{ ...bandSet.bands[0], minScore: 4 }],
          gapBehavior: 'REJECT',
          expectedDraftRevision: 2,
        },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Review and publish bands' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Review and publish bands' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    ).toBeDisabled();
    expect(client.publishScoreBandDraft).not.toHaveBeenCalled();
  });
  it('does not dispatch a stale revision and preserves the unsaved edit for inspection', async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Value' }), {
      target: { value: '2' },
    });
    vi.mocked(client.loadRuleDefinition).mockResolvedValue({
      ...rule,
      draftRevision: 4,
    });
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(
      await screen.findByText(/revision or your permissions changed/),
    ).toBeVisible();
    expect(client.saveRuleDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton', { name: 'Value' })).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });
  it('holds an uncertain command and does not replay it while a later inspection is pending', async () => {
    const user = userEvent.setup();
    renderPage();
    await ready();
    vi.mocked(client.saveRuleDraft).mockRejectedValue(
      new Error('Connection interrupted'),
    );
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(client.saveRuleDraft).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Reload saved revision' }));
    await ready();
    expect(client.saveRuleDraft).toHaveBeenCalledOnce();
  });
  it('retires old actor observations without replacing the new actor workspace', async () => {
    let settle!: (value: typeof rule) => void;
    vi.mocked(client.loadRuleDefinition).mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const view = renderPage();
    await waitFor(() => expect(client.loadRuleDefinition).toHaveBeenCalledOnce());
    view.rerender(
      <MemoryRouter>
        <RulesManagementRoutePage {...props} accessToken="second" />
      </MemoryRouter>,
    );
    await ready();
    await act(async () => {
      settle({ ...rule, name: 'Obsolete private draft' });
      await Promise.resolve();
    });
    expect(screen.queryByText('Obsolete private draft')).toBeNull();
  });
  it('reports unavailable history instead of presenting a successful empty read', async () => {
    vi.mocked(client.loadRuleAudit).mockRejectedValue(new Error('Audit denied'));
    renderPage();
    await ready();
    expect(screen.getByText('Audit: Audit denied')).toBeVisible();
  });
});
