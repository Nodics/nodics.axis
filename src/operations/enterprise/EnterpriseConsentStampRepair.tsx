/** Separate Profile stamp-completion task; authority, qualification and subject eligibility remain backend-owned. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import {
  inspectConsentStamps,
  repairConsentStamps,
  type ConsentStampCommand,
  type ConsentStampInspection,
  type ConsentStampPresentation,
} from './api/enterpriseConsentStampClient';
import { EnterpriseAdministrationTaskRenderer } from './EnterpriseAdministrationTaskRenderer';

/** Inspects on explicit request only. An uncertain writer freezes the exact operation until another reviewed recovery or context change. */
export function EnterpriseConsentStampRepair({
  configuration,
  target,
  title,
}: {
  readonly configuration: OperationalOwnerConfiguration;
  readonly target: string;
  readonly title: string;
}) {
  const context = useMemo(() => ({ configuration, target }), [configuration, target]);
  const [snapshot, setSnapshot] = useState<{
    context: typeof context;
    inspection: ConsentStampInspection;
  }>();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{
    context: typeof context;
    body: ConsentStampCommand;
    subjects: ConsentStampInspection['grants'];
  }>();
  const [busy, setBusy] = useState(false),
    [readRequired, setReadRequired] = useState(true);
  const epoch = useRef(0),
    inFlight = useRef(false);
  const inspection = snapshot?.context === context ? snapshot.inspection : undefined;
  const [copy, setCopy] = useState<{
    context: typeof context;
    presentation: ConsentStampPresentation;
  }>();
  const [initialError, setInitialError] = useState('');
  const presentation = copy?.context === context ? copy.presentation : undefined;
  const retained = pending?.context === context ? pending : undefined;
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setSnapshot(undefined);
    setCopy(undefined);
    setInitialError('');
    setPending(undefined);
    setSelected([]);
    setBusy(false);
    setReadRequired(true);
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
  }, [context]);
  const inspect = async (): Promise<'INSPECTED' | 'UNCONFIRMED'> => {
    if (inFlight.current) return 'UNCONFIRMED';
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setReadRequired(true);
    setSnapshot(undefined);
    setInitialError('');
    try {
      const value = await inspectConsentStamps(configuration, target);
      if (attempt !== epoch.current) return 'UNCONFIRMED';
      setSnapshot({ context, inspection: value });
      setCopy({ context, presentation: value.presentation });
      setSelected([]);
      setReadRequired(false);
      return 'INSPECTED';
    } catch {
      if (attempt === epoch.current)
        setInitialError('The owner request could not be confirmed.');
      return 'UNCONFIRMED';
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const prepared = useMemo(() => {
    if (!inspection || !presentation || (!retained && inspection.grants.length === 0))
      return undefined;
    const subjects =
      retained?.subjects ||
      inspection.grants.filter((row) => selected.includes(row.code));
    const body: ConsentStampCommand = retained?.body || {
      enterpriseCode: target,
      revision: inspection.revision,
      operationId: crypto.randomUUID().replaceAll('-', ''),
      grantCodes: subjects.map((row) => row.code),
    };
    const enabled =
      !busy &&
      !readRequired &&
      body.revision > 0 &&
      body.revision < 2147483647 &&
      body.grantCodes.length > 0 &&
      [body.revision, body.revision + 1].includes(inspection.revision) &&
      subjects.every((row) =>
        inspection.grants.some(
          (current) =>
            current.code === row.code &&
            current.revision === row.revision &&
            current.status === row.status &&
            current.canRepair === true,
        ),
      );
    return {
      body,
      subjects,
      command: {
        code: body.operationId,
        label: presentation.confirmLabel,
        enabled,
        summary: [
          {
            label: presentation.title,
            value: 'ENTERPRISE_ADMINISTRATION_STAMP_REPAIR',
          },
          { label: presentation.reviewTitle, value: JSON.stringify(body) },
        ],
      },
    };
  }, [inspection, retained, selected, target, busy, readRequired, presentation]);
  const commands = useMemo(() => (prepared ? [prepared.command] : []), [prepared]);
  const execute = async (): Promise<'CONFIRMED' | 'UNCONFIRMED'> => {
    if (!prepared?.command.enabled || !inspection || inFlight.current)
      return 'UNCONFIRMED';
    const attempt = epoch.current,
      command = prepared;
    inFlight.current = true;
    setBusy(true);
    setPending({ context, body: command.body, subjects: command.subjects });
    try {
      await repairConsentStamps(
        configuration,
        inspection,
        command.body,
        command.subjects,
      );
      if (attempt !== epoch.current) return 'UNCONFIRMED';
      setPending(undefined);
      return 'CONFIRMED';
    } catch {
      return 'UNCONFIRMED';
    } finally {
      if (attempt === epoch.current) {
        setReadRequired(true);
        setSnapshot(undefined);
        setSelected([]);
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
      {!presentation && (
        <>
          <Typography variant="h6">{title}</Typography>
          <Tooltip title="Inspect">
            <span>
              <IconButton
                aria-label="Inspect"
                disabled={busy}
                onClick={() => void inspect()}
              >
                <ShellIcon name="refresh" />
              </IconButton>
            </span>
          </Tooltip>
          {initialError && <Alert severity="error">{initialError}</Alert>}
        </>
      )}
      {inspection?.grants.map((row) => (
        <FormControlLabel
          key={row.code}
          label={`${presentation?.grantLabel}: ${row.code} / ${presentation?.revisionLabel}: ${row.revision} / ${presentation?.statusLabel}: ${row.status}`}
          control={
            <Checkbox
              checked={
                retained
                  ? retained.body.grantCodes.includes(row.code)
                  : selected.includes(row.code)
              }
              disabled={busy || readRequired || !!retained || row.canRepair !== true}
              onChange={(event) =>
                setSelected((values) =>
                  event.target.checked
                    ? [...values, row.code]
                    : values.filter((code) => code !== row.code),
                )
              }
            />
          }
        />
      ))}
      {retained && (
        <Typography sx={{ fontFamily: 'monospace' }}>
          {JSON.stringify(retained.body)}
        </Typography>
      )}
      {presentation && (
        <EnterpriseAdministrationTaskRenderer
          context={context}
          presentation={presentation}
          commands={commands}
          inspect={inspect}
          execute={execute}
        />
      )}
    </Stack>
  );
}
