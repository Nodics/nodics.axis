/** Isolated presentation fixtures; no owner authority or endpoints are mocked into existence. NOT RUN. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  EnterpriseAdministrationTaskRenderer,
  type EnterpriseAdministrationTaskPresentation,
} from '../../src/operations/enterprise/EnterpriseAdministrationTaskRenderer';
const presentation = Object.fromEntries(
  [
    'title',
    'inspectLabel',
    'emptyMessage',
    'workingLabel',
    'reviewTitle',
    'confirmLabel',
    'cancelLabel',
    'uncertainMessage',
    'unavailableMessage',
    'recordedMessage',
  ].map((key) => [key, key]),
) as unknown as EnterpriseAdministrationTaskPresentation;
const command = {
  code: 'opaque-owner-command',
  label: 'Owner action',
  enabled: true,
  summary: [{ label: 'Reviewed reference', value: 'opaque-assignment' }],
};
it('reviews before executing and requires inspection after an uncertain command', async () => {
  const execute = vi.fn().mockResolvedValue('UNCONFIRMED'),
    inspect = vi.fn().mockResolvedValue('INSPECTED');
  const user = userEvent.setup();
  render(
    <EnterpriseAdministrationTaskRenderer
      context={{}}
      presentation={presentation}
      commands={[command]}
      inspect={inspect}
      execute={execute}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Owner action' }));
  expect(execute).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('uncertainMessage');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(execute).toHaveBeenCalledWith(command);
  expect(screen.getByRole('button', { name: 'Owner action' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'inspectLabel' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Owner action' })).toBeEnabled(),
  );
  expect(execute).toHaveBeenCalledTimes(1);
});
it('displays an owner-disabled gate without granting authority locally', () => {
  const execute = vi.fn();
  render(
    <EnterpriseAdministrationTaskRenderer
      context={{}}
      presentation={presentation}
      commands={[
        {
          ...command,
          enabled: false,
          disabledMessage: 'Owner qualification unavailable',
        },
      ]}
      inspect={vi.fn()}
      execute={execute}
    />,
  );
  expect(screen.getByRole('button', { name: 'Owner action' })).toBeDisabled();
  expect(screen.getByText('Owner qualification unavailable')).toBeVisible();
  expect(execute).not.toHaveBeenCalled();
});
it('discards a late command outcome after the actor or enterprise context changes', async () => {
  let finish!: (value: 'CONFIRMED') => void;
  const execute = vi.fn(
    () =>
      new Promise<'CONFIRMED'>((resolve) => {
        finish = resolve;
      }),
  );
  const inspect = vi.fn().mockResolvedValue('INSPECTED'),
    commands = [command];
  const user = userEvent.setup();
  const view = render(
    <EnterpriseAdministrationTaskRenderer
      context={{}}
      presentation={presentation}
      commands={commands}
      inspect={inspect}
      execute={execute}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Owner action' }));
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  view.rerender(
    <EnterpriseAdministrationTaskRenderer
      context={{}}
      presentation={presentation}
      commands={[]}
      inspect={inspect}
      execute={execute}
    />,
  );
  await act(async () => {
    finish('CONFIRMED');
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByText('recordedMessage')).toBeNull();
});
