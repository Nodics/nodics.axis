import { useQuery } from '@tanstack/react-query';

import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { loadRegistrationWorkspace } from '../operations/enterprise/registration/registrationClient';

/** Existing Axis route; an entry never accepts a caller-supplied destination. */
export const INVITED_EMPLOYEE_REGISTRATION_ROUTE = '/enterprise-access/register';

export interface InvitedEmployeeRegistrationEntry {
  readonly label: string;
}

/**
 * Public sign-in observes Profile's admitted workspace for its entry copy only.
 * A published availability flag grants nothing: current owner discovery may deny.
 * Keep the project public enterprise, retire replaced scopes, and issue no command.
 */
export function useInvitedEmployeeRegistrationEntry({
  runtime,
  profileBaseUrl,
  available,
  enabled,
  scope,
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly profileBaseUrl: string | undefined;
  readonly available: boolean;
  readonly enabled: boolean;
  readonly scope: string;
}): InvitedEmployeeRegistrationEntry | undefined {
  const admitted = available && enabled && Boolean(profileBaseUrl);
  const query = useQuery({
    queryKey: [
      'public-invited-registration-entry',
      runtime.projectCode,
      runtime.enterpriseCode,
      profileBaseUrl,
      scope,
      admitted,
    ],
    enabled: admitted,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      if (!profileBaseUrl) throw new Error('Profile is unavailable');
      const workspace = await loadRegistrationWorkspace(
        runtime,
        profileBaseUrl,
        signal,
      );
      return Object.freeze({ label: workspace.presentation.title });
    },
  });
  return admitted && query.isSuccess && !query.isFetching ? query.data : undefined;
}
