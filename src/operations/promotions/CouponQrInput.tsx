/** Local QR image decoding only. Scanning selects a code; the existing staff validate/confirm commands retain all authority. */
import { useEffect, useEffectEvent, useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';

type DetectorConstructor = new (options: { formats: string[] }) => {
  detect(source: ImageBitmap): Promise<{ rawValue: string; format?: string }[]>;
};
type BarcodeBrowser = typeof globalThis & { BarcodeDetector?: DetectorConstructor };

/** QR payloads are literal tokens, not URLs, executable links or encoded commands. */
function couponQrToken(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value.trim())
  )
    throw new Error('The image must contain one coupon code.');
  return value.trim().toUpperCase();
}

/** Supports device-camera image capture where the browser offers it; manual input remains available otherwise. */
export function CouponQrInput({
  disabled,
  authority,
  scope,
  onToken,
  onError,
}: {
  disabled: boolean;
  authority: object;
  scope: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const [sequence] = useState(() => ({ value: 0 })),
    [busy, setBusy] = useState(false);
  const reset = useEffectEvent(() => setBusy(false));
  useEffect(() => {
    sequence.value++;
    reset();
    return () => {
      sequence.value++;
    };
  }, [authority, scope, disabled, sequence]);
  const Detector = (globalThis as BarcodeBrowser).BarcodeDetector,
    supported = !!Detector && typeof createImageBitmap === 'function';
  return (
    <Tooltip
      title={
        supported
          ? 'Scan coupon QR image'
          : 'QR image scanning is unavailable in this browser'
      }
    >
      <span>
        <Button
          component="label"
          disabled={disabled || busy || !supported}
          startIcon={<ShellIcon name="media" />}
        >
          Scan QR image
          <input
            aria-label="Coupon QR image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            hidden
            disabled={disabled || busy || !supported}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file || !Detector || disabled || busy) return;
              const attempt = ++sequence.value;
              setBusy(true);
              void (async () => {
                let bitmap: ImageBitmap | undefined;
                try {
                  if (
                    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                    file.size > 10 * 1024 * 1024
                  )
                    throw new Error('Choose a PNG, JPEG or WebP image up to 10 MB.');
                  bitmap = await createImageBitmap(file);
                  if (bitmap.width * bitmap.height > 25000000)
                    throw new Error('The QR image is too large.');
                  const results = await new Detector({ formats: ['qr_code'] }).detect(
                    bitmap,
                  );
                  if (
                    results.length !== 1 ||
                    (results[0]?.format !== undefined &&
                      results[0].format !== 'qr_code')
                  )
                    throw new Error('The image must contain one coupon code.');
                  const token = couponQrToken(results[0]?.rawValue);
                  if (attempt === sequence.value) onToken(token);
                } catch (error) {
                  if (attempt === sequence.value)
                    onError(
                      error instanceof Error
                        ? error.message
                        : 'The QR image could not be read.',
                    );
                } finally {
                  bitmap?.close();
                  if (attempt === sequence.value) setBusy(false);
                }
              })();
            }}
          />
        </Button>
      </span>
    </Tooltip>
  );
}
