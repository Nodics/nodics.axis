import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import { MediaImageIntakePanel } from '../../../../src/operations/mediaManagement/components/MediaImageIntakePanel';
import {
  imageIntakeCopyKeys,
  type PreparedMediaImage,
} from '../../../../src/operations/mediaManagement/api/mediaImageIntakeClient';
const api = vi.hoisted(() => ({ prepare: vi.fn(), upload: vi.fn(), inspect: vi.fn() }));
vi.mock(
  '../../../../src/operations/mediaManagement/api/mediaImageIntakeClient',
  async (original) => ({
    ...(await original<
      typeof import('../../../../src/operations/mediaManagement/api/mediaImageIntakeClient')
    >()),
    prepareMediaImage: api.prepare,
    uploadPreparedMediaImage: api.upload,
    inspectMediaImage: api.inspect,
  }),
);
const file = new File(['asset'], 'picture.png', { type: 'image/png' });
const prepared = {
  file,
  purpose: 'Content images',
  descriptor: { mediaCode: 'axis-image-original', name: file.name },
} as PreparedMediaImage;
const props = () => ({
  source: {
    moduleName: 'media',
    instanceId: 'staged',
    endpoint: 'http://localhost:4312/nodics/media',
    state: 'UP',
    runtimeRole: { publication: 'STAGED' },
  } as AxisModuleConnection,
  configuration: { accessToken: 'employee', enterpriseCode: 'acme', timeoutMs: 1000 },
  definition: {
    contextCode: 'contentMedia',
    presentation: Object.fromEntries(
      imageIntakeCopyKeys.map((key) => [key, key]),
    ) as Record<(typeof imageIntakeCopyKeys)[number], string>,
  },
  target: { moduleName: 'editorial', schemaName: 'editorialArticle' },
  disabled: false,
  onApply: vi.fn(),
  onBusyChange: vi.fn(),
  onSelectionChange: vi.fn(),
});
async function review(container: HTMLElement) {
  const user = userEvent.setup();
  await user.upload(container.querySelector('input[type=file]')!, file);
  await user.click(screen.getByRole('button', { name: 'check' }));
  await screen.findByRole('button', { name: 'upload' });
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  api.prepare.mockResolvedValue(prepared);
  api.upload.mockResolvedValue({
    code: prepared.descriptor.mediaCode,
    name: file.name,
  });
  api.inspect.mockResolvedValue('UNCONFIRMED');
});
describe('Media image explicit business journey', () => {
  it('qualifies without uploading, dispatches once, and changes the draft only after explicit association', async () => {
    const p = props(),
      { container } = render(<MediaImageIntakePanel {...p} />);
    const user = await review(container);
    expect(api.upload).not.toHaveBeenCalled();
    expect(p.onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'upload' }));
    await screen.findByRole('button', { name: 'apply' });
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(p.onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'upload' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'apply' }));
    expect(p.onApply).toHaveBeenCalledExactlyOnceWith({
      code: 'axis-image-original',
      name: file.name,
    });
    expect(screen.getByText('applied')).toBeInTheDocument();
  });
  it('retains the original reference on uncertain upload and never resends on repeated or absent inspection', async () => {
    api.upload.mockRejectedValue(new Error('response lost'));
    const p = props(),
      { container } = render(<MediaImageIntakePanel {...p} />),
      user = await review(container);
    await user.click(screen.getByRole('button', { name: 'upload' }));
    await screen.findByRole('button', { name: 'inspect' });
    for (const outcome of ['ABSENT', 'UNCONFIRMED', 'CONFIRMED']) {
      api.inspect.mockResolvedValueOnce(outcome);
      await user.click(screen.getByRole('button', { name: 'inspect' }));
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    }
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.inspect).toHaveBeenCalledTimes(3);
    for (const call of api.inspect.mock.calls) expect(call[2]).toBe(prepared);
    expect(p.onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'apply' }));
    expect(p.onApply).toHaveBeenCalledTimes(1);
  });
  it('retires a delayed upload after the private owner scope unmounts', async () => {
    let finish!: (result: unknown) => void;
    api.upload.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const p = props(),
      view = render(<MediaImageIntakePanel {...p} />),
      user = await review(view.container);
    await user.click(screen.getByRole('button', { name: 'upload' }));
    expect(p.onBusyChange).toHaveBeenLastCalledWith(true);
    view.unmount();
    await act(async () => {
      finish({ code: 'axis-image-original', name: file.name });
      await Promise.resolve();
    });
    expect(p.onApply).not.toHaveBeenCalled();
    expect(p.onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('holds policy failures before dispatch and leaves a new file selectable', async () => {
    api.prepare.mockRejectedValue(new Error('denied'));
    const p = props(),
      view = render(<MediaImageIntakePanel {...p} />),
      user = userEvent.setup();
    await user.upload(view.container.querySelector('input[type=file]')!, file);
    await user.click(screen.getByRole('button', { name: 'check' }));
    await screen.findByText('failed');
    expect(api.upload).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'upload' })).not.toBeInTheDocument();
  });
});
