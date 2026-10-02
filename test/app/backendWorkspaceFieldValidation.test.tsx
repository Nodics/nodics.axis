/** Metadata-driven form feedback; mocked owner responses are not live creation acceptance. */
import { render, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import type {
  AxisBackendWorkspace,
  AxisBackendWorkspaceField,
} from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};
const fields: readonly AxisBackendWorkspaceField[] = [
  { name: 'code', label: 'Enterprise code', type: 'TEXT', required: true },
  { name: 'name', label: 'Enterprise name', type: 'TEXT', required: true },
  { name: 'adminEmail', label: 'Administrator email', type: 'EMAIL', required: true },
  { name: 'secondaryEmail', label: 'Secondary email', type: 'EMAIL', required: false },
  { name: 'idempotencyKey', label: 'Reference', type: 'IDEMPOTENCY', required: true },
];

function renderForm(
  extraFields: readonly AxisBackendWorkspaceField[] = [],
  desktopBreakpoint = 900,
) {
  const workspace: AxisBackendWorkspace = {
    contractVersion: 0,
    title: 'Enterprise Management',
    renderer: 'axis.workspace.backend-operations',
    defaultTab: 'enterprises',
    tabs: [
      {
        id: 'enterprises',
        label: 'Enterprises',
        sections: [
          {
            id: 'create-enterprise',
            type: 'form',
            title: 'Create Enterprise',
            submitLabel: 'Create enterprise',
            endpoint: {
              method: 'POST',
              path: '/nodics/profile/v0/enterprises',
              bodyShape: 'MODEL',
              idempotencyField: 'idempotencyKey',
            },
            fields: [...fields, ...extraFields],
          },
        ],
      },
    ],
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: { code: 'acceptance' } }), { status: 200 }),
    );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <ThemeProvider
      theme={createTheme({
        breakpoints: {
          values: { xs: 0, sm: 600, md: desktopBreakpoint, lg: 1200, xl: 1536 },
        },
      })}
    >
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          workspace={workspace}
          runtime={runtime}
          accessToken="test-session"
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return fetchMock;
}

