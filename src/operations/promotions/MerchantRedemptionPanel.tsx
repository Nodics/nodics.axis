/** Digital Core merchant-workspace consumer; outlet scope and fulfillment remain owner-enforced. */
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack,
  Typography,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
import { CouponQrInput } from './CouponQrInput';
type BenefitSource = {
  sourceReference: string;
  sourceHash: string;
  sourceRevision: number;
  storeCode: string;
  storeRevision: number;
};
type MerchantBenefit = BenefitSource &
  (
    | {
        sourceStage: 'PRICED_CART';
        currency: string;
        subtotalAmount: string;
        discountAmount: string;
      }
    | {
        sourceStage: 'SIMULATED_ITEMS';
        benefitType: 'ITEM';
        items: { sku: string; quantity: number; unit: 'EACH' }[];
        simulated: true;
        verified: false;
        sourceType: 'ITEM_SIMULATION';
      }
    | {
        sourceStage: 'FULFILLED_ITEMS';
        benefitType: 'ITEM';
        items: { sku: string; quantity: number; unit: 'EACH' }[];
        deliveredAt: string;
      }
  );
type Redemption = {
  entitlementCode: string;
  productCode: string;
  claimStatus: string;
  revision: number;
  merchantLabel: string;
  mode: string;
  redemptionCode?: string;
  receiptCode?: string;
  merchantReceiptReference?: string;
  eligible?: boolean;
  recoveryRequired?: boolean;
  simulated?: true;
  deliveryVerified?: false;
  evidenceMode?: 'SIMULATION' | 'LOCAL_SIMULATION';
  validationCode?: string;
  validationExpiresAt?: string;
  confirmationKey?: string;
  expiresAt?: string;
  branchCode?: string;
  storeCode?: string;
  storeRevision?: number;
  conditions?: { benefit?: unknown };
  pricedBenefit?: MerchantBenefit;
};
/** Projects bounded inert owner fields before offering a reviewed fulfillment action. */
function redemption(value: Redemption): Redemption {
  if (
    !value ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !['MERCHANT_SCREEN', 'LOCAL_SAMPLE'].includes(value.mode)
  )
    throw new Error('Merchant request could not be confirmed.');
  const result = { revision: value.revision } as Redemption;
  for (const field of [
    'entitlementCode',
    'productCode',
    'claimStatus',
    'merchantLabel',
    'mode',
  ] as const) {
    if (typeof value[field] !== 'string' || !value[field] || value[field].length > 256)
      throw new Error('Merchant request could not be confirmed.');
    result[field] = value[field];
  }
  for (const field of [
    'receiptCode',
    'redemptionCode',
    'merchantReceiptReference',
    'validationCode',
    'validationExpiresAt',
    'confirmationKey',
    'expiresAt',
    'branchCode',
    'storeCode',
  ] as const) {
    if (value[field] !== undefined) {
      if (
        typeof value[field] !== 'string' ||
        !value[field] ||
        value[field].length > 512
      )
        throw new Error('Merchant request could not be confirmed.');
      result[field] = value[field];
    }
  }
  for (const field of ['eligible', 'recoveryRequired'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean')
      throw new Error('Merchant request could not be confirmed.');
    if (value[field] !== undefined) result[field] = value[field];
  }
  const evidenceKeys = ['simulated', 'deliveryVerified', 'evidenceMode'] as const;
  if (evidenceKeys.some((key) => key in value)) {
    const descriptors = evidenceKeys.map((key) =>
      Object.getOwnPropertyDescriptor(value, key),
    );
    const evidenceMode: unknown = descriptors[2]?.value;
    if (
      descriptors.some(
        (descriptor) =>
          !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'),
      ) ||
      descriptors[0]?.value !== true ||
      descriptors[1]?.value !== false ||
      (evidenceMode !== 'SIMULATION' && evidenceMode !== 'LOCAL_SIMULATION')
    )
      throw new Error('Merchant simulation evidence could not be confirmed.');
    result.simulated = true;
    result.deliveryVerified = false;
    result.evidenceMode = evidenceMode;
  }
  if (value.storeRevision !== undefined) {
    if (!Number.isSafeInteger(value.storeRevision) || value.storeRevision < 1)
      throw new Error('Merchant request could not be confirmed.');
    result.storeRevision = value.storeRevision;
  }
  const benefit = value.conditions?.benefit as Redemption['pricedBenefit'];
  if (benefit !== undefined) {
    if (!benefit || typeof benefit !== 'object' || Array.isArray(benefit))
      throw new Error('The benefit source could not be confirmed.');
    if (
      [benefit.sourceReference, benefit.sourceHash, benefit.storeCode].some(
        (value) => typeof value !== 'string',
      ) ||
      !/^[A-Za-z0-9_.:@-]{1,119}$/.test(benefit.sourceReference) ||
      !/^[a-f0-9]{64}$/.test(benefit.sourceHash) ||
      !Number.isSafeInteger(benefit.sourceRevision) ||
      benefit.sourceRevision < 0 ||
      !/^[A-Za-z0-9_.:-]{1,128}$/.test(benefit.storeCode) ||
      !Number.isSafeInteger(benefit.storeRevision) ||
      benefit.storeRevision < 1
    )
      throw new Error('The benefit source could not be confirmed.');
    const source = {
      sourceReference: benefit.sourceReference,
      sourceHash: benefit.sourceHash,
      sourceRevision: benefit.sourceRevision,
      storeCode: benefit.storeCode,
      storeRevision: benefit.storeRevision,
    };
    if (benefit.sourceStage === 'PRICED_CART') {
      if (
        result.simulated ||
        ['simulated', 'verified', 'sourceType', 'items', 'deliveredAt'].some((field) =>
          Object.hasOwn(benefit, field),
        ) ||
        !/^CART:[A-Za-z0-9_.@-]{1,114}$/.test(benefit.sourceReference) ||
        !/^[A-Z]{3}$/.test(benefit.currency) ||
        [benefit.subtotalAmount, benefit.discountAmount].some(
          (amount) =>
            typeof amount !== 'string' ||
            amount.length > 128 ||
            !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount),
        )
      )
        throw new Error('The priced source could not be confirmed.');
      result.pricedBenefit = {
        ...source,
        sourceStage: 'PRICED_CART',
        currency: benefit.currency,
        subtotalAmount: benefit.subtotalAmount,
        discountAmount: benefit.discountAmount,
      };
    } else if (
      benefit.sourceStage === 'SIMULATED_ITEMS' ||
      benefit.sourceStage === 'FULFILLED_ITEMS'
    ) {
      if (
        benefit.benefitType !== 'ITEM' ||
        !Array.isArray(benefit.items) ||
        !benefit.items.length ||
        benefit.items.length > 20 ||
        benefit.items.some(
          (item) =>
            !item ||
            typeof item.sku !== 'string' ||
            !/^[A-Za-z0-9_.:-]{1,128}$/.test(item.sku) ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 100 ||
            item.unit !== 'EACH',
        ) ||
        new Set(benefit.items.map((item) => item.sku)).size !== benefit.items.length
      )
        throw new Error('The item evidence could not be confirmed.');
      const items = benefit.items.map(({ sku, quantity, unit }) => ({
        sku,
        quantity,
        unit,
      }));
      if (benefit.sourceStage === 'SIMULATED_ITEMS') {
        if (
          benefit.simulated !== true ||
          benefit.verified !== false ||
          benefit.sourceType !== 'ITEM_SIMULATION' ||
          !/^SIM:[A-Za-z0-9_.:@-]{1,115}$/.test(benefit.sourceReference) ||
          Object.hasOwn(benefit, 'deliveredAt')
        )
          throw new Error('Merchant simulation evidence could not be confirmed.');
        result.pricedBenefit = {
          ...source,
          sourceStage: 'SIMULATED_ITEMS',
          benefitType: 'ITEM',
          items,
          simulated: true,
          verified: false,
          sourceType: 'ITEM_SIMULATION',
        };
      } else {
        if (
          result.simulated ||
          Object.hasOwn(benefit, 'simulated') ||
          Object.hasOwn(benefit, 'verified') ||
          Object.hasOwn(benefit, 'sourceType') ||
          typeof benefit.deliveredAt !== 'string' ||
          !Number.isFinite(Date.parse(benefit.deliveredAt)) ||
          Date.parse(benefit.deliveredAt) > Date.now()
        )
          throw new Error('The item evidence could not be confirmed.');
        result.pricedBenefit = {
          ...source,
          sourceStage: 'FULFILLED_ITEMS',
          benefitType: 'ITEM',
          items,
          deliveredAt: benefit.deliveredAt,
        };
      }
    } else throw new Error('The benefit source could not be confirmed.');
  }
  return result;
}
/** Simulation labels consume only the owner's exact evidence marker, never runtime or outlet settings. */
function isSimulation(value: Redemption | null) {
  return (
    value?.simulated === true || value?.pricedBenefit?.sourceStage === 'SIMULATED_ITEMS'
  );
}
/** Preserves the actual owner mode without asserting genuine goods delivery. */
function SimulationNotice({
  evidenceMode,
}: {
  evidenceMode: Redemption['evidenceMode'];
}) {
  return (
    <Alert severity="warning">
      ITEM simulation. Goods delivery is not verified.
      {evidenceMode ? ` ${evidenceMode}.` : null}
    </Alert>
  );
}
type MerchantWorkspace = {
  authority: object;
  storeRequired: boolean;
  storeLabel: string;
  pricedSourceRequired: boolean;
  pricedSourceLabel?: string;
  stores: { code: string; name: string; revision: number }[];
};
/** Presentation/order changes do not change the fresh owner's outlet/revision and input requirements. */
function sameOutletScope(
  previous: MerchantWorkspace,
  next: MerchantWorkspace,
): boolean {
  const revisions = new Map(
    previous.stores.map((store) => [store.code, store.revision]),
  );
  return (
    previous.authority === next.authority &&
    previous.storeRequired === next.storeRequired &&
    previous.pricedSourceRequired === next.pricedSourceRequired &&
    previous.stores.length === next.stores.length &&
    next.stores.every((store) => revisions.get(store.code) === store.revision)
  );
}
/** Digital Core owns scoped merchant fulfillment; this panel submits explicitly reviewed commands only. */
export function MerchantRedemptionPanel({
  bootstrap,
  accessToken,
  runtime,
  sessionGeneration = 0,
}: {
  bootstrap: AxisAuthenticatedBootstrap;
  accessToken: string;
  runtime: AxisRuntimeConfig;
  readonly sessionGeneration?: number;
}) {
  const connection = selectModuleConnection(bootstrap, 'digitalCore');
  const navigation = bootstrap.navigation?.find(
    (item) => item.id === 'merchant-coupon-fulfillment',
  );
  // Only inert owner coordinates are serialized; tokens never enter keys or logs.
  const ownerIdentity = JSON.stringify([
    connection?.moduleName,
    connection?.instanceId,
    connection?.endpoint,
    connection?.environment,
    connection?.server,
    connection?.runtimeRole?.code,
    connection?.runtimeRole?.publication,
    connection?.state,
    navigation?.moduleName,
    navigation?.route,
    navigation?.availability,
    navigation?.featureState,
    navigation?.sourceTrace?.lifecycleState,
    navigation?.routeOwner?.ownerType,
    navigation?.routeOwner?.ownerModule,
    navigation?.contexts,
  ]);
  const tenantCode = bootstrap.tenantCode;
  const { enterpriseCode, projectCode, backofficeBaseUrl, requestTimeoutMs } = runtime;
  const authority = useMemo(
    () => ({
      accessToken,
      sessionGeneration,
      tenantCode,
      enterpriseCode,
      projectCode,
      backofficeBaseUrl,
      ownerIdentity,
    }),
    [
      accessToken,
      sessionGeneration,
      tenantCode,
      enterpriseCode,
      projectCode,
      backofficeBaseUrl,
      ownerIdentity,
    ],
  );
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode,
      timeoutMs: requestTimeoutMs,
    }),
    [bootstrap, accessToken, enterpriseCode, requestTimeoutMs],
  );
  const [rows, setRows] = useState<Redemption[] | null>(null),
    [chosen, setChosen] = useState<Redemption | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [presentation, setPresentation] = useState(''),
    [receipt, setReceipt] = useState('');
  const [outletSnapshot, setOutlets] = useState<MerchantWorkspace>();
  const workspaceSnapshot = useRef<MerchantWorkspace | undefined>(undefined);
  const [workspacePending, setWorkspacePending] = useState(true);
  const outlets = outletSnapshot?.authority === authority ? outletSnapshot : undefined;
  const [storeCode, setStoreCode] = useState('');
  const [pricedSource, setPricedSource] = useState('');
  const version = useRef(0);
  const inFlight = useRef(false);
  const retireWorkspace = useEffectEvent(() => {
    version.current++;
    workspaceSnapshot.current = undefined;
    setOutlets(undefined);
    setRows(null);
    setChosen(null);
    setStoreCode('');
    setPricedSource('');
    setError('');
    setBusy(false);
    setReceipt('');
    setPresentation('');
    inFlight.current = false;
    setWorkspacePending(true);
  });
  useLayoutEffect(() => {
    retireWorkspace();
    const epoch = version;
    return () => {
      epoch.current++;
    };
  }, [authority]);
  useEffect(() => {
    let active = true;
    setWorkspacePending(true);
    void invokeOperationalOwner<unknown>(
      configuration,
      'digitalCore',
      '/merchant/redemptions/workspace',
    )
      .then((value) => {
        const source = value as {
          storeRequired?: unknown;
          storeLabel?: unknown;
          stores?: unknown;
          pricedSourceRequired?: unknown;
          pricedSourceLabel?: unknown;
        };
        if (
          !source ||
          typeof source.storeRequired !== 'boolean' ||
          typeof source.storeLabel !== 'string' ||
          !source.storeLabel ||
          source.storeLabel.length > 192 ||
          typeof source.pricedSourceRequired !== 'boolean' ||
          (source.pricedSourceRequired &&
            (typeof source.pricedSourceLabel !== 'string' ||
              !source.pricedSourceLabel.trim() ||
              source.pricedSourceLabel.length > 192)) ||
          !Array.isArray(source.stores) ||
          source.stores.length > 100
        )
          throw new Error('Merchant outlet selection is unavailable.');
        const stores = source.stores.map(
          (item: { code?: unknown; name?: unknown; revision?: unknown }) => {
            if (
              !item ||
              typeof item.code !== 'string' ||
              !/^[A-Za-z0-9_.:-]{1,128}$/.test(item.code) ||
              typeof item.name !== 'string' ||
              !item.name ||
              item.name.length > 256 ||
              !Number.isSafeInteger(item.revision) ||
              Number(item.revision) < 1
            )
              throw new Error('Merchant outlet selection is unavailable.');
            return {
              code: item.code,
              name: item.name,
              revision: Number(item.revision),
            };
          },
        );
        if (new Set(stores.map((item) => item.code)).size !== stores.length)
          throw new Error('Merchant outlet selection is unavailable.');
        if (active) {
          const next: MerchantWorkspace = {
            authority,
            storeRequired: source.storeRequired,
            storeLabel: source.storeLabel,
            pricedSourceRequired: source.pricedSourceRequired,
            ...(source.pricedSourceRequired
              ? { pricedSourceLabel: source.pricedSourceLabel as string }
              : {}),
            stores,
          };
          const previous = workspaceSnapshot.current;
          if (previous && !sameOutletScope(previous, next)) retireWorkspace();
          workspaceSnapshot.current = next;
          setOutlets(next);
        }
      })
      .catch((reason) => {
        if (active) {
          retireWorkspace();
          setError(
            reason instanceof Error
              ? reason.message
              : 'Merchant workspace is unavailable.',
          );
        }
      })
      .finally(() => {
        if (active) setWorkspacePending(false);
      });
    return () => {
      active = false;
    };
  }, [configuration, authority]);
  const working = busy || workspacePending;
  const outletReady = !!outlets && (!outlets.storeRequired || !!storeCode);
  const sourceReady =
    !!outlets &&
    (!outlets.pricedSourceRequired ||
      /^[A-Za-z0-9_.:@-]{1,119}$/.test(pricedSource.trim()));
  /** Replaces selectable queue state with a fresh bounded owner read; continuation follows a confirmed command. */
  const load = async (continuation = false) => {
    if (!outletReady || workspacePending || (inFlight.current && !continuation)) return;
    inFlight.current = true;
    const attempt = version.current;
    setBusy(true);
    setError('');
    setRows(null);
    setChosen(null);
    try {
      const r = await invokeOperationalOwner<{ redemptions: Redemption[] }>(
        configuration,
        'digitalCore',
        '/merchant/redemptions' +
          (storeCode ? '?storeCode=' + encodeURIComponent(storeCode) : ''),
        undefined,
        'GET',
      );
      if (!r || !Array.isArray(r.redemptions) || r.redemptions.length > 100)
        throw new Error('Merchant requests could not be confirmed.');
      const rows = r.redemptions.map(redemption);
      if (new Set(rows.map((row) => row.entitlementCode)).size !== rows.length)
        throw new Error('Merchant requests could not be confirmed.');
      if (attempt === version.current) setRows(rows);
    } catch (e) {
      if (attempt === version.current)
        setError(e instanceof Error ? e.message : 'Cannot load merchant requests');
    } finally {
      if (attempt === version.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };
  if (!connection) return null;
  return (
    <Paper
      sx={{ p: 2, minWidth: 0, overflowWrap: 'anywhere' }}
      data-functional-module="digitalCore"
    >
      <Stack spacing={2}>
        <Typography variant="h6">Merchant coupon fulfillment</Typography>
        <Typography>
          Validate the customer’s coupon for your enterprise, then confirm fulfillment
          with your transaction or receipt reference.
        </Typography>
        <TextField
          label="Customer coupon code"
          value={presentation}
          disabled={busy || (workspacePending && !!outlets)}
          slotProps={{ htmlInput: { maxLength: 256 } }}
          onChange={(e) => {
            setPresentation(e.target.value.trim().toUpperCase());
            setChosen(null);
          }}
        />
        <CouponQrInput
          disabled={working || !!chosen}
          authority={authority}
          scope={JSON.stringify([storeCode, pricedSource, presentation])}
          onToken={(token) => {
            version.current++;
            setPresentation(token);
            setChosen(null);
            setRows(null);
            setReceipt('');
            setError('');
          }}
          onError={setError}
        />
        {outlets?.storeRequired && (
          <TextField
            select
            label={outlets.storeLabel}
            value={storeCode}
            disabled={working}
            onChange={(event) => {
              version.current++;
              setStoreCode(event.target.value);
              setChosen(null);
              setRows(null);
              setReceipt('');
              setPricedSource('');
              setError('');
            }}
          >
            {outlets.stores.map((store) => (
              <MenuItem key={store.code} value={store.code}>
                {store.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        {outlets?.pricedSourceRequired && (
          <TextField
            label={outlets.pricedSourceLabel}
            value={pricedSource}
            disabled={working}
            slotProps={{ htmlInput: { maxLength: 119 } }}
            onChange={(event) => {
              setPricedSource(event.target.value);
              setChosen(null);
              setReceipt('');
            }}
          />
        )}
        <Button
          disabled={working || !presentation || !outletReady || !sourceReady}
          onClick={() => {
            void (async () => {
              if (inFlight.current || workspacePending || !sourceReady) return;
              inFlight.current = true;
              setBusy(true);
              setError('');
              setChosen(null);
              const attempt = version.current;
              try {
                const result = redemption(
                  await invokeOperationalOwner<Redemption>(
                    configuration,
                    'digitalCore',
                    '/merchant/redemptions/validate',
                    {
                      couponToken: presentation,
                      ...(storeCode ? { storeCode } : {}),
                      ...(outlets?.pricedSourceRequired
                        ? { merchantReceiptReference: pricedSource.trim() }
                        : {}),
                    },
                  ),
                );
                if (result.eligible !== true)
                  throw new Error(
                    result.claimStatus === 'REDEEMED'
                      ? 'This coupon has already been redeemed. Receipt: ' +
                          (result.receiptCode || '')
                      : 'The owner did not confirm this coupon as eligible.',
                  );
                if (
                  outlets?.pricedSourceRequired &&
                  (!result.pricedBenefit ||
                    result.pricedBenefit.sourceReference !== pricedSource.trim() ||
                    result.pricedBenefit.storeCode !== storeCode ||
                    result.pricedBenefit.storeRevision !== result.storeRevision)
                )
                  throw new Error('The priced source could not be confirmed.');
                if (attempt === version.current) {
                  if (
                    outlets?.storeRequired &&
                    (result.storeCode !== storeCode ||
                      !Number.isSafeInteger(result.storeRevision) ||
                      Number(result.storeRevision) < 1)
                  )
                    throw new Error('The validated outlet could not be confirmed.');
                  setReceipt(outlets?.pricedSourceRequired ? pricedSource.trim() : '');
                  setChosen(result);
                }
              } catch (e) {
                if (attempt === version.current)
                  setError(e instanceof Error ? e.message : 'Cannot validate coupon');
              } finally {
                if (attempt === version.current) {
                  setBusy(false);
                  inFlight.current = false;
                }
              }
            })();
          }}
        >
          Validate presented coupon
        </Button>
        <Button disabled={working || !outletReady} onClick={() => void load()}>
          Load merchant requests
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {working && <Typography role="status">Working…</Typography>}
        {outletReady &&
          rows?.map((row) => (
            <Paper variant="outlined" sx={{ p: 2 }} key={row.entitlementCode}>
              <Typography>
                {row.merchantLabel} · {row.productCode}
              </Typography>
              <Typography>
                {row.redemptionCode} · {row.claimStatus}
              </Typography>
              {isSimulation(row) && (
                <SimulationNotice evidenceMode={row.evidenceMode} />
              )}
              {row.receiptCode ? (
                <Typography>
                  Merchant receipt: {row.merchantReceiptReference || row.receiptCode}
                </Typography>
              ) : (
                <Button
                  disabled={
                    working ||
                    !['UNCLAIMED', 'CLAIMED'].includes(row.claimStatus) ||
                    !row.recoveryRequired
                  }
                  onClick={() => {
                    setReceipt(row.merchantReceiptReference || '');
                    setChosen(row);
                  }}
                >
                  {row.recoveryRequired
                    ? isSimulation(row)
                      ? 'Resume simulation confirmation'
                      : 'Resume fulfillment confirmation'
                    : 'Review fulfillment'}
                </Button>
              )}
            </Paper>
          ))}
        {rows?.length === 0 && (
          <Typography>No merchant requests in your assigned scope.</Typography>
        )}
      </Stack>
      <Dialog
        open={!!chosen && outletReady}
        onClose={() => {
          if (!working) setChosen(null);
        }}
      >
        <DialogTitle>
          {isSimulation(chosen)
            ? 'Confirm ITEM simulation'
            : 'Confirm merchant fulfillment'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography>{chosen?.merchantLabel}</Typography>
          {isSimulation(chosen) && (
            <SimulationNotice evidenceMode={chosen?.evidenceMode} />
          )}
          {chosen?.pricedBenefit && (
            <Stack spacing={1}>
              <Typography>{chosen.pricedBenefit.sourceStage}</Typography>
              <Typography>{chosen.pricedBenefit.sourceReference}</Typography>
              {chosen.pricedBenefit.sourceStage === 'PRICED_CART' ? (
                <Typography>
                  {chosen.pricedBenefit.currency} /{' '}
                  {chosen.pricedBenefit.subtotalAmount} /{' '}
                  {chosen.pricedBenefit.discountAmount}
                </Typography>
              ) : (
                <Stack>
                  {chosen.pricedBenefit.items.map((item) => (
                    <Typography key={item.sku}>
                      {item.sku} / {item.quantity} {item.unit}
                    </Typography>
                  ))}
                </Stack>
              )}
              <Typography>
                {chosen.pricedBenefit.sourceRevision} / {chosen.pricedBenefit.storeCode}{' '}
                / {chosen.pricedBenefit.storeRevision}
              </Typography>
            </Stack>
          )}
          {chosen?.storeCode && (
            <Typography>
              {outlets?.stores.find((store) => store.code === chosen.storeCode)?.name ||
                chosen.storeCode}
            </Typography>
          )}
          <Typography>
            {isSimulation(chosen)
              ? 'Record the ITEM simulation. This does not verify goods delivery.'
              : 'Confirm that this coupon benefit has been fulfilled. This completes redemption and creates a receipt.'}
          </Typography>
          {chosen?.mode === 'MERCHANT_SCREEN' &&
            !outlets?.pricedSourceRequired &&
            !isSimulation(chosen) && (
              <>
                <Typography>
                  Enterprise: {chosen.merchantLabel}. Enter your transaction or receipt
                  reference after fulfilling this benefit.
                </Typography>
              </>
            )}
          {chosen?.mode === 'LOCAL_SAMPLE' && (
            <Alert severity="info">
              Local sample fulfillment. No external POS is contacted.
            </Alert>
          )}
          <TextField
            fullWidth
            label={
              outlets?.pricedSourceRequired
                ? outlets.pricedSourceLabel
                : 'Merchant transaction or receipt reference'
            }
            value={receipt}
            disabled={
              working ||
              chosen?.recoveryRequired === true ||
              outlets?.pricedSourceRequired === true
            }
            onChange={(e) => setReceipt(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={working} onClick={() => setChosen(null)}>
            Cancel
          </Button>
          <Button
            disabled={
              working ||
              !/^[A-Za-z0-9][A-Za-z0-9 ._:/@-]{2,119}$/.test(receipt.trim()) ||
              (!chosen?.recoveryRequired &&
                (!chosen?.validationCode ||
                  !chosen.validationExpiresAt ||
                  !Number.isFinite(Date.parse(chosen.validationExpiresAt)) ||
                  Date.parse(chosen.validationExpiresAt) <= Date.now()))
            }
            onClick={() => {
              void (async () => {
                if (!chosen || inFlight.current || workspacePending) return;
                inFlight.current = true;
                setBusy(true);
                setError('');
                const attempt = version.current;
                try {
                  const result = redemption(
                    await invokeOperationalOwner<Redemption>(
                      configuration,
                      'digitalCore',
                      '/merchant/redemptions/' +
                        encodeURIComponent(chosen.entitlementCode) +
                        '/confirm',
                      {
                        confirmed: true,
                        validationCode: chosen.validationCode,
                        validationExpiresAt: chosen.validationExpiresAt,
                        merchantReceiptReference: receipt.trim(),
                        expectedRevision: chosen.revision,
                        ...(chosen.storeCode ? { storeCode: chosen.storeCode } : {}),
                      },
                      'POST',
                      {
                        idempotencyKey:
                          chosen.confirmationKey || 'confirm:' + chosen.entitlementCode,
                      },
                    ),
                  );
                  if (
                    result.entitlementCode !== chosen.entitlementCode ||
                    result.claimStatus !== 'REDEEMED' ||
                    !result.receiptCode ||
                    (isSimulation(chosen) && !result.simulated) ||
                    (outlets?.pricedSourceRequired &&
                      (result.merchantReceiptReference !== receipt.trim() ||
                        result.storeCode !== chosen.storeCode ||
                        result.storeRevision !== chosen.storeRevision))
                  )
                    throw new Error(
                      'Fulfillment outcome is unconfirmed. Inspect merchant requests before another confirmation.',
                    );
                  if (attempt === version.current) {
                    setChosen(null);
                    await load(true);
                  }
                } catch {
                  if (attempt === version.current) {
                    setChosen(null);
                    setRows(null);
                    setError(
                      'Fulfillment outcome is unconfirmed. Inspect merchant requests before another confirmation.',
                    );
                  }
                } finally {
                  if (attempt === version.current) {
                    setBusy(false);
                    inFlight.current = false;
                  }
                }
              })();
            }}
          >
            {isSimulation(chosen) ? 'Confirm simulation' : 'Confirm fulfillment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
