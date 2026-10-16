/** Business-label selection fixtures; no permission catalogue, assignments or mutation authority live in Axis. */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  EnterpriseBusinessAccessSelector,
  EnterpriseBusinessAccessTable,
  type EnterpriseBusinessAccessSelection,
} from '../../src/operations/enterprise/EnterpriseAdministrationTaskRenderer';
import { parseBusinessAccessContract } from '../../src/operations/enterprise/api/businessAccessContract';
import { parseBackendWorkspace } from '../../src/bootstrap/publicBootstrap';

const contract = () => ({
  contractVersion: 1,
  presentation: {
    employeeLabel: 'Employee',
    areaLabel: 'Business area',
    levelLabel: 'Access level',
    scopeLabel: 'Enterprise scope',
    noAccess: 'No access',
    view: 'View',
    edit: 'Edit',
    fullControl: 'Full control',
  },
  businessAreas: [
    {
      code: 'products',
      label: 'Products',
      ownerModule: 'product',
      scopeType: 'ENTERPRISE',
      levels: [
        { value: 'view', roleCode: 'PRODUCT_VIEW' },
        { value: 'edit', roleCode: 'PRODUCT_EDIT' },
        { value: 'fullControl', roleCode: 'PRODUCT_FULL_CONTROL' },
      ],
    },
    {
      code: 'content',
      label: 'Content',
      ownerModule: 'cms',
      scopeType: 'ENTERPRISE',
      levels: [{ value: 'view', roleCode: 'CONTENT_VIEW' }],
    },
  ],
});

it('edits multiple areas independently and retains other selections when one becomes No access', async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  function Form() {
    const [selections, setSelections] = useState<
      readonly EnterpriseBusinessAccessSelection[]
    >([
      { businessArea: 'products', accessLevel: 'edit' },
      { businessArea: 'content', accessLevel: 'view' },
    ]);
    return (
      <EnterpriseBusinessAccessTable
        contract={parseBusinessAccessContract(contract())}
        selections={selections}
        scope="Business"
        onChange={(next) => {
          change(next);
          setSelections(next);
        }}
      />
    );
  }
  render(<Form />);
  await user.click(screen.getByRole('combobox', { name: 'Products: Access level' }));
  await user.click(screen.getByRole('option', { name: 'No access' }));
  expect(change).toHaveBeenLastCalledWith([
    { businessArea: 'content', accessLevel: 'view' },
    { businessArea: 'products', accessLevel: 'noAccess' },
  ]);
  expect(
    screen.getByRole('combobox', { name: 'Content: Access level' }),
  ).toHaveTextContent('View');
  await user.click(screen.getByRole('combobox', { name: 'Content: Access level' }));
  expect(screen.queryByRole('option', { name: 'Edit' })).toBeNull();
  expect(screen.queryByText('PRODUCT_EDIT')).toBeNull();
});

it('disables every area while a reviewed command is held', () => {
  render(
    <EnterpriseBusinessAccessTable
      contract={parseBusinessAccessContract(contract())}
      selections={[]}
      scope="Business"
      disabled
      onChange={vi.fn()}
    />,
  );
  for (const control of screen.getAllByRole('combobox')) {
    expect(control).toHaveAttribute('aria-disabled', 'true');
  }
});

it('selects backend business levels without exposing internal role codes or a legacy job-role catalogue', async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  const value = parseBusinessAccessContract(contract());
  function Form() {
    const [role, setRole] = useState('');
    return (
      <EnterpriseBusinessAccessSelector
        contract={value}
        roleCode={role}
        onChange={(role) => {
          change(role);
          setRole(role);
        }}
      />
    );
  }
  render(<Form />);
  expect(screen.getByRole('combobox', { name: 'Access level' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.click(screen.getByRole('combobox', { name: 'Business area' }));
  await user.click(screen.getByRole('option', { name: 'Products' }));
  await user.click(screen.getByRole('combobox', { name: 'Access level' }));
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'No access',
    'View',
    'Edit',
    'Full control',
  ]);
  await user.click(screen.getByRole('option', { name: 'Edit' }));
  expect(change).toHaveBeenLastCalledWith('PRODUCT_EDIT');
  expect(screen.queryByText('PRODUCT_EDIT')).toBeNull();
  await user.click(screen.getByRole('combobox', { name: 'Business area' }));
  await user.click(screen.getByRole('option', { name: 'Content' }));
  expect(change).toHaveBeenLastCalledWith('');
  await user.click(screen.getByRole('combobox', { name: 'Access level' }));
  expect(screen.queryByRole('option', { name: 'Edit' })).toBeNull();
});

it('an empty draft is not a revoke command', async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <EnterpriseBusinessAccessSelector
      contract={parseBusinessAccessContract(contract())}
      roleCode="PRODUCT_VIEW"
      onChange={change}
    />,
  );
  await user.click(screen.getByRole('combobox', { name: 'Access level' }));
  await user.click(screen.getByRole('option', { name: 'No access' }));
  expect(change).toHaveBeenCalledExactlyOnceWith('');
});

it('rejects ambiguous mappings, unsupported scopes and malformed presentation', () => {
  const duplicate = contract();
  duplicate.businessAreas[0]!.levels.push({ value: 'view', roleCode: 'OTHER' });
  expect(() => parseBusinessAccessContract(duplicate)).toThrow();
  const foreign = contract();
  foreign.businessAreas[0]!.scopeType = 'GLOBAL';
  expect(() => parseBusinessAccessContract(foreign)).toThrow();
  const reused = contract();
  reused.businessAreas[1]!.levels[0]!.roleCode = 'PRODUCT_VIEW';
  expect(() => parseBusinessAccessContract(reused)).toThrow();
  const invalid = contract();
  invalid.presentation.edit = '';
  expect(() => parseBusinessAccessContract(invalid)).toThrow();
});

it('the generic workspace parser retains the typed business selector contract', () => {
  const value = parseBackendWorkspace({
    contractVersion: 1,
    renderer: 'axis.workspace.backend-operations',
    title: 'Access',
    defaultTab: 'invite',
    tabs: [
      {
        id: 'invite',
        label: 'Invite',
        sections: [
          {
            id: 'invite',
            type: 'form',
            title: 'Invite',
            submitLabel: 'Invite',
            endpoint: {
              method: 'POST',
              path: '/nodics/profile/v0/enterprises/{enterpriseCode}/access-assignments',
            },
            fields: [
              {
                name: 'roleCode',
                label: 'Access',
                type: 'BUSINESS_ACCESS',
                required: true,
                businessAccess: contract(),
              },
            ],
          },
        ],
      },
    ],
  });
  expect(
    value.tabs[0]!.sections[0]!.fields![0]!.businessAccess?.businessAreas,
  ).toHaveLength(2);
});
