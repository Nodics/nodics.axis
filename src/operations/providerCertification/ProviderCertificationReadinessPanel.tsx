import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

import {
  commerceProviderReadiness,
  type CommerceProviderDeclaration,
} from './providerCertificationReadiness';

interface ProviderCertificationReadinessPanelProps {
  readonly declarations: readonly CommerceProviderDeclaration[];
}

/**
 * Displays Commerce provider certification readiness without certifying any
 * provider in the browser. Payment, carrier, warehouse and POS certification
 * remain backend/operator evidence decisions.
 */
export function ProviderCertificationReadinessPanel(
  props: ProviderCertificationReadinessPanelProps,
) {
  const readiness = commerceProviderReadiness(props.declarations);
  return (
    <Paper component="section" sx={{ p: 2 }} variant="outlined">
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography component="h2" variant="h6">
            Commerce Provider Certification
          </Typography>
          <Typography color="text.secondary">
            Review payment, carrier, warehouse and POS certification evidence before
            enabling live commerce operations.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          {readiness.map((item) => (
            <Paper
              component="article"
              key={item.domain}
              sx={{ minWidth: 220, p: 1.5 }}
              variant="outlined"
            >
              <Stack spacing={1}>
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {item.label}
                </Typography>
                <Chip
                  color={item.liveCertified ? 'success' : 'warning'}
                  label={item.state}
                  size="small"
                />
                <Typography color="text.secondary" variant="body2">
                  {item.operatorMessage}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  {item.evidenceSummary}
                </Typography>
                {item.missing.length ? (
                  <Typography variant="caption">
                    Missing: {item.missing.join(', ')}
                  </Typography>
                ) : null}
                <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
                  {item.cutoverChecklist.map((check) => (
                    <li key={check}>
                      <Typography color="text.secondary" variant="caption">
                        {check}
                      </Typography>
                    </li>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
        <Alert severity="info">
          Sandbox or offline conformance is not live certification. Axis shows evidence
          state only; backend provider declarations, named certification owner,
          certification timestamp and production-traffic approval remain authoritative.
        </Alert>
      </Stack>
    </Paper>
  );
}
