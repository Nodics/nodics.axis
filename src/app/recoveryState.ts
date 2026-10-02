export type RecoveryKind =
  | 'configuration'
  | 'profile'
  | 'backoffice'
  | 'cms'
  | 'contract'
  | 'module'
  | 'unauthorized'
  | 'offline'
  | 'unexpected';

export interface RecoveryState {
  readonly reconnecting?: boolean;
  readonly kind: RecoveryKind;
  readonly detail?: string;
  readonly correlationId?: string;
  readonly retryable: boolean;
}

interface RecoveryContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly action: string;
}

export interface RecoveryDetailContent {
  readonly message: string;
  readonly technicalDetail?: string;
}

const recoveryContent: Record<RecoveryKind, RecoveryContent> = {
  configuration: {
    eyebrow: 'Deployment configuration',
    title: 'Axis cannot start safely',
    description:
      'BackOffice deployment discovery and enterprise context must be valid before module discovery or authentication begins.',
    action: 'Retry configuration',
  },
  profile: {
    eyebrow: 'Identity service',
    title: 'Profile is unavailable',
    description:
      'Axis cannot authenticate people or validate their session while the Profile authority is unavailable.',
    action: 'Retry Profile',
  },
  backoffice: {
    eyebrow: 'Module discovery',
    title: 'BackOffice registry is unavailable',
    description:
      'The recovery workspace remains available, but Axis cannot discover authorized modules right now.',
    action: 'Retry discovery',
  },
  cms: {
    eyebrow: 'Content delivery',
    title: 'CMS content is unavailable',
    description:
      'Axis is using its static recovery experience because governed CMS presentation content could not be loaded.',
    action: 'Retry CMS',
  },
  contract: {
    eyebrow: 'Compatibility',
    title: 'This contract is not compatible',
    description:
      'The backend contract cannot be consumed safely by this Axis build. Upgrade or restore a supported contract.',
    action: 'Check again',
  },
  module: {
    eyebrow: 'Module capability',
    title: 'The requested module is unavailable',
    description:
      'Other authorized workspaces remain usable. This module can be retried when its observed service recovers.',
    action: 'Retry module',
  },
  unauthorized: {
    eyebrow: 'Access control',
    title: 'You do not have access',
    description:
      'The target module denied this operation. Axis cannot override backend permissions or tenant policy.',
    action: 'Return to workspace',
  },
  offline: {
    eyebrow: 'Network connection',
    title: 'Axis is offline',
    description:
      'Reconnect before continuing. Administrative data and mutations are not cached for offline execution.',
    action: 'Check connection',
  },
  unexpected: {
    eyebrow: 'Application recovery',
    title: 'This workspace could not be displayed',
    description:
      'Axis isolated an unexpected presentation failure. Other backend capabilities were not changed.',
    action: 'Retry workspace',
  },
};

export function getRecoveryContent(kind: RecoveryKind): RecoveryContent {
  return recoveryContent[kind];
}

function isNetworkFetchFailure(detail: string): boolean {
  const normalized = detail.trim().toLowerCase();
  return (
    normalized === 'failed to fetch' ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('network request failed')
  );
}

/** Both login renderers use the existing transport classification without changing auth decisions or retrying credentials. */
export function getSignInErrorMessage(detail?: string): string | undefined {
  if (!detail) return undefined;
  return isNetworkFetchFailure(detail)
    ? 'Sign-in is temporarily unavailable. Check your connection and try again when the service is available.'
    : detail;
}

function networkRecoveryMessage(kind: RecoveryKind): string {
  if (kind === 'backoffice') {
    return 'Axis could not reach the BackOffice registry. The backend may still be starting, or the service may be temporarily unavailable.';
  }
  if (kind === 'cms') {
    return 'Axis could not reach CMS content delivery. The backend may still be starting, or CMS may be temporarily unavailable.';
  }
  if (kind === 'profile') {
    return 'Axis could not reach Profile. Employee authentication may be temporarily unavailable while the backend starts.';
  }
  if (kind === 'configuration') {
    return 'Axis could not load its runtime configuration. Confirm the frontend configuration file is available and retry.';
  }
  if (kind === 'offline') {
    return 'Axis cannot reach the backend from this browser session. Check the network connection and retry.';
  }
  return 'Axis could not reach the required backend service. The service may still be starting, or the network may be temporarily unavailable.';
}

export function getRecoveryDetailContent(
  kind: RecoveryKind,
  detail?: string,
): RecoveryDetailContent | undefined {
  if (!detail) return undefined;
  if (isNetworkFetchFailure(detail)) {
    return {
      message: networkRecoveryMessage(kind),
      technicalDetail: detail,
    };
  }
  return { message: detail };
}
