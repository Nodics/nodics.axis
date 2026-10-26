/** Explicit issuer review keeps the native administrator identity untouched. */
import { useEffect, useRef, useState } from 'react';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import { ProfileEnterpriseSelector } from '../shared/ProfileEnterpriseSelector';
import type { ProfileEnterpriseOption } from '../shared/profileEnterpriseLookup';
import type { CouponWorkspace } from './couponOfferClient';
import {
  administrativeCapabilities,
  inspectAdministrativeOffer,
  approveAdministrativeOffer,
  type AdministrativeCapability,
  type AdministrativeOffer,
} from './couponAdministrativeClient';
import { searchProfileParticipantEnterprises } from '../shared/profileParticipantLookup';

const display = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function CouponAdministrativeReview({
  configuration,
  labels,
}: {
  configuration: OperationalOwnerConfiguration;
  labels: CouponWorkspace['labels'];
}) {
  // Bootstrap polling replaces objects even when the signed scope and discovered owners are unchanged.
  const authority = JSON.stringify([
    configuration.accessToken,
    configuration.enterpriseCode,
    configuration.bootstrap.tenantCode,
    ...['promotion', 'profile'].map((moduleName) => {
      const connection = selectModuleConnection(
        configuration.bootstrap,
        moduleName,
        moduleName === 'promotion' ? configuration.ownerSelector : undefined,
      );
      return connection
        ? [
            connection.endpoint,
            connection.instanceId,
            connection.environment,
            connection.server,
            connection.runtimeRole?.code,
            connection.runtimeRole?.publication,
          ]
        : null;
    }),
    configuration.bootstrap.navigation
      ?.filter(
        (item) =>
          item.moduleName === 'promotion' &&
          item.backendWorkspace?.workspaceCode === 'promotion.couponOffers',
      )
      .map((item) => [
        item.id,
        item.route,
        item.featureState,
        ['UP', 'DEGRADED'].includes(item.availability),
        item.backendWorkspace?.viewCode,
        item.backendWorkspace?.ownerSelector?.runtimeRoleCode,
        item.backendWorkspace?.ownerSelector?.publicationRole,
      ]),
  ]);
  const [state, setState] = useState<{
    authority: string;
    capability?: AdministrativeCapability;
    error?: string;
  }>();
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    void administrativeCapabilities(configuration, controller.signal)
      .then((capability) => {
        if (current) setState({ authority, capability });
      })
      .catch(() => {
        if (current)
          setState({ authority, error: 'Administrative review is unavailable.' });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [configuration, authority]);
  if (state?.authority !== authority) return null;
  if (!state.capability) return <Alert severity="info">{state.error}</Alert>;
  return (
    <TargetReview
      configuration={configuration}
      capability={state.capability}
      labels={labels}
    />
  );
}
type Props = {
  configuration: OperationalOwnerConfiguration;
  capability: AdministrativeCapability;
  labels: CouponWorkspace['labels'];
};
function TargetReview(props: Props) {
  const [target, setTarget] = useState<ProfileEnterpriseOption | null>(null),
    [code, setCode] = useState('');
  const l = props.capability.labels;
  return (
    <Stack
      spacing={2}
      component="section"
      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
    >
      <Typography variant="h6">{l.administrativeReview}</Typography>
      <ProfileEnterpriseSelector
        label={l.issuerEnterpriseCode}
        configuration={props.configuration}
        value={target}
        onChange={setTarget}
        disabled={false}
        searchEnterprises={searchProfileParticipantEnterprises}
      />
      <TextField
        label={l.reviewOffer}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 128 } }}
      />
      {target && code && (
        <Review
          key={`${target.code}:${code}`}
          {...props}
          issuer={target.code}
          code={code}
        />
      )}
    </Stack>
  );
}
function Review({
  configuration,
  capability,
  labels,
  issuer,
  code,
}: Props & { issuer: string; code: string }) {
  const [offer, setOffer] = useState<AdministrativeOffer>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const active = useRef(true),
    running = useRef(false),
    controller = useRef(new AbortController());
  useEffect(() => {
    active.current = true;
    controller.current = new AbortController();
    return () => {
      active.current = false;
      controller.current.abort();
    };
  }, []);
  const l = capability.labels;
  const read = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setOffer(undefined);
    setConfirm(false);
    try {
      const result = await inspectAdministrativeOffer(
        configuration,
        issuer,
        code,
        controller.current.signal,
      );
      if (active.current) {
        setOffer(result);
        setUncertain(false);
      }
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : 'The review failed.');
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  const approve = async () => {
    if (running.current || !offer || uncertain) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await approveAdministrativeOffer(
        configuration,
        offer,
        reason,
        controller.current.signal,
      );
      if (active.current) setOffer(result);
    } catch (e) {
      if (active.current) {
        setUncertain(true);
        setError(e instanceof Error ? e.message : 'Approval could not be confirmed.');
      }
    } finally {
      running.current = false;
      if (active.current) {
        setBusy(false);
        setConfirm(false);
      }
    }
  };
  return (
    <Stack spacing={2}>
      <Button disabled={busy} onClick={() => void read()}>
        {l.reviewOffer}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {offer && (
        <>
          <Typography>
            {l.issuerEnterpriseCode}: {offer.issuerEnterpriseCode}
          </Typography>
          <Typography>
            {labels.code}: {offer.code} · {offer.name} · {offer.status}
          </Typography>
          {offer.budget && (
            <Typography>
              {labels.budgetLimit}: {offer.budget.limit}
            </Typography>
          )}
          {offer.vendorEnterpriseRef && (
            <Typography>Vendor enterprise: {offer.vendorEnterpriseRef.code}</Typography>
          )}
          <Typography>
            {labels.product}:{' '}
            {typeof offer.conditions.sourceProductCode === 'string'
              ? offer.conditions.sourceProductCode
              : ''}
          </Typography>
          <Typography>
            {labels.benefit}:{' '}
            {display(offer.actions.benefitType || offer.actions.discountType)}{' '}
            {display(
              offer.actions.discountAmount ??
                offer.actions.discountValue ??
                offer.actions.percent,
            )}
          </Typography>
          {Array.isArray(offer.actions.items) &&
            offer.actions.items.map((value: unknown, index: number) => {
              if (!value || typeof value !== 'object') return null;
              const item = value as Record<string, unknown>;
              return (
                <Typography key={index}>
                  {labels.item}: {display(item.sku)} · {labels.itemQuantity}:{' '}
                  {display(item.quantity)}
                </Typography>
              );
            })}
          <Typography>
            {labels.requirements}: {offer.couponOffer.requirements.type}
          </Typography>
          {offer.couponOffer.requirements.priceRef && (
            <Typography>
              {labels.price}: {offer.couponOffer.requirements.priceRef}
            </Typography>
          )}
          {offer.couponOffer.requirements.certificates && (
            <Typography>
              {labels.certificates}:{' '}
              {offer.couponOffer.requirements.certificates.quantity} · {labels.category}
              : {offer.couponOffer.requirements.certificates.categoryCode} ·{' '}
              {labels.milestone}:{' '}
              {offer.couponOffer.requirements.certificates.milestoneCode}
            </Typography>
          )}
          {offer.couponOffer.ownerLimit !== undefined && (
            <Typography>
              {labels.ownerLimit}: {offer.couponOffer.ownerLimit}
            </Typography>
          )}
          <Typography>
            {labels.supply}:{' '}
            {offer.couponOffer.supply.mode === 'LIMITED'
              ? offer.couponOffer.supply.quantity
              : labels.unlimited}
          </Typography>
          <Typography>
            {labels.expiry}:{' '}
            {offer.couponOffer.expiry.mode === 'FIXED' ? (
              <time dateTime={offer.couponOffer.expiry.at}>
                {new Date(offer.couponOffer.expiry.at).toLocaleString()}
              </time>
            ) : (
              labels.noExpiry
            )}
          </Typography>
          <Typography>
            {labels.terms}: {offer.couponOffer.terms.join(' · ')}
          </Typography>
          {(Object.keys(offer.approval) as (keyof typeof offer.approval)[]).map(
            (key) => (
              <Typography key={key}>
                {labels[key]}:{' '}
                {['submittedAt', 'approvedAt', 'lastActionAt'].includes(key) &&
                Number.isFinite(Date.parse(offer.approval[key]!)) ? (
                  <time dateTime={offer.approval[key]}>
                    {new Date(offer.approval[key]!).toLocaleString()}
                  </time>
                ) : (
                  offer.approval[key]
                )}
              </Typography>
            ),
          )}
          {offer.audit && (
            <Typography>
              Actor: {offer.audit.actorCode} · Enterprise:{' '}
              {offer.audit.actorEnterpriseCode} · Issuer:{' '}
              {offer.audit.issuerEnterpriseCode}
            </Typography>
          )}
          {offer.canApprove && (
            <Button
              disabled={busy || uncertain}
              onClick={() => {
                setReason('');
                setConfirm(true);
              }}
            >
              {l.approve}
            </Button>
          )}
        </>
      )}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{l.confirmApproval}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              {l.issuerEnterpriseCode}: {issuer}
            </Typography>
            <Typography>
              {labels.code}: {code}
            </Typography>
            <TextField
              label={l.reasonCode}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 512 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            {labels.cancel}
          </Button>
          <Button
            disabled={busy || uncertain || !reason.trim()}
            onClick={() => void approve()}
          >
            {l.confirmApproval}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
