import { useContentDesignerCopy } from './contentDesignerCopy';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  listContentDesignerDraftImages,
  type ContentDesignerClientConfiguration,
} from './api/contentDesignerClient';

interface Props {
  readonly cachePartition: string;
  readonly connection: AxisModuleConnection;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly disabled: boolean;
  readonly excludedCodes: readonly string[];
  readonly replacing?: boolean;
  readonly onChoose: (code: string, altText: string) => void;
}

export function ContentDesignerImagePicker({
  cachePartition,
  connection,
  configuration,
  disabled,
  excludedCodes,
  replacing = false,
  onChoose,
}: Props) {
  const { text, formatError, format } = useContentDesignerCopy();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [choice, setChoice] = useState('');
  const [altText, setAltText] = useState('');
  const images = useQuery({
    enabled: open && !disabled,
    queryKey: [
      'designer-draft-image-options',
      cachePartition,
      connection.endpoint,
      page,
    ],
    queryFn: ({ signal }) =>
      listContentDesignerDraftImages(connection, configuration, page, signal),
    retry: false,
  });
  if (!open) {
    return (
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {text(replacing ? 'Replace image' : 'Attach image')}
      </Button>
    );
  }
  const options =
    images.data?.items.filter(({ code }) => !excludedCodes.includes(code)) ?? [];
  const close = () => {
    setChoice('');
    setAltText('');
    setOpen(false);
  };
  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        {text(
          'Choose a ready image from this enterprise’s Staged Media. Save the page to keep the change.',
        )}
      </Typography>
      {images.isError ? (
        <Alert severity="warning">
          {formatError(
            images.error,
            format(
              'common.request-unconfirmed',
              'The request could not be confirmed. Inspect the current state before another change.',
            ),
          )}
        </Alert>
      ) : null}
      {images.isSuccess && !options.length ? (
        <Typography variant="body2">
          {text('No other eligible images on this page.')}
        </Typography>
      ) : null}
      <TextField
        select
        size="small"
        label={text('Staged image')}
        disabled={disabled || !options.length}
        value={options.some(({ code }) => code === choice) ? choice : ''}
        onChange={(event) => setChoice(event.target.value)}
      >
        {options.map(({ code, fileName }) => (
          <MenuItem key={code} value={code}>
            {fileName} · {code}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        label={text('Alternative text')}
        helperText={text('Describe the image for people using a screen reader.')}
        disabled={disabled}
        value={altText}
        onChange={(event) => setAltText(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 512 } }}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          disabled={disabled || !options.some(({ code }) => code === choice)}
          onClick={() => {
            onChoose(choice, altText.trim());
            close();
          }}
        >
          {text(replacing ? 'Use replacement' : 'Use image')}
        </Button>
        <Button onClick={close}>{text('Cancel')}</Button>
        {page > 1 ? (
          <Button disabled={disabled} onClick={() => setPage(page - 1)}>
            {text('Previous images')}
          </Button>
        ) : null}
        {images.data?.hasMore ? (
          <Button disabled={disabled} onClick={() => setPage(page + 1)}>
            {text('More images')}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
