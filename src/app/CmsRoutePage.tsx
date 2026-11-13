import { Box, Button, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { CmsPageRenderer } from '../cms/CmsPageRenderer';
import { resolveCmsPage } from '../cms/cmsClient';
import type { CmsResolvedPageContract } from '../cms/cmsContract';
import type { CmsRendererActions } from '../cms/renderers/shared/rendererTypes';
import { LoadingScreen } from './LoadingScreen';
import { RecoveryScreen } from './RecoveryScreen';

interface CmsRoutePageProps {
  readonly cmsBaseUrl: string;
  readonly embedded?: boolean;
  readonly enterpriseCode: string;
  readonly site: string;
  readonly locale: string;
  readonly channel: string;
  readonly path: string;
  readonly timeoutMs: number;
  readonly accessToken?: string | undefined;
  readonly sessionGeneration?: number | undefined;
  readonly actions?: CmsRendererActions | undefined;
  readonly onLogout?: (() => void) | undefined;
  readonly authenticationError?: string | undefined;
  readonly unavailableFallback?: ReactNode;
  readonly requireExactDelivery?: boolean;
}

type PageState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly page: CmsResolvedPageContract;
      readonly scope: object;
    }
  | { readonly status: 'failed'; readonly message: string; readonly scope: object };

export function CmsRoutePage(props: CmsRoutePageProps) {
  // In-memory delivery identity; no token is placed in storage, URLs or cache keys.
  const scope = useMemo(
    () =>
      Object.freeze({
        accessToken: props.accessToken,
        sessionGeneration: props.sessionGeneration,
        cmsBaseUrl: props.cmsBaseUrl,
        enterpriseCode: props.enterpriseCode,
        site: props.site,
        path: props.path,
        locale: props.locale,
        channel: props.channel,
        requireExactDelivery: props.requireExactDelivery,
      }),
    [
      props.accessToken,
      props.sessionGeneration,
      props.cmsBaseUrl,
      props.enterpriseCode,
      props.site,
      props.path,
      props.locale,
      props.channel,
      props.requireExactDelivery,
    ],
  );
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PageState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void resolveCmsPage({
      cmsBaseUrl: props.cmsBaseUrl,
      enterpriseCode: props.enterpriseCode,
      site: props.site,
      path: props.path,
      locale: props.locale,
      channel: props.channel,
      timeoutMs: props.timeoutMs,
      signal: controller.signal,
      sessionGeneration: props.sessionGeneration,
      ...(props.accessToken ? { accessToken: props.accessToken } : {}),
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.status !== 'resolved' || !result.page) {
          throw new Error('CMS returned no resolved page');
        }
        if (
          props.requireExactDelivery &&
          (result.page.path !== props.path ||
            result.page.site !== props.site ||
            result.page.locale !== props.locale ||
            result.page.channel !== props.channel)
        )
          throw new Error('CMS returned a different documentation topic');
        setState({ status: 'ready', page: result.page, scope });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'failed',
            scope,
            message:
              error instanceof Error ? error.message : 'CMS page delivery failed',
          });
        }
      });
    return () => controller.abort();
  }, [
    attempt,
    props.accessToken,
    props.channel,
    props.cmsBaseUrl,
    props.enterpriseCode,
    props.locale,
    props.path,
    props.requireExactDelivery,
    props.site,
    props.timeoutMs,
    props.sessionGeneration,
    scope,
  ]);

  if (state.status === 'loading' || state.scope !== scope)
    return props.embedded ? (
      <LoadingScreen embedded label="Loading page content" />
    ) : (
      <LoadingScreen />
    );
  if (state.status === 'failed') {
    if (props.unavailableFallback) return props.unavailableFallback;
    return (
      <RecoveryScreen
        embedded={props.embedded === true}
        state={{ kind: 'cms', detail: state.message, retryable: true }}
        onSignOut={props.onLogout ?? props.actions?.onEmployeeSignOut}
        authenticationError={props.authenticationError}
        onRetry={() => {
          setState({ status: 'loading' });
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  return (
    <Stack>
      {props.onLogout ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
          <Button onClick={props.onLogout}>Sign out</Button>
        </Box>
      ) : null}
      <CmsPageRenderer
        actions={{
          ...props.actions,
          ...(props.authenticationError
            ? { authenticationError: props.authenticationError }
            : {}),
        }}
        contract={state.page}
      />
    </Stack>
  );
}
