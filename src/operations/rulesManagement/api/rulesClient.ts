import type { AxisAuthenticatedBootstrap } from '../../../bootstrap/publicBootstrap';
import { invokeOperationalOwner as invoke } from '../../shared/operationalOwnerClient';

export interface RulesClientConfiguration {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface RuleDefinitionSummary {
  readonly code: string;
  readonly name?: string | { readonly en?: string };
  readonly status: string;
  readonly currentVersion?: number;
  readonly draftRevision?: number;
  readonly consumerModule?: string;
  readonly policyType?: string;
  readonly scopeType?: string;
  readonly scopeCode?: string;
  readonly propertyProviderCode?: string;
  readonly scoreBandSetCode?: string;
  readonly scoreBandSetVersion?: number;
  readonly definition?: { readonly groups?: readonly unknown[] };
  readonly allowedOperations?: readonly string[];
  readonly validation?: {
    readonly valid: boolean;
    readonly issues: readonly { readonly code: string; readonly path?: string }[];
  };
  readonly lastSimulation?: {
    readonly draftRevision: number;
    readonly sourceHash: string;
    readonly bandSetCode?: string;
    readonly bandSetVersion?: number;
  };
  readonly approval?: {
    readonly status?: string;
    readonly processInstanceCode?: string;
    readonly requestedBy?: string;
  };
}

export interface RuleSimulationResult {
  readonly finalScore?: number;
  readonly scoreBandCode?: string;
  readonly matchedRules?: readonly string[];
  readonly skippedRules?: readonly string[];
  readonly sourceHash?: string;
}

export interface RulePropertyCatalogue {
  readonly code?: string;
  readonly version?: string | number;
  readonly properties?: readonly RulePropertyDescriptor[];
  readonly authoring?: RuleAuthoringContract;
  readonly simulationInputPath?: readonly string[];
}

export interface RulePropertyDescriptor {
  readonly code: string;
  readonly label?: string | { readonly en?: string };
  readonly valueType?: string;
  readonly displayName?: string | Readonly<Record<string, string>>;
  readonly dataType?: string;
  readonly allowedOperators?: readonly string[];
  readonly supportsFallback?: boolean;
  readonly allowedValues?: readonly unknown[];
}

/** Inert presentation metadata supplied by Rules owners; no browser-side evaluator. */
export interface RuleAuthoringContract {
  readonly contractVersion: 1;
  readonly groupOperators: readonly string[];
  readonly inputQualities: readonly string[];
  readonly missingValueBehaviors: readonly string[];
  readonly limits: {
    readonly maximumRuleGroupsPerSet: number;
    readonly maximumConditionsPerGroup: number;
    readonly maximumGroupDepth: number;
  };
  readonly operators: Readonly<
    Record<
      string,
      {
        readonly dataTypes: readonly string[];
        readonly valueShape: 'NONE' | 'ONE' | 'LIST' | 'RANGE';
      }
    >
  >;
  readonly outcomeTypes: readonly {
    readonly code: string;
    readonly label?: Readonly<Record<string, string>>;
    readonly fields: readonly {
      readonly code: string;
      readonly dataType: string;
      readonly required?: boolean;
    }[];
  }[];
}

export interface RuleSetVersionSummary {
  readonly code?: string;
  readonly ruleSetCode?: string;
  readonly version?: number;
  readonly status?: string;
  readonly publishedAt?: string;
  readonly createdAt?: string;
  readonly effectiveFrom?: string;
}

export interface RuleAuditEventSummary {
  readonly code?: string;
  readonly eventType?: string;
  readonly action?: string;
  readonly status?: string;
  readonly actor?: string;
  readonly createdAt?: string;
  readonly processInstanceCode?: string;
}

export interface ScoreBandSetSummary {
  readonly code: string;
  readonly name?: string | { readonly en?: string };
  readonly status?: string;
  readonly currentVersion?: number;
  readonly draftRevision?: number;
  readonly bands?: readonly ScoreBandSummary[];
  readonly gapBehavior?: string;
  readonly allowedOperations?: readonly string[];
}

export interface ScoreBandSummary {
  readonly code: string;
  readonly minScore?: number | undefined;
  readonly maxScore?: number | null;
  readonly outcome?: Record<string, unknown>;
  readonly enabled?: boolean;
  readonly [key: string]: unknown;
}

const owner = 'rulesApi';
const definitionPath = (code: string) => '/definitions/' + encodeURIComponent(code);
const bandSetPath = (code: string) => '/band-sets/' + encodeURIComponent(code);

/** Reads authorized governed Rules definitions from the owning module. */
export function loadRuleDefinitions(configuration: RulesClientConfiguration) {
  return invoke<RuleDefinitionSummary[]>(configuration, owner, '/definitions');
}

/** Reads one Rules definition without creating a browser-side policy registry. */
export function loadRuleDefinition(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<RuleDefinitionSummary>(configuration, owner, definitionPath(code));
}

/** Reads immutable policy versions from the Rules API owner. */
export function loadRuleVersions(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<RuleSetVersionSummary[]>(
    configuration,
    owner,
    definitionPath(code) + '/versions',
  );
}

/** Reads immutable audit events from the Rules API owner. */
export function loadRuleAudit(configuration: RulesClientConfiguration, code: string) {
  return invoke<RuleAuditEventSummary[]>(
    configuration,
    owner,
    definitionPath(code) + '/audit',
  );
}

/** Reads the backend-owned property catalogue for picker assistance only. */
export async function loadPropertyCatalogue(
  configuration: RulesClientConfiguration,
  propertyProviderCode: string,
): Promise<RulePropertyCatalogue> {
  const response = await invoke<{
    catalogue: RulePropertyCatalogue;
    authoring: RuleAuthoringContract;
  }>(
    configuration,
    owner,
    '/property-catalogues/' + encodeURIComponent(propertyProviderCode),
  );
  const catalogue = response?.catalogue,
    authoring = response?.authoring;
  const safeCode = (value: unknown) =>
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(value) &&
    !['__proto__', 'prototype', 'constructor'].includes(value);
  if (
    !catalogue ||
    !Array.isArray(catalogue.properties) ||
    !catalogue.properties.every(
      (property: RulePropertyDescriptor) =>
        safeCode(property.code) &&
        ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'COLLECTION', 'OBJECT'].includes(
          property.dataType ?? '',
        ) &&
        Array.isArray(property.allowedOperators),
    ) ||
    !authoring ||
    authoring.contractVersion !== 1 ||
    !Array.isArray(authoring.groupOperators) ||
    !Array.isArray(authoring.inputQualities) ||
    !Array.isArray(authoring.missingValueBehaviors) ||
    !authoring.limits ||
    !Object.values(authoring.limits).every(
      (value) => Number.isSafeInteger(value) && value > 0 && value <= 10000,
    ) ||
    !authoring.operators ||
    !Object.entries(authoring.operators).every(
      ([code, operator]) =>
        safeCode(code) &&
        Array.isArray(operator.dataTypes) &&
        ['NONE', 'ONE', 'LIST', 'RANGE'].includes(operator.valueShape),
    ) ||
    !Array.isArray(authoring.outcomeTypes) ||
    !authoring.outcomeTypes.every(
      (outcome: RuleAuthoringContract['outcomeTypes'][number]) =>
        safeCode(outcome.code) &&
        Array.isArray(outcome.fields) &&
        outcome.fields.every(
          (field: RuleAuthoringContract['outcomeTypes'][number]['fields'][number]) =>
            safeCode(field.code) &&
            ['STRING', 'NUMBER', 'BOOLEAN'].includes(field.dataType),
        ),
    )
  )
    throw new Error(
      'The Rules authoring catalogue is incompatible. Refresh after the owner is available.',
    );
  if (
    catalogue.simulationInputPath !== undefined &&
    (!Array.isArray(catalogue.simulationInputPath) ||
      catalogue.simulationInputPath.length > 5 ||
      !catalogue.simulationInputPath.every(safeCode))
  )
    throw new Error('The simulation input contract is incompatible.');
  return { ...catalogue, authoring };
}