async function fillRequired(email = 'admin@axis-onboarding-acceptance.test') {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Enterprise code' }),
    'acceptance',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Enterprise name' }),
    'Acceptance',
  );
  await user.type(screen.getByRole('textbox', { name: 'Administrator email' }), email);
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('metadata-driven field validation', () => {
  it.each([900, 1024])(
    'keeps mobile fields shrinkable and content-height with desktop breakpoint %i',
    async (desktopBreakpoint) => {
      const fetchMock = renderForm([], desktopBreakpoint);
      await fillRequired();
      const email = screen.getByRole('textbox', { name: 'Administrator email' });
      const fieldset = email.closest('fieldset');
      expect(fieldset).not.toBeNull();
      const wrapper = fieldset!.parentElement!;
      const selector = `.${wrapper.classList.item(wrapper.classList.length - 1)}`;
      const rules = Array.from(document.styleSheets).flatMap((sheet) =>
        Array.from(sheet.cssRules),
      );
      const responsive = rules
        .filter((rule) => rule instanceof CSSMediaRule)
        .map((rule) => ({
          media: rule.conditionText,
          style: Array.from(rule.cssRules).find(
            (child) => child instanceof CSSStyleRule && child.selectorText === selector,
          ) as CSSStyleRule | undefined,
        }))
        .filter((rule) => rule.style);
      const mobile = responsive.find((rule) => rule.media === '(min-width:0px)');
      const desktop = responsive.find(
        (rule) => rule.media === `(min-width:${String(desktopBreakpoint)}px)`,
      );
      expect(mobile?.style?.style.getPropertyValue('flex')).toBe('0 1 auto');
      expect(mobile?.style?.style.getPropertyValue('width')).toBe('100%');
      expect(mobile?.style?.style.getPropertyValue('min-width')).toBe('0px');
      expect(desktop?.style?.style.getPropertyValue('flex')).toBe('1 1 240px');
      expect(desktop?.style?.style.getPropertyValue('width')).toBe('auto');
      expect(desktop?.style?.style.getPropertyValue('min-width')).toBe('240px');
      expect(wrapper).toHaveStyle({ maxWidth: '100%' });
      expect(fieldset).toHaveStyle({
        minWidth: '0px',
        width: '100%',
        boxSizing: 'border-box',
      });
      expect(email).toHaveValue('admin@axis-onboarding-acceptance.test');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('shows all required errors beside their controls and focuses the first without a request', async () => {
    const fetchMock = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create enterprise' }));
    for (const label of ['Enterprise code', 'Enterprise name', 'Administrator email']) {
      const control = screen.getByRole('textbox', { name: label });
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAccessibleDescription(`${label} is required.`);
    }
    expect(screen.getByRole('textbox', { name: 'Enterprise code' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves valid values, focuses invalid email, clears corrected feedback and sends only on explicit resubmission', async () => {
    const fetchMock = renderForm();
    const user = await fillRequired('invalid-email');
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    const email = screen.getByRole('textbox', { name: 'Administrator email' });
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByRole('textbox', { name: 'Enterprise code' })).toHaveValue(
      'acceptance',
    );
    expect(screen.getByRole('textbox', { name: 'Enterprise name' })).toHaveValue(
      'Acceptance',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(email);
    await user.type(email, 'admin@axis-onboarding-acceptance.test');
    expect(email).toHaveAttribute('aria-invalid', 'false');
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    await screen.findByText('Request completed.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      model: {
        code: 'acceptance',
        name: 'Acceptance',
        adminEmail: 'admin@axis-onboarding-acceptance.test',
        secondaryEmail: '',
      },
    });
    expect(new Headers(init.headers).get('Idempotency-Key')).toMatch(
      /^create-enterprise-/,
    );
  });

  it('validates nonempty optional email without making it required', async () => {
    const fetchMock = renderForm();
    const user = await fillRequired();
    const optional = screen.getByRole('textbox', { name: 'Secondary email' });
    await user.type(optional, 'missing-domain@');
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    expect(optional).toHaveFocus();
    expect(optional).toHaveAccessibleDescription('Enter a valid email address.');
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(optional);
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    await screen.findByText('Request completed.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects whitespace-only required values without discarding them', async () => {
    const fetchMock = renderForm();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise code' }),
      '   ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create enterprise' }));
    expect(screen.getByRole('textbox', { name: 'Enterprise code' })).toHaveValue('   ');
    expect(screen.getByRole('textbox', { name: 'Enterprise code' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['SELECT', 'MULTISELECT'] as const)(
    'associates required %s feedback and focuses the selector',
    async (type) => {
      const fetchMock = renderForm([
        {
          name: 'role',
          label: 'Enterprise roles',
          type,
          required: true,
          options: [{ value: 'PARTNER', label: 'Partner' }],
        },
      ]);
      const user = await fillRequired();
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      const selector = screen.getByRole('combobox', { name: 'Enterprise roles' });
      expect(selector).toHaveFocus();
      expect(selector).toHaveAccessibleDescription('Enterprise roles is required.');
      expect(fetchMock).not.toHaveBeenCalled();
      await user.click(selector);
      await user.click(screen.getByRole('option', { name: 'Partner' }));
      expect(
        screen.queryByText('Enterprise roles is required.'),
      ).not.toBeInTheDocument();
    },
  );

  it('does not reinterpret a required boolean as a policy requiring true', async () => {
    const fetchMock = renderForm([
      { name: 'enabled', label: 'Enabled', type: 'CHECKBOX', required: true },
    ]);
    const user = await fillRequired();
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    await screen.findByText('Request completed.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps owner rejection visible, retains values and does not retry automatically', async () => {
    const fetchMock = renderForm();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Enterprise already exists.' }), {
        status: 409,
      }),
    );
    const user = await fillRequired();
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Enterprise already exists.'),
    );
    expect(screen.getByRole('textbox', { name: 'Enterprise code' })).toHaveValue(
      'acceptance',
    );
    expect(screen.getByRole('textbox', { name: 'Administrator email' })).toHaveValue(
      'admin@axis-onboarding-acceptance.test',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
