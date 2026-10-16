/** Profile-owned employee access task. The browser reviews changed areas, never computes effective permissions. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import type { BusinessAccessEditorContract } from './api/businessAccessContract';
import {
  changeEnterpriseBusinessAccess,
  loadEnterpriseBusinessAccessWorkspace,
  type BusinessAccessEmployee,
  type EnterpriseBusinessAccessCommand,
  type EnterpriseBusinessAccessWorkspace,
} from './api/enterpriseBusinessAccessClient';
import {
  EnterpriseBusinessAccessTable,
  type EnterpriseBusinessAccessSelection,
} from './EnterpriseAdministrationTaskRenderer';

type Draft = {
  readonly configuration: OperationalOwnerConfiguration;
  readonly workspace: EnterpriseBusinessAccessWorkspace;
  readonly employee: BusinessAccessEmployee;
  readonly selections: readonly EnterpriseBusinessAccessSelection[];
};

/** Renders independently editable employee areas in the ordinary administration workspace.
 * @param props Admitted current-enterprise transport and owner copy; no membership qualification is needed.
 * @returns Employee table and explicit edit/review dialogs. Uncertain commands retain their original fingerprint and ID.
 */
export function EnterpriseBusinessAccessPanel({
  configuration,
  presentation: initialPresentation,
  disabled = false,
  onHeldChange,
  onCommitted,
}: {
  readonly configuration: OperationalOwnerConfiguration;
  readonly presentation: BusinessAccessEditorContract['presentation'];
  readonly disabled?: boolean;
  readonly onHeldChange?: ((held: boolean) => void) | undefined;
  readonly onCommitted?: (() => void) | undefined;
}) {
  const [snapshot, setSnapshot] = useState<{
    configuration: OperationalOwnerConfiguration;
    workspace: EnterpriseBusinessAccessWorkspace;
  }>();
  const [draft, setDraft] = useState<Draft>();
  const [review, setReview] = useState<EnterpriseBusinessAccessCommand>();
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [inspected, setInspected] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const epoch = useRef(0),
    inFlight = useRef(false);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.workspace : undefined;
  const presentation = workspace?.businessAccess.presentation || initialPresentation;
  const selected = draft?.configuration === configuration ? draft : undefined;
  const load = useCallback(async () => {
    const attempt = ++epoch.current;
    setBusy(true);
    setError('');
    setInspected(false);
    try {
      const value = await loadEnterpriseBusinessAccessWorkspace(configuration);
      if (attempt !== epoch.current) return;
      setSnapshot({ configuration, workspace: value });
      setInspected(true);
    } catch (reason) {
      if (attempt !== epoch.current) return;
      setSnapshot(undefined);
      setError(
        reason instanceof Error ? reason.message : 'Employee access is unavailable.',
      );
    } finally {
      if (attempt === epoch.current) setBusy(false);
    }
  }, [configuration]);
  useEffect(() => {
    setDraft(undefined);
    setReview(undefined);
    setUncertain(false);
    setNotice('');
    inFlight.current = false;
    void load();
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
  }, [load]);
  useEffect(() => {
    onHeldChange?.(busy || Boolean(selected));
    return () => onHeldChange?.(false);
  }, [busy, selected, onHeldChange]);

  const changes =
    selected?.selections.filter(
      (selection) =>
        selection.accessLevel !==
        (selected.employee.selections.find(
          (current) => current.businessArea === selection.businessArea,
        )?.accessLevel || 'noAccess'),
    ) || [];
  const retryEligible =
    inspected &&
    workspace?.employees.some(
      (employee) =>
        employee.employeeCode === review?.employeeCode &&
        employee.reviewFingerprint === review.reviewFingerprint,
    );
  /** Sends the exact reviewed command once. Neither inspection nor late replies rebase a held draft. */
  const confirm = async () => {
    if (
      !selected ||
      !review ||
      disabled ||
      inFlight.current ||
      (uncertain && !retryEligible)
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const attempt = epoch.current;
    try {
      await changeEnterpriseBusinessAccess(configuration, review);
      if (attempt !== epoch.current) return;
      setDraft(undefined);
      setReview(undefined);
      setUncertain(false);
      setNotice(presentation.successMessage);
      inFlight.current = false;
      await load();
      if (attempt + 1 === epoch.current) onCommitted?.();
    } catch (reason) {
      if (attempt !== epoch.current) return;
      setUncertain(true);
      setInspected(false);
      setError(
        reason instanceof Error ? reason.message : presentation.uncertainMessage,
      );
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const advanced = (
    employee: BusinessAccessEmployee,
    source: EnterpriseBusinessAccessWorkspace,
  ) =>
    employee.otherGroupCodes.length > 0 && (
      <Stack spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">
          {source.businessAccess.presentation.advancedMessage}
        </Typography>
        <details>
          <Typography
            component="summary"
            variant="subtitle2"
            sx={{ cursor: 'pointer' }}
          >
            {source.businessAccess.presentation.advancedLabel}
          </Typography>
          <Typography variant="body2" component="div">
            {employee.otherGroupCodes.join(', ')}
          </Typography>
        </details>
      </Stack>
    );
  return (
    <Stack
      spacing={2}
      aria-busy={busy}
      data-functional-module="profile"
      sx={{ minWidth: 0 }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h6" component="h2">
          {workspace?.businessAccess.presentation.areaLabel ||
            presentation.responsibilityLabel}
        </Typography>
        <Button
          aria-label={`${workspace?.businessAccess.presentation.areaLabel || presentation.responsibilityLabel}: ${presentation.refreshLabel}`}
          startIcon={<ShellIcon name="refresh" />}
          disabled={busy || disabled || Boolean(selected)}
          onClick={() => void load()}
        >
          {presentation.refreshLabel}
        </Button>
      </Stack>
      {error && !selected && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {workspace && (
        <>
          <Typography variant="body2">
            {workspace.businessAccess.presentation.scopeLabel}:{' '}
            {workspace.enterpriseCode}
          </Typography>
          <TableContainer>
            <Table
              size="small"
              aria-label={workspace.businessAccess.presentation.employeeLabel}
              sx={{
                display: { xs: 'block', sm: 'table' },
                '& th, & td': {
                  overflowWrap: 'anywhere',
                  display: { xs: 'block', sm: 'table-cell' },
                  borderBottom: { xs: 0, sm: 1 },
                  borderColor: 'divider',
                },
              }}
            >
              <TableHead sx={{ display: { xs: 'none', sm: 'table-header-group' } }}>
                <TableRow>
                  <TableCell>
                    {workspace.businessAccess.presentation.employeeLabel}
                  </TableCell>
                  <TableCell>
                    {workspace.businessAccess.presentation.areaLabel}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody sx={{ display: { xs: 'block', sm: 'table-row-group' } }}>
                {workspace.employees.map((employee) => (
                  <TableRow
                    key={employee.employeeCode}
                    sx={{
                      display: { xs: 'grid', sm: 'table-row' },
                      gridTemplateColumns: 'minmax(0, 1fr) 56px',
                      borderBottom: { xs: 1, sm: 0 },
                      borderColor: 'divider',
                    }}
                  >
                    <TableCell sx={{ gridColumn: 1, gridRow: 1 }}>
                      <Typography>{employee.name || employee.loginId}</Typography>
                      {employee.name && (
                        <Typography variant="body2">{employee.loginId}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ gridColumn: '1 / -1', gridRow: 2 }}>
                      <Stack spacing={1}>
                        {employee.selections.length ? (
                          employee.selections.map((selection) => (
                            <Typography key={selection.businessArea} variant="body2">
                              {
                                workspace.businessAccess.businessAreas.find(
                                  (area) => area.code === selection.businessArea,
                                )!.label
                              }
                              :{' '}
                              {
                                workspace.businessAccess.presentation[
                                  selection.accessLevel
                                ]
                              }
                            </Typography>
                          ))
                        ) : (
                          <Typography variant="body2">
                            {workspace.businessAccess.presentation.noAccess}
                          </Typography>
                        )}
                        {advanced(employee, workspace)}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ gridColumn: 2, gridRow: 1 }}>
                      <Tooltip title={workspace.businessAccess.presentation.levelLabel}>
                        <span>
                          <IconButton
                            aria-label={`${employee.loginId}: ${workspace.businessAccess.presentation.levelLabel}`}
                            disabled={
                              busy ||
                              disabled ||
                              Boolean(selected) ||
                              !workspace.businessAccess.businessAreas.length
                            }
                            onClick={() => {
                              setNotice('');
                              setError('');
                              setReview(undefined);
                              setUncertain(false);
                              setDraft({
                                configuration,
                                workspace,
                                employee,
                                selections: employee.selections,
                              });
                            }}
                          >
                            <ShellIcon name="settings" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!workspace.employees.length && (
            <Typography>{presentation.emptyMessage}</Typography>
          )}
        </>
      )}
      <Dialog
        open={Boolean(selected)}
        fullWidth
        maxWidth="md"
        onClose={() => {
          if (!busy && (!uncertain || inspected)) {
            setDraft(undefined);
            setReview(undefined);
            setUncertain(false);
            setError('');
          }
        }}
      >
        <DialogTitle>
          {review
            ? presentation.reviewTitle
            : selected?.workspace.businessAccess.presentation.areaLabel}
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography>
                {selected.employee.name || selected.employee.loginId}
              </Typography>
              {selected.employee.name && (
                <Typography variant="body2">{selected.employee.loginId}</Typography>
              )}
              <Typography variant="body2">
                {selected.workspace.businessAccess.presentation.scopeLabel}:{' '}
                {selected.workspace.enterpriseCode}
              </Typography>
              {advanced(selected.employee, selected.workspace)}
              {review ? (
                <Table
                  size="small"
                  sx={{
                    tableLayout: 'fixed',
                    '& th, & td': { overflowWrap: 'anywhere' },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {selected.workspace.businessAccess.presentation.areaLabel}
                      </TableCell>
                      <TableCell>
                        {selected.workspace.businessAccess.presentation.levelLabel}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {review.changes.map((change) => (
                      <TableRow key={change.businessArea}>
                        <TableCell>
                          {
                            selected.workspace.businessAccess.businessAreas.find(
                              (area) => area.code === change.businessArea,
                            )!.label
                          }
                        </TableCell>
                        <TableCell>
                          <span>
                            {
                              selected.workspace.businessAccess.presentation[
                                selected.employee.selections.find(
                                  (value) => value.businessArea === change.businessArea,
                                )?.accessLevel || 'noAccess'
                              ]
                            }
                          </span>
                          {' \u2192 '}
                          <span>
                            {
                              selected.workspace.businessAccess.presentation[
                                change.accessLevel
                              ]
                            }
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EnterpriseBusinessAccessTable
                  contract={selected.workspace.businessAccess}
                  selections={selected.selections}
                  scope={selected.workspace.enterpriseCode}
                  disabled={busy || disabled}
                  onChange={(selections) => setDraft({ ...selected, selections })}
                />
              )}
              {review && <Typography>{presentation.reviewMessage}</Typography>}
              {uncertain && (
                <Alert severity="warning">{presentation.uncertainMessage}</Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{ flexWrap: 'wrap', gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}
        >
          {(!uncertain || inspected) && (
            <Button
              disabled={busy}
              onClick={() => {
                if (uncertain) {
                  setReview(undefined);
                  setDraft(undefined);
                  setUncertain(false);
                  setError('');
                } else if (review) setReview(undefined);
                else setDraft(undefined);
              }}
            >
              {presentation.cancelLabel}
            </Button>
          )}
          {uncertain && (
            <Button
              startIcon={<ShellIcon name="refresh" />}
              disabled={busy || disabled}
              onClick={() => void load()}
            >
              {presentation.inspectLabel}
            </Button>
          )}
          <Button
            disabled={
              busy ||
              disabled ||
              !selected ||
              (!review && !changes.length) ||
              (uncertain && !retryEligible)
            }
            onClick={() => {
              if (review) void confirm();
              else if (selected && changes.length)
                setReview(
                  Object.freeze({
                    employeeCode: selected.employee.employeeCode,
                    reviewFingerprint: selected.employee.reviewFingerprint,
                    operationId: crypto.randomUUID(),
                    changes: Object.freeze(
                      changes.map((change) => Object.freeze({ ...change })),
                    ),
                  }),
                );
            }}
          >
            {review
              ? uncertain
                ? presentation.retryLabel
                : presentation.confirmLabel
              : presentation.reviewTitle}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