/** Reads bounded owner value choices; absence leaves a typed value field, never a fabricated choice. */
export function loadRulePropertyValues(
  configuration: RulesClientConfiguration,
  provider: string,
  property: string,
) {
  return invoke<
    readonly { readonly value: string | number | boolean; readonly label: string }[]
  >(
    configuration,
    owner,
    '/property-catalogues/' +
      encodeURIComponent(provider) +
      '/properties/' +
      encodeURIComponent(property) +
      '/values',
  );
}

/** Prepares a new editable version from the latest immutable published version. */
export function prepareRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  expectedDraftRevision?: number,
) {
  return invoke<RuleDefinitionSummary>(
    configuration,
    owner,
    definitionPath(code) + '/draft/prepare',
    { ...(expectedDraftRevision === undefined ? {} : { expectedDraftRevision }) },
  );
}

/** Saves only the definition document through the backend lifecycle owner. */
export function saveRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  definition: object,
  expectedDraftRevision?: number,
) {
  return invoke<RuleDefinitionSummary>(
    configuration,
    owner,
    definitionPath(code) + '/draft',
    {
      definition,
      ...(expectedDraftRevision === undefined ? {} : { expectedDraftRevision }),
    },
    'PATCH',
  );
}

/** Runs owner validation for the current draft. */
export function validateRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  expectedDraftRevision?: number,
) {
  return invoke<unknown>(
    configuration,
    owner,
    definitionPath(code) + '/draft/validate',
    { ...(expectedDraftRevision === undefined ? {} : { expectedDraftRevision }) },
  );
}

