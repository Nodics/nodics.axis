/** @file Enterprise retention metadata review, separate from transcript access and destructive operations. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import { CopilotRetentionPanel } from './CopilotRetentionPanel';
import {
  getLifecyclePreview,
  type parseLifecycleCapability,
  type parseLifecyclePreview,
} from './api/copilotLifecycleClient';

/** Loads only on explicit inspection and aborts on closing or scope unmount. */
export function CopilotLifecycleDialog({
  configuration,
  copy,
  onClose,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly copy: NonNullable<ReturnType<typeof parseLifecycleCapability>>;
  readonly onClose: () => void;
}) {
  const [result, setResult] = useState<ReturnType<typeof parseLifecyclePreview>>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  /** Discards prior evidence before each bounded read. */
  function load(page: number) {
    const controller = new AbortController();
    pending.current = controller;
    setResult(undefined);
    setSelected(undefined);
    setBusy(true);
    setFailed(false);
    void getLifecyclePreview(configuration, page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
  }
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="retention-title"
    >
      <DialogTitle id="retention-title">{copy.title}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          {copy.notice}
        </Alert>
        {!result ? (
          <Button disabled={busy} onClick={() => load(1)}>
            {copy.inspect}
          </Button>
        ) : (
          <>
            <Typography variant="body2">
              {copy.cutoff}: {new Date(result.cutoff).toLocaleString()}
            </Typography>
            {!result.items.length ? (
              <Typography>{copy.empty}</Typography>
            ) : (
              <List>
                {result.items.map((item) => (
                  <ListItem
                    key={item.code}
                    divider
                    sx={{ overflowWrap: 'anywhere', flexWrap: 'wrap', gap: 1 }}
                  >
                    <ListItemText primary={item.code} secondary={copy[item.state]} />
                    {copy.execution ? (
                      <Button onClick={() => setSelected(item.code)}>
                        {copy.execution.presentation.open}
                      </Button>
                    ) : null}
                  </ListItem>
                ))}
              </List>
            )}
            <Button
              disabled={busy || result.page <= 1}
              onClick={() => load(result.page - 1)}
            >
              {copy.previous}
            </Button>
            <Button
              disabled={busy || !result.mayHaveMore || result.page >= 1000}
              onClick={() => load(result.page + 1)}
            >
              {copy.next}
            </Button>
          </>
        )}
        {failed ? <Alert severity="warning">{copy.failure}</Alert> : null}
        {selected && copy.execution ? (
          <CopilotRetentionPanel
            key={selected}
            configuration={configuration}
            conversationCode={selected}
            canClose={
              result?.items.find((item) => item.code === selected)?.canClose === true
            }
            canBegin={
              result?.items.find((item) => item.code === selected)?.state ===
              'EXPIRED_REVIEW_REQUIRED'
            }
            capability={copy.execution}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
