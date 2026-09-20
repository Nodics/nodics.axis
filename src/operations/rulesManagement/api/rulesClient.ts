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

const owner = 'rulesApi';
const definitionPath = (code: string) => '/definitions/' + encodeURIComponent(code);

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
