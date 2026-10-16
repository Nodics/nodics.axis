/** Presentation-only administration review; Profile adapters retain DTO, authorization and command authority. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { BusinessAccessContract } from './api/businessAccessContract';

/** Presentation-only area selections; the Team adapter owns mutation DTO construction. */
export interface EnterpriseBusinessAccessSelection {
  readonly businessArea: string;
  readonly accessLevel: 'noAccess' | 'view' | 'edit' | 'fullControl';
}

/** Renders independent owner-defined business areas without deriving or granting permissions.
 * @param props Validated catalogue, scoped draft, and a controlled immutable change callback.
 * @returns Accessible area/level/scope rows; changing a row preserves every other selection.
 */
export function EnterpriseBusinessAccessTable({
  contract,
  selections,
  scope,
  onChange,
  disabled = false,
}: {
  readonly contract: BusinessAccessContract;
  readonly selections: readonly EnterpriseBusinessAccessSelection[];
  readonly scope: string;
  readonly onChange: (selections: readonly EnterpriseBusinessAccessSelection[]) => void;
  readonly disabled?: boolean;
}) {
  return (
    <TableContainer>
      <Table
        size="small"
        aria-label={contract.presentation.areaLabel}
        sx={{
          tableLayout: 'fixed',
          '& th, & td': { px: { xs: 0.75, sm: 2 }, overflowWrap: 'anywhere' },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: { xs: '40%', sm: '32%' } }}>
              {contract.presentation.areaLabel}
            </TableCell>
            <TableCell sx={{ width: { xs: '60%', sm: '43%' } }}>
              {contract.presentation.levelLabel}
            </TableCell>
            <TableCell sx={{ width: '25%', display: { xs: 'none', sm: 'table-cell' } }}>
              {contract.presentation.scopeLabel}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contract.businessAreas.map((area) => (
            <TableRow key={area.code}>
              <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>
                {area.label}
                <Typography
                  variant="caption"
                  sx={{ display: { xs: 'block', sm: 'none' } }}
                >
                  {scope}
                </Typography>
              </TableCell>
              <TableCell>
                <TextField
                  select
                  fullWidth
                  size="small"
                  slotProps={{
                    select: {
                      SelectDisplayProps: {
                        'aria-label': `${area.label}: ${contract.presentation.levelLabel}`,
                      },
                    },
                  }}
                  value={
                    selections.find((selection) => selection.businessArea === area.code)
                      ?.accessLevel || 'noAccess'
                  }
                  disabled={disabled}
                  onChange={(event) => {
                    const accessLevel = event.target.value;
                    if (
                      accessLevel !== 'noAccess' &&
                      !area.levels.some((level) => level.value === accessLevel)
                    )
                      return;
                    const next: EnterpriseBusinessAccessSelection = {
                      businessArea: area.code,
                      accessLevel:
                        accessLevel as EnterpriseBusinessAccessSelection['accessLevel'],
                    };
                    onChange(
                      Object.freeze([
                        ...selections.filter(
                          (selection) => selection.businessArea !== area.code,
                        ),
                        Object.freeze(next),
                      ]),
                    );
                  }}
                  sx={{
                    '&& .MuiSelect-select': {
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      textOverflow: 'clip',
                    },
                  }}
                >
                  <MenuItem value="noAccess">{contract.presentation.noAccess}</MenuItem>
                  {area.levels.map((level) => (
                    <MenuItem key={level.value} value={level.value}>
                      {contract.presentation[level.value]}
                    </MenuItem>
                  ))}
                </TextField>
              </TableCell>
              <TableCell
                sx={{
                  overflowWrap: 'anywhere',
                  display: { xs: 'none', sm: 'table-cell' },
                }}
              >
                {scope}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Chooses one explicit backend role through business labels; an empty draft confers no access.
 * @param props Validated owner choices, current draft and presentation-only change callback.
 * @returns Business area and level controls. It performs no API calls or persisted revocation.
 */
export function EnterpriseBusinessAccessSelector({
  contract,
  roleCode,
  onChange,
  disabled = false,
  error,
}: {
  readonly contract: BusinessAccessContract;
  readonly roleCode: string;
  readonly onChange: (roleCode: string) => void;
  readonly disabled?: boolean;
  readonly error?: string | undefined;
}) {
  const [draftArea, setDraftArea] = useState('');
  const assignedArea = contract.businessAreas.find((area) =>
    area.levels.some((level) => level.roleCode === roleCode),
  );
  const area =
    assignedArea || contract.businessAreas.find((area) => area.code === draftArea);
  const selected = area?.levels.find((level) => level.roleCode === roleCode);
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <TextField
        select
        fullWidth
        size="small"
        label={contract.presentation.areaLabel}
        value={area?.code || ''}
        disabled={disabled}
        onChange={(event) => {
          setDraftArea(event.target.value);
          onChange('');
        }}
      >
        {contract.businessAreas.map((area) => (
          <MenuItem key={area.code} value={area.code}>
            {area.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        fullWidth
        size="small"
        label={contract.presentation.levelLabel}
        value={selected?.value || 'noAccess'}
        disabled={disabled || !area}
        error={Boolean(error)}
        helperText={error}
        onChange={(event) =>
          onChange(
            area?.levels.find((level) => level.value === event.target.value)
              ?.roleCode || '',
          )
        }
      >
        <MenuItem value="noAccess">{contract.presentation.noAccess}</MenuItem>
        {(area?.levels || []).map((level) => (
          <MenuItem key={level.value} value={level.value}>
            {contract.presentation[level.value]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

/** Frontend view model only, not a published Profile DTO or executable command body. */
export interface EnterpriseAdministrationTaskCommand {
  readonly code: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledMessage?: string;
  readonly summary: readonly { readonly label: string; readonly value: string }[];
}
/** Plain text mapped from a matched owner workspace by its typed adapter. */
export interface EnterpriseAdministrationTaskPresentation {
  readonly title: string;
  readonly inspectLabel: string;
  readonly emptyMessage: string;
  readonly workingLabel: string;
  readonly reviewTitle: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly uncertainMessage: string;
  readonly unavailableMessage: string;
  readonly recordedMessage: string;
}

/**
 * Reviews one immutable owner-admitted view model. Adapters must validate exact
 * owner readback before returning CONFIRMED and must never automatically replay.
 * This renderer contains no API path, permission/role rule or grant-state inference.
 */
export function EnterpriseAdministrationTaskRenderer({
  context,
  presentation,
  commands,
  inspect,
  execute,
}: {
  readonly context: object;
  readonly presentation: EnterpriseAdministrationTaskPresentation;
  readonly commands: readonly EnterpriseAdministrationTaskCommand[];
  readonly inspect: () => Promise<'INSPECTED' | 'UNCONFIRMED'>;
  readonly execute: (
    reviewed: EnterpriseAdministrationTaskCommand,
  ) => Promise<'CONFIRMED' | 'UNCONFIRMED'>;
}) {
  const [review, setReview] = useState<{
    context: object;
    commands: typeof commands;
    command: EnterpriseAdministrationTaskCommand;
  }>();
  const [busy, setBusy] = useState(false),
    [requiresInspection, setRequiresInspection] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const epoch = useRef(0),
    inFlight = useRef(false);
  const selected =
    review?.context === context && review.commands === commands
      ? review.command
      : undefined;
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setReview(undefined);
    setBusy(false);
    setRequiresInspection(false);
    setError('');
    setNotice('');
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
  }, [context]);
  /** Inspection unlocks only a confirmed owner refresh; failure never restores stale commands. */
  const refresh = async () => {
    if (inFlight.current) return;
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setReview(undefined);
    setRequiresInspection(true);
    setError('');
    setNotice('');
    try {
      const outcome = await inspect();
      if (attempt !== epoch.current) return;
      if (outcome !== 'INSPECTED') throw new Error();
      setRequiresInspection(false);
    } catch {
      if (attempt === epoch.current) setError(presentation.unavailableMessage);
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  /** No optimistic grant update; uncertain or successful commands require fresh inspection. */
  const confirm = async () => {
    if (!selected?.enabled || requiresInspection || inFlight.current) return;
    const command = selected,
      attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const outcome = await execute(command);
      if (attempt !== epoch.current) return;
      if (outcome !== 'CONFIRMED') throw new Error();
      setNotice(presentation.recordedMessage);
    } catch {
      if (attempt === epoch.current) setError(presentation.uncertainMessage);
    } finally {
      if (attempt === epoch.current) {
        setReview(undefined);
        setRequiresInspection(true);
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="h6">{presentation.title}</Typography>
        <Button
          startIcon={<ShellIcon name="refresh" />}
          disabled={busy}
          onClick={() => void refresh()}
        >
          {presentation.inspectLabel}
        </Button>
        {busy && <Typography role="status">{presentation.workingLabel}</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {commands.length === 0 && <Typography>{presentation.emptyMessage}</Typography>}
        {commands.map((command) => (
          <Stack key={command.code} spacing={0.5}>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || requiresInspection || !command.enabled}
              onClick={() => setReview({ context, commands, command })}
            >
              {command.label}
            </Button>
            {!command.enabled && command.disabledMessage && (
              <Typography variant="body2" role="status">
                {command.disabledMessage}
              </Typography>
            )}
          </Stack>
        ))}
        <Dialog
          open={!!selected}
          onClose={() => {
            if (!busy) setReview(undefined);
          }}
        >
          <DialogTitle>{presentation.reviewTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
              <Typography>{selected?.label}</Typography>
              {selected?.summary.map((field, index) => (
                <Typography key={index}>
                  {field.label}: {field.value}
                </Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setReview(undefined)}>
              {presentation.cancelLabel}
            </Button>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || requiresInspection || !selected?.enabled}
              onClick={() => void confirm()}
            >
              {presentation.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
