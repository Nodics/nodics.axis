import type { RulePropertyCatalogue } from '../../src/operations/rulesManagement/api/rulesClient';
export const catalogue: RulePropertyCatalogue = {
  code: 'EWASTE_REWARD_PROPERTIES',
  version: '1',
  simulationInputPath: ['properties'],
  properties: [
    {
      code: 'asset.quantity',
      displayName: 'Quantity',
      dataType: 'NUMBER',
      allowedOperators: ['GREATER_THAN', 'BETWEEN', 'IN'],
      supportsFallback: true,
    },
    {
      code: 'verification.status',
      displayName: 'Verification status',
      dataType: 'STRING',
      allowedOperators: ['EQUALS'],
      allowedValues: ['APPROVED', 'REJECTED'],
    },
  ],
  authoring: {
    contractVersion: 1,
    groupOperators: ['ALL', 'ANY'],
    missingValueBehaviors: ['REQUIRED', 'OPTIONAL', 'FALLBACK_ALLOWED'],
    inputQualities: ['UNAVAILABLE', 'CUSTOMER_CONFIRMED', 'OPERATOR_VERIFIED'],
    limits: {
      maximumRuleGroupsPerSet: 10,
      maximumConditionsPerGroup: 5,
      maximumGroupDepth: 3,
    },
    operators: {
      EQUALS: { dataTypes: ['STRING', 'NUMBER'], valueShape: 'ONE' },
      GREATER_THAN: { dataTypes: ['NUMBER'], valueShape: 'ONE' },
      BETWEEN: { dataTypes: ['NUMBER'], valueShape: 'RANGE' },
      IN: { dataTypes: ['NUMBER'], valueShape: 'LIST' },
    },
    outcomeTypes: [
      {
        code: 'ADD_SCORE',
        label: { en: 'Add score' },
        fields: [{ code: 'score', dataType: 'NUMBER', required: true }],
      },
    ],
  },
};
export const rule = {
  code: 'TEST_POLICY',
  name: 'Test policy',
  status: 'DRAFT',
  draftRevision: 3,
  currentVersion: 0,
  scopeType: 'DOMAIN',
  propertyProviderCode: 'eWaste.reward',
  scoreBandSetCode: 'TEST_BANDS',
  allowedOperations: [
    'updateDraft',
    'validateDraft',
    'simulateDraft',
    'submitForApproval',
    'prepareNextDraft',
  ],
  validation: { valid: true, issues: [] },
  lastSimulation: { draftRevision: 3, sourceHash: 'a'.repeat(64) },
  definition: {
    groups: [
      {
        code: 'BASE',
        operator: 'ALL',
        conditions: [
          {
            code: 'C1',
            propertyCode: 'asset.quantity',
            operatorCode: 'GREATER_THAN',
            value: 0,
            missingValueBehavior: 'REQUIRED',
          },
        ],
        outcome: { outcomeType: 'ADD_SCORE', parameters: { score: 10 } },
      },
    ],
  },
};
export const bandSet = {
  code: 'TEST_BANDS',
  name: 'Test bands',
  status: 'DRAFT',
  currentVersion: 1,
  draftRevision: 2,
  gapBehavior: 'REJECT',
  allowedOperations: [
    'updateBandSetDraft',
    'prepareNextBandSetDraft',
    'publishBandSetDraft',
  ],
  bands: [
    { code: 'REWARDABLE', minScore: 0, maxScore: null, outcome: { rewardable: true } },
  ],
};
