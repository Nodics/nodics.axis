import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
const keys: Readonly<Record<string, string>> = {
  'Continue review and publishing from the source workspace. Recorded history remains available here.':
    'guide.copy.e7455b33ea4f8117',
  'Resume the original failed operation. Its target receipt is retained; this does not activate another version.':
    'guide.copy.b5562386a8bfee2b',
  'The owner confirmed this restore was rejected before changing Online content. Retry restores the same predecessor after checking the current release again.':
    'guide.copy.f22a3e6be6a9bd6c',
  'Retry revalidates the original request. Normal review and approval remain required before activation.':
    'guide.copy.3a37763f25e601fe',
  'Restore the previous published version for this request. Restoration is blocked if another publication has replaced it.':
    'guide.copy.9387880d0bf13109',
  'No previous published version is retained for this request. Check current delivery from its working record.':
    'guide.copy.fe63ae393c9f2fd8',
  'A different version or no copy is currently deployed. Inspect current delivery in the source workspace; this historical request cannot replace it.':
    'guide.copy.cca3cd7d6abe9395',
  'Refresh Publishing and inspect the current Online release before restoring a version.':
    'guide.copy.39cf00f6bd4bcfb4',
  'Resume only this retained in-flight operation. Its original target identity remains unchanged.':
    'guide.copy.aafc0760ea25adf6',
  'Original operation evidence or its domain provider is unverified. Review the recorded history with the owning administrator; no recovery command is offered.':
    'guide.copy.a6f0dc448ce9c337',
  'Publication Requests': 'guide.copy.778e1248a2262660',
  Inspect: 'guide.copy.e0723a86a5b9408a',
  'Review the governed request that was created after setup, import, or content submission.':
    'guide.copy.b839c82763cc285b',
  'Look for source version, target site or application, requested operation, generated manifest, and workflow reference.':
    'guide.copy.5c1032b5f8f9c3bd',
  'Review approval queue': 'guide.copy.17523a28daa2f491',
  'Open manifests': 'guide.copy.3ddeafa483870bc4',
  'Staged-to-Online Operations': 'guide.copy.386bd22c01b23e3f',
  Verify: 'guide.copy.eea2745e2867a677',
  'Confirm whether the approved Staged content has moved the authoritative Online pointer.':
    'guide.copy.aabfd1b596e701b5',
  'Look for Online pointer state, target version, publication revision, deployment status, and browser verification result.':
    'guide.copy.2cfb82a6c32d447d',
  'View history': 'guide.copy.a5932bc4ce515954',
  'Inspect audit': 'guide.copy.b8e3db23f1af7029',
  'Publication Manifests': 'guide.copy.ea3ad18feaec77c1',
  Evidence: 'guide.copy.03867aea70acaf4c',
  'Inspect the generated publishing payload before or after approval so operators know exactly what can move Online.':
    'guide.copy.baae5995cb248346',
  'Look for source records, dependencies, target profile, release code, and generated hashes.':
    'guide.copy.58e0b8bc14da46f1',
  'View requests': 'guide.copy.47b9133042ef7669',
  'Check Online status': 'guide.copy.a0ced4e812cad24e',
  'Publishing History': 'guide.copy.09385f95b481dbb7',
  Receipts: 'guide.copy.60a627df404ab04f',
  'Use deployment receipts to understand what was published, rejected, retired, or rolled back over time.':
    'guide.copy.8a3cbe7afae5f258',
  'Look for deployment receipt, Online target version, completion time, reviewer, and rollback candidate.':
    'guide.copy.03c5f771850b6a0a',
  'Confirm Online state': 'guide.copy.efef40e4d5cd2bc9',
  'Publishing Audit': 'guide.copy.0f779dc654ff357c',
  Traceability: 'guide.copy.a14559df36aa03d3',
  'Use audit records when proving who requested, approved, rejected, retried, recovered, or retired a publication.':
    'guide.copy.553089815c5590f4',
  'Look for actor, decision, reason, correlation id, workflow reference, and affected publication code.':
    'guide.copy.eba4b6b342c0682c',
  'Scheduled Publications': 'guide.copy.f823e55825563e23',
  Planned: 'guide.copy.fb6f7c93e6bf3dfa',
  'Prepare future publications without bypassing approval, audit, or final Online verification.':
    'guide.copy.26ce995d94214dce',
  'Look for schedule, target version, approval state, owner, and safe withdrawal path before activation time.':
    'guide.copy.fd4feeec76b95394',
  'Review requests': 'guide.copy.a48df62f7f899a16',
  'Withdrawals & rollbacks': 'guide.copy.3d21c61ff63ce01a',
  'Online Publications': 'guide.copy.0f763d24584ac40f',
  Live: 'guide.copy.b64ac05f17e64d03',
  'Review what Online currently serves to Nexus, Agora, and other customer-facing channels.':
    'guide.copy.831119dc74d60f4e',
  'Look for live pointer, site or storefront, version, publication revision, and browser URL to verify.':
    'guide.copy.67689d480c3c3131',
  'Check status': 'guide.copy.69cd3590300a68c6',
  'Publication Dependencies': 'guide.copy.96dc2cd81fba6b0e',
  Readiness: 'guide.copy.d53d98c1774966ba',
  'Inspect upstream content, media, localization, and commerce dependencies before approving Online movement.':
    'guide.copy.26af7fb1225726bb',
  'Look for missing references, inactive media, localization gaps, incompatible versions, and blocked target schemas.':
    'guide.copy.6b983ecc58ecc209',
  'Failures & Recovery': 'guide.copy.49b166e0a8fc7da6',
  Recover: 'guide.copy.0c5327fd45c72552',
  'Recover failed publication operations with audit-first discipline instead of repeating actions blindly.':
    'guide.copy.923355aa1eb0dd67',
  'Look for failed action, retry count, compensation state, correlation id, and whether Online changed.':
    'guide.copy.ecca2c6acbd7a139',
  'Withdrawals & Rollbacks': 'guide.copy.0a58cee300b498c8',
  Reverse: 'guide.copy.fae1c6f105d6fca1',
  'Withdraw pending work or roll back approved Online movement through explicit evidence and review.':
    'guide.copy.9979b65fadce2a9f',
  'Look for current Online version, rollback candidate, business reason, requester, approver, and browser verification.':
    'guide.copy.d5ddb49f06f9cef0',
  'Publishing Configuration': 'guide.copy.77401754adfe29be',
  Governance: 'guide.copy.86f8a694159b712f',
  'Review the publication policy surface before changing operational behavior, approval gates, or target mappings.':
    'guide.copy.6cae01faf51a6c43',
  'Look for target profile, approval requirement, runtime role, schema ownership, and environment-specific constraints.':
    'guide.copy.73f853ec50e8b1f5',
  'Open Publishing': 'guide.copy.fff1a6802cf5dbff',
  'Module registry': 'guide.copy.57b1bc1be43ff057',
  'Publishing guide': 'guide.copy.74e6410548d4025d',
  'Prepare the content, inspect the saved version, review its Process decision, then verify the website and recorded Online receipt.':
    'guide.copy.dd33241313193303',
  'Source version': 'guide.copy.650334cdb673ee30',
  'Recorded target version': 'guide.copy.15708277177c449e',
  Website: 'guide.copy.b5a229ac8becc603',
  'Content catalog': 'guide.copy.2f5a4c89b0499f91',
  'Source record': 'guide.copy.812187a5a0643e7d',
  'Requested by': 'guide.copy.9199a054972b1489',
  'Revision {revision, number}': 'guide.copy.d656e7ca1b51d6a0',
  'version {version, number}': 'guide.copy.0f55c084a3f118d5',
  'revision {revision, number}': 'guide.copy.35486886ad42ae59',
  'Recorded event': 'guide.copy.cb6f77fc8ad9bc14',
  STAGED: 'guide.copy.e0e7d6b6ac59ac2c',
  VALIDATING: 'guide.copy.eb0027f902ec7548',
  VALIDATED: 'guide.copy.3dac322c8372666c',
  PENDING_APPROVAL: 'guide.copy.92716d7641edd835',
  APPROVED: 'guide.copy.f1995216dcfbca4e',
  ACTIVATING: 'guide.copy.1bc7b0a8c7b6ae95',
  ONLINE: 'guide.copy.ac7e24813998d31d',
  ROLLING_BACK: 'guide.copy.e68d04806422f2a3',
  ROLLED_BACK: 'guide.copy.efd8fe31e2330eb9',
  REJECTED: 'guide.copy.04cc0e71ffcffb52',
  FAILED: 'guide.copy.02bd349299173f7f',
  WITHDRAWN: 'guide.copy.130c31a7c228fe13',
  RETIRED: 'guide.copy.d1ca3344f05366aa',
};
export function usePublishingGuidanceCopy() {
  const { format } = useAxisLocalization();
  return (
    source: string,
    parameters: Readonly<Record<string, string | number | boolean>> = {},
  ): string =>
    keys[source]
      ? format(
          'publishing.' + keys[source],
          /^[A-Z_]+$/.test(source) ? source.replaceAll('_', ' ') : source,
          parameters,
        )
      : source;
}
