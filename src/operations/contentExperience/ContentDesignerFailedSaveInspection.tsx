import { Alert, Button, Stack, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  ContentDesignerRequestError,
  loadContentDesignerPage,
  type ContentDesignerClientConfiguration,
  type ContentDesignerDraft,
} from './api/contentDesignerClient';

interface Props {
  readonly connection: AxisModuleConnection | undefined;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly draft: ContentDesignerDraft;
  readonly enabled: boolean;
  readonly onMissingConfirmed: () => void;
}

/** A failed create is never replayed. Only the exact authorized owner not-found can release its hold. */
export function ContentDesignerFailedSaveInspection({
  connection,
  configuration,
  draft,
  enabled,
  onMissingConfirmed,
}: Props) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const inspection = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!connection || !enabled)
        throw new Error(
          'Restore this authoring scope before inspecting the saved result.',
        );
      try {
        return await loadContentDesignerPage(connection, configuration, {
          catalogCode: draft.catalogCode,
          siteCode: draft.siteCode,
          pageCode: draft.page.code,
        });
      } catch (error: unknown) {
        if (
          error instanceof ContentDesignerRequestError &&
          error.status === 404 &&
          error.ownerCode === 'ERR_CMS_00088'
        )
          return null;
        throw error;
      }
    },
    onSuccess: (value) => {
      if (value === null && active.current) onMissingConfirmed();
    },
  });
  return (
    <Stack spacing={1.5}>
      <Alert severity="warning">
        The save was not confirmed. Further commands are held. Inspect the exact saved
        result before deciding how to continue; this does not repeat the save.
      </Alert>
      <Typography>
        Page: {draft.page.name} · {draft.page.code}
      </Typography>
      <Button
        disabled={!enabled || !connection || inspection.isPending}
        onClick={() => inspection.mutate()}
      >
        Inspect saved page result
      </Button>
      {inspection.error instanceof Error ? (
        <Alert severity="warning">
          {inspection.error.message} The save hold remains in place.
        </Alert>
      ) : null}
      {inspection.data ? (
        <Alert severity="info">
          The owner confirms a saved page with {inspection.data.draft.sections.length}{' '}
          content blocks. Use “Open an existing page” above to inspect and continue this
          page. The new-page form remains held.
        </Alert>
      ) : null}
    </Stack>
  );
}
