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
}

export interface RulePropertyDescriptor {
  readonly code: string;
  readonly label?: string | { readonly en?: string };
  readonly valueType?: string;
  readonly supportsFallback?: boolean;
  readonly allowedValues?: readonly unknown[];
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
}

export interface ScoreBandSummary {
  readonly code: string;
  readonly minScore?: number;
  readonly maxScore?: number | null;
  readonly outcome?: Record<string, unknown>;
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
export function loadPropertyCatalogue(
  configuration: RulesClientConfiguration,
  propertyProviderCode: string,
) {
  return invoke<RulePropertyCatalogue>(
    configuration,
    owner,
    '/property-catalogues/' + encodeURIComponent(propertyProviderCode),
  );
}

/** Prepares a new editable version from the latest immutable published version. */
export function prepareRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<RuleDefinitionSummary>(
    configuration,
    owner,
    definitionPath(code) + '/draft/prepare',
    {},
  );
}

/** Saves only the definition document through the backend lifecycle owner. */
export function saveRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  definition: object,
) {
  return invoke<RuleDefinitionSummary>(
    configuration,
    owner,
    definitionPath(code) + '/draft',
    { definition },
    'PATCH',
  );
}

/** Runs owner validation for the current draft. */
export function validateRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
) {
  return invoke<unknown>(
    configuration,
    owner,
    definitionPath(code) + '/draft/validate',
    {},
  );
}

/** Simulates the draft against explicit non-authoritative input. */
export function simulateRuleDraft(
  configuration: RulesClientConfiguration,
  code: string,
  input: object,
) {
  return invoke<RuleSimulationResult>(
    configuration,
    owner,
    definitionPath(code) + '/draft/simulate',
    { input },
  );
}

/** Submits the validated and simulated draft to Process-owned maker-checker. */
export function submitRuleDraft(configuration: RulesClientConfiguration, code: string) {
  return invoke<RuleDefinitionSummary['approval']>(
    configuration,
    owner,
    definitionPath(code) + '/draft/submit',
    {},
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
export function saveScoreBandDraft(
  configuration: RulesClientConfiguration,
  code: string,
  draft: { readonly bands: readonly ScoreBandSummary[]; readonly gapBehavior?: string },
) {
  return invoke<ScoreBandSetSummary>(
    configuration,
    owner,
    bandSetPath(code) + '/draft',
    draft,
    'PATCH',
  );
}
