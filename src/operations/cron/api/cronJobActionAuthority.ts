import type { AxisNavigationItem } from '../../../bootstrap/publicBootstrap';
import type { CronJobLifecycleAction } from './cronJobClient';

/** Intersects permission-filtered owner declarations with the existing fixed Cron transports. It grants no backend access. */
export function qualifiedCronJobAction(
  navigation: AxisNavigationItem | undefined,
  action: CronJobLifecycleAction,
) {
  if (
    !navigation ||
    navigation.moduleName !== 'cronjob' ||
    navigation.featureState !== 'ACTIVE' ||
    !['UP', 'DEGRADED'].includes(navigation.availability)
  )
    return undefined;
  const matches = (navigation.lifecycleActions ?? []).filter(
    (candidate) => candidate.id === action,
  );
  if (matches.length !== 1) return undefined;
  const candidate = matches[0]!;
  return candidate.featureState === 'ACTIVE' &&
    candidate.ownerModule === 'cronjob' &&
    candidate.httpMethod === 'POST' &&
    candidate.permission === 'cronjob.lifecycle.manage' &&
    candidate.operationRoute === `/job/${action}/:jobCode`
    ? candidate
    : undefined;
}
