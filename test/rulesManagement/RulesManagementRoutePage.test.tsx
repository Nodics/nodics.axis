import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RulesManagementRoutePage } from '../../src/operations/rulesManagement/RulesManagementRoutePage';
import {
  loadRuleDefinition,
  loadRuleDefinitions,
  loadRuleAudit,
  loadRuleVersions,
  loadPropertyCatalogue,
  loadScoreBandSets,
  loadScoreBandSet,
  saveScoreBandDraft,
} from '../../src/operations/rulesManagement/api/rulesClient';

vi.mock('../../src/operations/rulesManagement/api/rulesClient', () => ({
  loadRuleDefinition: vi.fn(),
  loadRuleDefinitions: vi.fn(),
  loadRuleAudit: vi.fn(),
  loadRuleVersions: vi.fn(),
  loadPropertyCatalogue: vi.fn(),
  loadScoreBandSets: vi.fn(),
  loadScoreBandSet: vi.fn(),
  prepareRuleDraft: vi.fn(),
  saveScoreBandDraft: vi.fn(),
  saveRuleDraft: vi.fn(),
  simulateRuleDraft: vi.fn(),
  submitRuleDraft: vi.fn(),
  validateRuleDraft: vi.fn(),
}));

const rule = {
  code: 'EWASTE_REWARD',
  name: 'eWaste reward policy',
  status: 'DRAFT',
  scopeType: 'TENANT',
  propertyProviderCode: 'eWaste.reward',
  scoreBandSetCode: 'EWASTE_REWARD_BANDS',
  definition: {
    groups: [
      {
        code: 'BASE',
        conditions: [{ code: 'C1', propertyCode: 'asset.itemTypeCode' }],
      },
    ],
  },
};

const bandSet = {
  code: 'EWASTE_REWARD_BANDS',
  name: 'eWaste reward bands',
  status: 'DRAFT',
  currentVersion: 1,
  gapBehavior: 'REJECT',
  bands: [
    {
      code: 'REWARDABLE',
      minScore: 70,
      maxScore: null,
      outcome: { rewardable: true },
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadRuleDefinitions).mockResolvedValue([rule]);
  vi.mocked(loadRuleDefinition).mockResolvedValue(rule);
  vi.mocked(loadRuleVersions).mockResolvedValue([{ version: 1, status: 'PUBLISHED' }]);
  vi.mocked(loadRuleAudit).mockResolvedValue([
    { eventType: 'DRAFT_SAVED', actor: 'operator' },
  ]);
  vi.mocked(loadPropertyCatalogue).mockResolvedValue({
    code: 'EWASTE_REWARD_PROPERTIES',
    properties: [
      {
        code: 'asset.itemTypeCode',
        label: 'Item type',
      },
    ],
  });
  vi.mocked(loadScoreBandSets).mockResolvedValue([bandSet]);
  vi.mocked(loadScoreBandSet).mockResolvedValue(bandSet);
  vi.mocked(saveScoreBandDraft).mockResolvedValue(bandSet);
});

function renderPage() {
  const navigation = {
    id: 'rules-management',
    moduleName: 'rulesEngine',
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

  return render(
    <RulesManagementRoutePage
      accessToken="token"
      bootstrap={{ navigation: [navigation], moduleConnections: {} } as never}
      navigation={navigation}
      runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
    />,
  );
}

describe('RulesManagementRoutePage', () => {
  it('loads rule builder context from the backend Rules API owner', async () => {
    renderPage();

    expect(await screen.findByText('Rule builder')).toBeVisible();
    expect(screen.getByText('1 groups')).toBeVisible();
    expect(screen.getByText('1 conditions')).toBeVisible();
    expect(screen.getByText('Item type')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Bands' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Review' })).toBeVisible();

    expect(loadRuleVersions).toHaveBeenCalledWith(expect.anything(), 'EWASTE_REWARD');
    expect(loadRuleAudit).toHaveBeenCalledWith(expect.anything(), 'EWASTE_REWARD');
    expect(loadPropertyCatalogue).toHaveBeenCalledWith(
      expect.anything(),
      'eWaste.reward',
    );
    expect(loadScoreBandSets).toHaveBeenCalledWith(expect.anything());
  });

  it('saves score-band draft changes through the owner client', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Bands' }));
    expect(screen.getByText('eWaste reward bands')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save score-band draft' }));

    await waitFor(() =>
      expect(saveScoreBandDraft).toHaveBeenCalledWith(
        expect.anything(),
        'EWASTE_REWARD_BANDS',
        {
          bands: bandSet.bands,
          gapBehavior: 'REJECT',
        },
      ),
    );
  });
});
