import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  loadContentDesignerDraftImage,
  type ContentDesignerClientConfiguration,
} from './api/contentDesignerClient';

interface Props {
  readonly cachePartition: string;
  readonly connection: AxisModuleConnection | undefined;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly mediaCode: string;
  readonly altText?: string | undefined;
}

export function ContentDesignerMediaPreview({
  cachePartition,
  connection,
  configuration,
  mediaCode,
  altText,
}: Props) {
  const [open, setOpen] = useState(false);
  const preview = useQuery({
    queryKey: ['designer-draft-image', cachePartition, connection?.endpoint, mediaCode],
    enabled: open && Boolean(connection),
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      loadContentDesignerDraftImage(connection!, configuration, mediaCode, signal),
  });
  const source = open ? preview.data : undefined;
  const attachImage = useCallback(
    (image: HTMLImageElement | null) => {
      if (!source || !image) return;
      const url = URL.createObjectURL(source);
      image.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [source],
  );

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="body2">Attached media · {mediaCode}</Typography>
      {connection ? (
        <Button onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide image' : 'Preview image'}
        </Button>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Image preview requires a connection to Staged Media.
        </Typography>
      )}
      {open && preview.isPending ? (
        <Typography variant="body2" role="status">
          Loading image…
        </Typography>
      ) : null}
      {open && preview.isError ? (
        <Alert severity="warning">{preview.error.message}</Alert>
      ) : null}
      {source ? (
        <Box
          component="img"
          ref={attachImage}
          alt={altText || 'Attached draft image'}
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 320,
            objectFit: 'contain',
          }}
        />
      ) : null}
    </Stack>
  );
}
