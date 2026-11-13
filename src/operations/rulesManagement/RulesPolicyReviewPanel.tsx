import { Alert, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { StructuredRuleEditor, StructuredScoreBands } from './StructuredRuleEditor';
import type { RulesClientConfiguration } from './api/rulesClient';
import { loadRulesReview, type RulesReviewIdentity } from './api/rulesReviewClient';

/** Private, permission-bound review of the exact frozen policy and band version. */
export function RulesPolicyReviewPanel({
  configuration,
  identity,
  privateScope,
}: {
  readonly configuration: RulesClientConfiguration;
  readonly identity: RulesReviewIdentity;
  readonly privateScope: string;
}) {
  const { format: t, formatError } = useAxisLocalization();
  const [inspect, setInspect] = useState(false);
  const query = useQuery({
    queryKey: [
      'rules-policy-review',
      privateScope,
      configuration.enterpriseCode,
      identity,
    ],
    queryFn: () => loadRulesReview(configuration, identity),
    enabled: inspect,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Stack spacing={2}>
      <Typography>
        {identity.ruleSetCode} · {t('rules.revision', 'Draft revision')}{' '}
        {identity.draftRevision}
      </Typography>
      <Button
        disabled={query.isFetching}
        onClick={() => {
          if (inspect) void query.refetch();
          else setInspect(true);
        }}
      >
        {t('rules.inspect-policy', 'Inspect saved policy')}
      </Button>
      {query.isFetching ? (
        <Typography role="status">{t('rules.loading', 'Loading…')}</Typography>
      ) : null}
      {query.isError ? (
        <Alert severity="error">
          {formatError(
            query.error,
            t(
              'common.request-unconfirmed',
              'The request could not be confirmed. Inspect the current state before another change.',
            ),
          )}
        </Alert>
      ) : null}
      {query.isSuccess && !query.isFetching ? (
        <>
          <Alert severity="info">
            {t(
              'rules.review-exact',
              'This is the exact saved revision awaiting your decision. The owner checks it again when you approve.',
            )}
          </Alert>
          <StructuredRuleEditor
            value={query.data.rule.definition ?? { groups: [] }}
            catalogue={query.data.catalogue}
            disabled
            onChange={() => undefined}
          />
          {query.data.band ? (
            <>
              <Typography>
                {t('rules.bands', 'Bands')} · {t('rules.version', 'Published version')}{' '}
                {query.data.band.version}
              </Typography>
              <StructuredScoreBands
                bands={query.data.band.bands ?? []}
                disabled
                onChange={() => undefined}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
