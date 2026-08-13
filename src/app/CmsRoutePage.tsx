import { Box, Button, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { CmsPageRenderer } from '../cms/CmsPageRenderer';
import { resolveCmsPage } from '../cms/cmsClient';
import type { CmsResolvedPageContract } from '../cms/cmsContract';
import type { CmsRendererActions } from '../cms/renderers/shared/rendererTypes';
import { LoadingScreen } from './LoadingScreen';
import { RecoveryScreen } from './RecoveryScreen';

interface CmsRoutePageProps {
  readonly cmsBaseUrl: string;
  readonly enterpriseCode: string;
  readonly site: string;
  readonly locale: string;
  readonly channel: string;
  readonly path: string;
  readonly timeoutMs: number;
  readonly accessToken?: string | undefined;
  readonly actions?: CmsRendererActions | undefined;
  readonly onLogout?: (() => void) | undefined;
  readonly authenticationError?: string | undefined;
  readonly unavailableFallback?: ReactNode;
}

type PageState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly page: CmsResolvedPageContract }
  | { readonly status: 'failed'; readonly message: string };

export function CmsRoutePage(props: CmsRoutePageProps) {
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
      ...(props.accessToken ? { accessToken: props.accessToken } : {}),
    })
      .then((result) => {
        if (result.status !== 'resolved' || !result.page) {
          throw new Error('CMS returned no resolved page');
        }
        setState({ status: 'ready', page: result.page });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'failed',
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
    props.site,
    props.timeoutMs,
  ]);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'failed') {
    if (props.unavailableFallback) return props.unavailableFallback;
    return (
      <RecoveryScreen
        state={{ kind: 'cms', detail: state.message, retryable: true }}
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
