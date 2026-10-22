/** Promotion's protected aggregate consumer; exports exactly the same safe projection as the dashboard. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
import {
  acquisitionReport,
  type AcquisitionReport,
  type AcquisitionReportSelection,
  type AcquisitionAggregate,
  type CouponWorkspace,
} from './couponOfferClient';
import { useCouponWorkspace, type CouponWorkspaceProps } from './useCouponWorkspace';

/** Uses only the advertised Online Promotion owner and retires results when that authority changes. */
export function CouponAcquisitionReportPanel(props: CouponWorkspaceProps) {
  const owner = useCouponWorkspace(props, 'reporting');
  if (!owner.allowed) return null;
  if (!owner.workspace)
    return (
      <Alert severity={owner.error ? 'error' : 'info'}>
        {owner.error || 'Loading owner workspace...'}
      </Alert>
    );
  return <Report owner={owner} workspace={owner.workspace} />;
}

/** Uses approved dimensions only; no raw customer drill-down or inferred zero for protected/unknown cells. */
function Report({
  owner,
  workspace,
}: {
  owner: ReturnType<typeof useCouponWorkspace>;
  workspace: CouponWorkspace;
}) {
  const [code, setCode] = useState(''),
    [channel, setChannel] = useState(''),
    [view, setView] = useState<'ISSUER' | 'REDEEMER'>('ISSUER'),
    [scopeType, setScopeType] =
      useState<AcquisitionReportSelection['scope']['type']>('ENTERPRISE'),
    [scopeCode, setScopeCode] = useState(''),
    [fromDate, setFromDate] = useState(''),
    [toDate, setToDate] = useState(''),
    [breakdown, setBreakdown] =
      useState<AcquisitionReportSelection['breakdown']>('NONE'),
    [report, setReport] = useState<AcquisitionReport>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const active = useRef(true),
    running = useRef(false),
    l = workspace.labels;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <Stack
      spacing={2}
      data-functional-module="promotion"
      sx={{ minWidth: 0, maxWidth: 1000, overflowWrap: 'anywhere' }}
    >
      <Typography variant="h6">{l.reportTitle}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label={l.code}
          value={code}
          disabled={busy}
          onChange={(event) => {
            setCode(event.target.value);
            setReport(undefined);
          }}
        />
        <TextField
          label={l.channel}
          value={channel}
          disabled={busy}
          onChange={(event) => {
            setChannel(event.target.value);
            setReport(undefined);
          }}
        />
      </Stack>
      <ToggleButtonGroup
        value={view}
        exclusive
        disabled={busy}
        onChange={(_event, next: 'ISSUER' | 'REDEEMER' | null) => {
          if (next) {
            setView(next);
            setReport(undefined);
          }
        }}
        aria-label={l.reportTitle}
      >
        <ToggleButton value="ISSUER">{l.issuer}</ToggleButton>
        <ToggleButton value="REDEEMER">{l.redeemer}</ToggleButton>
      </ToggleButtonGroup>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ flexWrap: 'wrap' }}
      >
        <TextField
          type="date"
          label={l.fromDate}
          value={fromDate}
          disabled={busy}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => {
            setFromDate(event.target.value);
            setReport(undefined);
          }}
        />
        <TextField
          type="date"
          label={l.toDate}
          value={toDate}
          disabled={busy}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => {
            setToDate(event.target.value);
            setReport(undefined);
          }}
        />
        <TextField
          select
          label={l.scopeType}
          value={scopeType}
          disabled={busy}
          sx={{ minWidth: 160 }}
          onChange={(event) => {
            setScopeType(event.target.value as typeof scopeType);
            setScopeCode('');
            setReport(undefined);
          }}
        >
          <MenuItem value="ENTERPRISE">{l.enterpriseScope}</MenuItem>
          <MenuItem value="OUTLET">{l.outletScope}</MenuItem>
          <MenuItem value="GROUP">{l.groupScope}</MenuItem>
        </TextField>
        {scopeType !== 'ENTERPRISE' && (
          <TextField
            label={l.scopeCode}
            value={scopeCode}
            disabled={busy}
            onChange={(event) => {
              setScopeCode(event.target.value);
              setReport(undefined);
            }}
          />
        )}
        <TextField
          select
          label={l.breakdown}
          value={breakdown}
          disabled={busy}
          sx={{ minWidth: 160 }}
          onChange={(event) => {
            setBreakdown(event.target.value as typeof breakdown);
            setReport(undefined);
          }}
        >
          <MenuItem value="NONE">{l.noBreakdown}</MenuItem>
          <MenuItem value="DAY">{l.dayBreakdown}</MenuItem>
          <MenuItem value="OUTLET">{l.outletScope}</MenuItem>
          <MenuItem value="ENTERPRISE">{l.enterpriseScope}</MenuItem>
        </TextField>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          disabled={
            busy ||
            owner.pending ||
            !/^[A-Za-z0-9_.:@-]{1,128}$/.test(code) ||
            (scopeType !== 'ENTERPRISE' &&
              !/^[A-Za-z0-9_.:@-]{1,128}$/.test(scopeCode)) ||
            Boolean(fromDate && toDate && fromDate >= toDate) ||
            !/^[A-Za-z0-9_.:@-]{1,128}$/.test(channel)
          }
          onClick={() => {
            if (running.current) return;
            running.current = true;
            setBusy(true);
            setReport(undefined);
            setError('');
            const selection: AcquisitionReportSelection = {
              promotionCode: code,
              channelCode: channel,
              view,
              scope: {
                type: scopeType,
                code:
                  scopeType === 'ENTERPRISE'
                    ? owner.configuration.enterpriseCode
                    : scopeCode,
              },
              period: { fromDate: fromDate || null, toDate: toDate || null },
              breakdown,
            };
            void invokeOperationalOwner(
              owner.configuration,
              'promotion',
              `/promotions/${encodeURIComponent(code)}/acquisition-report`,
              {
                view,
                channelCode: channel,
                scopeType,
                scopeCode: selection.scope.code,
                fromDate: selection.period.fromDate,
                toDate: selection.period.toDate,
                breakdown,
              },
            )
              .then((value) => acquisitionReport(value, selection))
              .then((value) => {
                if (active.current) setReport(value);
              })
              .catch(() => {
                if (active.current)
                  setError('The owner aggregate could not be loaded.');
              })
              .finally(() => {
                running.current = false;
                if (active.current) setBusy(false);
              });
          }}
        >
          {l.loadReport}
        </Button>
        <Button
          disabled={!report || busy || owner.pending}
          onClick={() => {
            if (!report) return;
            const url = URL.createObjectURL(
                new Blob([JSON.stringify(report, null, 2)], {
                  type: 'application/json',
                }),
              ),
              link = document.createElement('a');
            link.href = url;
            link.download = 'coupon-acquisition.json';
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          {l.exportReport}
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {report && (
        <>
          {report.protected && (
            <Alert severity="info">
              {report.status === 'UNKNOWN' ? l.unknown : l.protected}
            </Alert>
          )}
          <Typography>
            {l.dataUpdatedThrough}: {report.dataUpdatedThrough || l.unknown} (UTC)
          </Typography>
          {report.counts && report.rates && (
            <AggregateTable
              labels={l}
              title={l.noBreakdown}
              aggregate={{
                protected: report.protected,
                counts: report.counts,
                rates: report.rates,
              }}
            />
          )}
          {report.rows.map((row) => (
            <AggregateTable key={row.key} labels={l} title={row.key} aggregate={row} />
          ))}
        </>
      )}
    </Stack>
  );
}

/** Both totals and dimension rows render only the validated owner projection used by export. */
function AggregateTable({
  labels: l,
  title,
  aggregate: a,
}: {
  labels: CouponWorkspace['labels'];
  title: string;
  aggregate: AcquisitionAggregate;
}) {
  return (
    <Stack spacing={1} sx={{ overflowX: 'auto' }}>
      <Typography variant="subtitle2">{title}</Typography>
      <Table size="small" aria-label={`${l.reportTitle}: ${title}`}>
        <TableBody>
          {Object.entries(a.counts).map(([name, count]) => (
            <TableRow key={name}>
              <TableCell>{l[name as keyof typeof l]}</TableCell>
              <TableCell align="right">
                {count === null ? (a.protected ? l.protected : l.unknown) : count}
              </TableCell>
            </TableRow>
          ))}
          {Object.entries(a.rates).map(([name, rate]) => (
            <TableRow key={name}>
              <TableCell>{l[name as keyof typeof l]}</TableCell>
              <TableCell align="right">
                {rate.percent === null
                  ? a.protected
                    ? l.protected
                    : l.unknown
                  : rate.percent + '%'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
