import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { MediaStoragePolicyClientConfiguration } from '../api/mediaStoragePolicyClient';
import {
  inspectMediaImage,
  prepareMediaImage,
  uploadPreparedMediaImage,
  type ConfirmedMediaImage,
  type MediaImageIntakeDefinition,
  type PreparedMediaImage,
} from '../api/mediaImageIntakeClient';

interface Props {
  readonly source: AxisModuleConnection;
  readonly configuration: MediaStoragePolicyClientConfiguration;
  readonly definition: MediaImageIntakeDefinition;
  readonly target: Readonly<{ moduleName: string; schemaName: string }>;
  readonly disabled: boolean;
  readonly onApply: (image: ConfirmedMediaImage) => void;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onSelectionChange: (selected: boolean) => void;
}
type Phase =
  | 'SELECT'
  | 'CHECKING'
  | 'REVIEW'
  | 'UPLOADING'
  | 'UNCERTAIN'
  | 'INSPECTING'
  | 'CONFIRMED'
  | 'APPLIED';

/** Media-owned file qualification, one dispatch and explicit draft association. Remount on private owner scope changes. */
export function MediaImageIntakePanel(props: Props) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [prepared, setPrepared] = useState<PreparedMediaImage>();
  const [phase, setPhase] = useState<Phase>('SELECT');
  const [failed, setFailed] = useState(false);
  const live = useRef(true),
    locked = useRef(false),
    dispatched = useRef(false);
  const copy = props.definition.presentation;
  const { onBusyChange, onSelectionChange } = props;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const busy = ['CHECKING', 'UPLOADING', 'INSPECTING'].includes(phase);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    onSelectionChange(file !== undefined && phase !== 'APPLIED');
    return () => onSelectionChange(false);
  }, [file, phase, onSelectionChange]);
  const begin = (next: Phase) => {
    locked.current = true;
    setPhase(next);
    setFailed(false);
  };
  const review = async () => {
    if (!file || props.disabled || locked.current || dispatched.current) return;
    begin('CHECKING');
    try {
      const result = await prepareMediaImage(
        props.source,
        props.configuration,
        props.definition,
        file,
        props.target,
      );
      if (live.current) {
        setPrepared(result);
        setPhase('REVIEW');
      }
    } catch {
      if (live.current) {
        setFailed(true);
        setPhase('SELECT');
      }
    } finally {
      if (live.current) locked.current = false;
    }
  };
  const upload = async () => {
    if (
      !prepared ||
      phase !== 'REVIEW' ||
      props.disabled ||
      locked.current ||
      dispatched.current
    )
      return;
    dispatched.current = true;
    begin('UPLOADING');
    try {
      await uploadPreparedMediaImage(props.source, props.configuration, prepared);
      if (live.current) setPhase('CONFIRMED');
    } catch {
      if (live.current) setPhase('UNCERTAIN');
    } finally {
      if (live.current) locked.current = false;
    }
  };
  const inspect = async () => {
    if (!prepared || phase !== 'UNCERTAIN' || props.disabled || locked.current) return;
    begin('INSPECTING');
    try {
      const result = await inspectMediaImage(
        props.source,
        props.configuration,
        prepared,
      );
      if (live.current) setPhase(result === 'CONFIRMED' ? 'CONFIRMED' : 'UNCERTAIN');
    } catch {
      if (live.current) setPhase('UNCERTAIN');
    } finally {
      if (live.current) locked.current = false;
    }
  };
  return (
    <Stack spacing={1.5}>
      <Typography component="h3" variant="subtitle1">
        {copy.title}
      </Typography>
      {failed ? <Alert severity="error">{copy.failed}</Alert> : null}
      <Typography variant="body2" color="text.secondary">
        {copy.review}
      </Typography>
      {file ? (
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          {file.name} · {file.size.toLocaleString()} B
        </Typography>
      ) : null}
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt={file?.name ?? ''}
          sx={{
            display: 'block',
            maxHeight: 200,
            maxWidth: '100%',
            objectFit: 'contain',
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        />
      ) : null}
      {prepared ? (
        <Box>
          <Typography>{prepared.purpose}</Typography>
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {copy.reference}: {prepared.descriptor.mediaCode}
          </Typography>
        </Box>
      ) : null}
      {phase === 'UNCERTAIN' || phase === 'INSPECTING' ? (
        <Alert severity="warning">{copy.uncertain}</Alert>
      ) : null}
      {phase === 'CONFIRMED' ? (
        <Alert severity="success">{copy.confirmed}</Alert>
      ) : null}
      {phase === 'APPLIED' ? <Alert severity="info">{copy.applied}</Alert> : null}
      {busy ? (
        <Typography role="status">
          {phase === 'CHECKING'
            ? copy.checking
            : phase === 'UPLOADING'
              ? copy.uploading
              : copy.inspecting}
        </Typography>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ flexWrap: 'wrap' }}
      >
        {!dispatched.current || phase === 'APPLIED' ? (
          <Button
            component="label"
            variant="outlined"
            disabled={props.disabled || busy}
          >
            {file ? copy.clear : copy.choose}
            <input
              hidden
              type="file"
              accept="image/*"
              disabled={props.disabled || busy}
              onChange={(event) => {
                if (
                  props.disabled ||
                  (phase !== 'APPLIED' && (locked.current || dispatched.current))
                )
                  return;
                dispatched.current = false;
                locked.current = false;
                setFile(event.target.files?.[0]);
                setPrepared(undefined);
                setPhase('SELECT');
                setFailed(false);
                event.target.value = '';
              }}
            />
          </Button>
        ) : null}
        {file && phase === 'SELECT' ? (
          <Button disabled={props.disabled || busy} onClick={() => void review()}>
            {copy.check}
          </Button>
        ) : null}
        {phase === 'REVIEW' ? (
          <Button
            variant="contained"
            disabled={props.disabled || busy}
            onClick={() => void upload()}
          >
            {copy.upload}
          </Button>
        ) : null}
        {phase === 'UNCERTAIN' ? (
          <Button disabled={props.disabled || busy} onClick={() => void inspect()}>
            {copy.inspect}
          </Button>
        ) : null}
        {phase === 'CONFIRMED' ? (
          <Button
            variant="contained"
            disabled={props.disabled || busy}
            onClick={() => {
              if (
                !live.current ||
                locked.current ||
                props.disabled ||
                !prepared ||
                phase !== 'CONFIRMED'
              )
                return;
              locked.current = true;
              props.onApply({
                code: prepared.descriptor.mediaCode,
                name: prepared.descriptor.name,
              });
              setPhase('APPLIED');
            }}
          >
            {copy.apply}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