/** Simulates the draft against explicit non-authoritative input. */
export function simulateRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  input: object,
  expectedDraftRevision?: number,
) {
  return invoke<RuleSimulationResult>(
    configuration,
    owner,
    definitionPath(code) + '/draft/simulate',
    {
      input,
      ...(expectedDraftRevision === undefined ? {} : { expectedDraftRevision }),
    },
  );
}

/** Submits the validated and simulated draft to Process-owned maker-checker. */
export function submitRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  expectedDraftRevision?: number,
) {
  return invoke<RuleDefinitionSummary['approval']>(
    configuration,
    owner,
    definitionPath(code) + '/draft/submit',
    { ...(expectedDraftRevision === undefined ? {} : { expectedDraftRevision }) },
  );
}

/** Reads authorized score-band sets from the Rules API owner. */
export function loadScoreBandSets(configuration: RulesClientConfiguration) {
  return invoke<ScoreBandSetSummary[]>(configuration, owner, '/band-sets');
}

/** Reads one score-band set without creating a browser-side policy registry. */
export function loadScoreBandSet(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<ScoreBandSetSummary>(configuration, owner, bandSetPath(code));
}

/** Saves score-band draft details through the Rules API owner. */
export function loadScoreBandVersions(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<(ScoreBandSetSummary & { version: number })[]>(
    configuration,
    owner,
    bandSetPath(code) + '/versions',
  );
}

export function saveScoreBandDraft(
  configuration: RulesClientConfiguration,
  code: string,
  draft: {
    readonly bands: readonly ScoreBandSummary[];
    readonly gapBehavior?: string;
    readonly expectedDraftRevision?: number;
  },
) {
  return invoke<ScoreBandSetSummary>(
    configuration,
    owner,
    bandSetPath(code) + '/draft',
    draft,
    'PATCH',
  );
}

/** Explicit band lifecycle commands use the reviewed draft revision. */
export function prepareScoreBandDraft(
  configuration: RulesClientConfiguration,
  code: string,
  expectedDraftRevision: number,
) {
  return invoke<unknown>(configuration, owner, bandSetPath(code) + '/draft/prepare', {
    expectedDraftRevision,
  });
}
export function publishScoreBandDraft(
  configuration: RulesClientConfiguration,
  code: string,
  expectedDraftRevision: number,
) {
  return invoke<unknown>(configuration, owner, bandSetPath(code) + '/draft/publish', {
    expectedDraftRevision,
  });
}
