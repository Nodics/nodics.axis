import type { NavigationCompositionAction } from './api/navigationCompositionClient';

export interface NavigationCompositionOutcome {
  readonly message: string;
  readonly severity: 'success' | 'warning';
  readonly issues?: readonly string[];
  readonly snapshot?: {
    readonly json: string;
    readonly filename: string;
    readonly version: number;
    readonly itemCount: number;
    readonly exportedAt: string;
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'Navigation composition returned an invalid result. Inspect the owner state before repeating a lifecycle action.',
    );
  }
  return value as Record<string, unknown>;
}

function version(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function checksum(value: unknown): boolean {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/** Interprets native receipts without inferring publication from a successful read or dry run. */
export function navigationCompositionOutcome(
  action: NavigationCompositionAction,
  value: unknown,
  scope: {
    readonly tenantCode: string;
    readonly enterpriseCode: string;
    readonly projectCode: string;
  },
): NavigationCompositionOutcome {
  const result = record(value);
  if (action === 'export') {
    const composition = record(result.composition);
    const actualScope = record(composition.scope);
    if (
      result.exportFormatVersion !== 0 ||
      typeof result.exportedAt !== 'string' ||
      !Number.isFinite(Date.parse(result.exportedAt)) ||
      composition.contractVersion !== 0 ||
      !version(composition.version) ||
      !checksum(composition.checksum) ||
      composition.lifecycleState !== 'PUBLISHED' ||
      !Array.isArray(composition.navigation) ||
      !Array.isArray(composition.groups) ||
      actualScope.tenantCode !== scope.tenantCode ||
      actualScope.enterpriseCode !== scope.enterpriseCode ||
      (actualScope.projectCode !== undefined &&
        actualScope.projectCode !== scope.projectCode)
    )
      throw new Error(
        'The exported snapshot does not match the current workspace contract and scope. Refresh availability before exporting again.',
      );
    const json = JSON.stringify(value, null, 2) + '\n';
    if (new TextEncoder().encode(json).length > 5 * 1024 * 1024) {
      throw new Error(
        'The exported snapshot exceeds the supported browser download size.',
      );
    }
    return {
      severity: 'success',
      message: 'The effective navigation snapshot is ready to download.',
      snapshot: {
        json,
        filename: `axis-navigation-v${String(composition.version)}-${String(composition.checksum).slice(0, 12)}.json`,
        version: composition.version,
        itemCount: composition.navigation.length,
        exportedAt: result.exportedAt,
      },
    };
  }
  if (action === 'preview') {
    const validation = record(result.validation);
    const impact = record(result.impact);
    if (
      result.mode !== 'DRY_RUN_ONLY' ||
      result.persisted !== false ||
      result.published !== false ||
      typeof validation.valid !== 'boolean' ||
      !Array.isArray(validation.issues) ||
      !version(impact.currentItemCount) ||
      !version(impact.candidateItemCount)
    ) {
      throw new Error('Navigation preview returned an invalid dry-run result.');
    }
    const issues = validation.issues.slice(0, 20).map((item) => {
      const issue = record(item);
      if (
        typeof issue.message !== 'string' ||
        !issue.message.trim() ||
        issue.message.length > 1000
      ) {
        throw new Error('Navigation preview returned an invalid validation issue.');
      }
      // Coordinates distinguish repeated diagnostics; they remain escaped text.
      const route =
        typeof issue.route === 'string' && issue.route.length <= 500
          ? ` Route: ${issue.route}.`
          : '';
      const itemLabel =
        typeof issue.item === 'string' && issue.item.length <= 250
          ? ` Item: ${issue.item}.`
          : '';
      return issue.message + route + itemLabel;
    });
    return {
      severity: validation.valid ? 'success' : 'warning',
      message: validation.valid
        ? `Preview passed for ${String(impact.candidateItemCount)} navigation items. Nothing was saved or published.`
        : `Preview found ${String(validation.issues.length)} validation issues. Nothing was saved or published.`,
      issues,
    };
  }
  const expected = {
    createDraft: 'DRAFT',
    submit: 'SUBMITTED',
    approve: 'APPROVED',
    publish: 'PUBLISHED',
    rollback: 'PUBLISHED',
  } as const;
  if (
    result.lifecycleState !== expected[action] ||
    !version(result.version) ||
    !checksum(result.checksum)
  ) {
    throw new Error(
      'The lifecycle response could not confirm completion. Inspect the owner state before repeating the action.',
    );
  }
  const messages = {
    createDraft: 'Draft created. It must be submitted and approved before publication.',
    submit: 'Draft submitted for review.',
    approve: 'Draft approved. Publication is a separate action.',
    publish:
      'Navigation published. Refresh Axis availability to load the effective composition.',
    rollback:
      'Navigation rollback confirmed. Refresh Axis availability to load the effective composition.',
  } as const;
  return { severity: 'success', message: messages[action] };
}
