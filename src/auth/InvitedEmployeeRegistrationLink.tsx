import { Button } from '@mui/material';
import { useAxisLocalization } from '../localization/AxisLocalizationContext';
import { Link as RouterLink } from 'react-router';

import {
  INVITED_EMPLOYEE_REGISTRATION_ROUTE,
  type InvitedEmployeeRegistrationEntry,
} from './useInvitedEmployeeRegistrationEntry';

/** An admitted owner label opens the existing registration route; it never starts email or provisioning. */
export function InvitedEmployeeRegistrationLink({
  entry,
  pending = false,
}: {
  readonly entry?: InvitedEmployeeRegistrationEntry | undefined;
  readonly pending?: boolean;
}) {
  const { format } = useAxisLocalization();
  if (!entry || pending) return null;
  return (
    <Button
      component={RouterLink}
      to={INVITED_EMPLOYEE_REGISTRATION_ROUTE}
      variant="text"
      sx={{ alignSelf: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
    >
      {format('common.authentication.join-enterprise.source', '') === entry.label
        ? format('common.authentication.join-enterprise', entry.label)
        : entry.label}
    </Button>
  );
}
