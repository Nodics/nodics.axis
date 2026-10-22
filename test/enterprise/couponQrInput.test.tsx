/** QR selection never validates or redeems; stale image work cannot override changed staff/manual scope. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CouponQrInput } from '../../src/operations/promotions/CouponQrInput';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const close = vi.fn(),
    detect = vi.fn<() => Promise<{ rawValue: string; format: string }[]>>();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 100, height: 100, close }),
  );
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      detect = detect;
    },
  );
  const props = {
    disabled: false,
    authority: {},
    scope: 'outlet/manual',
    onToken: vi.fn(),
    onError: vi.fn(),
  };
  const view = render(<CouponQrInput {...props} />);
  const upload = () =>
    fireEvent.change(screen.getByLabelText('Coupon QR image'), {
      target: { files: [new File(['image'], 'coupon.png', { type: 'image/png' })] },
    });
  return { props, view, detect, upload, close };
}

it('selects one literal code without owner calls and refuses URL payloads', async () => {
  const f = fixture();
  f.detect.mockResolvedValue([{ rawValue: 'coupon-123', format: 'qr_code' }]);
  f.upload();
  await waitFor(() => expect(f.props.onToken).toHaveBeenCalledWith('COUPON-123'));
  expect(f.close).toHaveBeenCalledTimes(1);
  f.detect.mockResolvedValue([
    { rawValue: 'https://foreign.example/code', format: 'qr_code' },
  ]);
  f.upload();
  await waitFor(() => expect(f.props.onError).toHaveBeenCalledOnce());
  expect(f.props.onToken).toHaveBeenCalledTimes(1);
});

it('retires pending image results when manual text, outlet or authority changes', async () => {
  const f = fixture();
  let finish!: (rows: { rawValue: string; format: string }[]) => void;
  f.detect.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  f.upload();
  await waitFor(() => expect(f.detect).toHaveBeenCalledOnce());
  f.view.rerender(<CouponQrInput {...f.props} scope="outlet/new-manual-code" />);
  await act(async () => {
    finish([{ rawValue: 'OLD-CODE', format: 'qr_code' }]);
    await Promise.resolve();
  });
  expect(f.props.onToken).not.toHaveBeenCalled();
  expect(f.props.onError).not.toHaveBeenCalled();
  expect(f.close).toHaveBeenCalledOnce();
});

it('does not enable an unsupported browser scanner', () => {
  vi.stubGlobal('BarcodeDetector', undefined);
  render(
    <CouponQrInput
      disabled={false}
      authority={{}}
      scope="outlet"
      onToken={vi.fn()}
      onError={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('Coupon QR image')).toBeDisabled();
});
