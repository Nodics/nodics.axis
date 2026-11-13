import {
  loadRuleDefinition,
  loadPropertyCatalogue,
  loadScoreBandVersions,
  type RulesClientConfiguration,
} from './rulesClient';

export interface RulesReviewIdentity {
  readonly ruleSetCode: string;
  readonly draftRevision: number;
  readonly instanceCode: string;
}
/** Rechecks the owner-held draft and its immutable simulated bands; Process context never supplies a policy body. */
export async function loadRulesReview(
  configuration: RulesClientConfiguration,
  identity: RulesReviewIdentity,
) {
  const rule = await loadRuleDefinition(configuration, identity.ruleSetCode);
  if (
    rule.code !== identity.ruleSetCode ||
    rule.status !== 'DRAFT' ||
    rule.draftRevision !== identity.draftRevision ||
    rule.approval?.status !== 'PENDING' ||
    rule.approval.processInstanceCode !== identity.instanceCode ||
    !rule.propertyProviderCode ||
    !rule.validation?.valid ||
    rule.lastSimulation?.draftRevision !== identity.draftRevision
  )
    throw new Error(
      'This Rules revision is no longer awaiting this decision. Refresh its owner evidence.',
    );
  const catalogue = await loadPropertyCatalogue(
    configuration,
    rule.propertyProviderCode,
  );
  const simulation = rule.lastSimulation;
  const versions = simulation.bandSetCode
    ? await loadScoreBandVersions(configuration, simulation.bandSetCode)
    : [];
  const matches = versions.filter((item) => item.version === simulation.bandSetVersion);
  if (simulation.bandSetCode && matches.length !== 1)
    throw new Error('The simulated score-band version is unavailable for review.');
  return { rule, catalogue, band: matches[0] };
}
