import { describe, expect, it } from 'vitest';

import { composeShellNavigation } from '../../../src/app/shell/shellNavigation';

describe('Axis shell navigation composition', () => {
  it('keeps the local dashboard and groups backend-authorized capabilities', () => {
    const groups = composeShellNavigation([
      {
        id: 'cms',
        label: 'Content',
        route: '/content',
        order: 200,
        moduleName: 'cms',
        category: 'content',
        icon: 'content',
        availability: 'UP',
      },
      {
        id: 'pricing',
        label: 'Pricing',
        route: '/pricing',
        order: 420,
        moduleName: 'pricing',
        category: 'commerce',
        icon: 'price',
        availability: 'DEGRADED',
      },
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      'Workspace',
      'Content and Experience',
      'Commerce',
    ]);
    expect(groups[0]?.items[0]).toEqual(
      expect.objectContaining({ label: 'Dashboard', local: true }),
    );
    expect(groups[2]?.items[0]).toEqual(
      expect.objectContaining({ label: 'Pricing', availability: 'DEGRADED' }),
    );
  });

  it('uses backend-owned groups and places children directly after their parent', () => {
    const group = { id: 'operations', label: 'Operations', order: 600 };
    const groups = composeShellNavigation([
      {
        id: 'administration',
        label: 'Administration',
        route: '/administration',
        order: 10,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'registry',
        availability: 'UP',
        group,
      },
      {
        id: 'registry',
        parentId: 'administration',
        label: 'Module Registry',
        route: '/registry',
        order: 20,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'registry',
        availability: 'UP',
        group,
      },
    ]);

    const operations = groups.find((entry) => entry.id === 'operations');
    expect(operations?.items.map((item) => [item.id, item.depth])).toEqual([
      ['administration', 0],
      ['registry', 1],
    ]);
    expect(operations?.items[0]?.hasChildren).toBe(true);
  });

  it('places explicit cross-module children below their backend-owned parent', () => {
    const group = { id: 'commerce', label: 'Commerce', order: 300 };
    const groups = composeShellNavigation([
      {
        id: 'commerce-operations',
        label: 'Commerce Operations',
        route: '/commerce/operations',
        order: 500,
        moduleName: 'nodics.commerce',
        category: 'commerce',
        icon: 'commerce',
        availability: 'UP',
        group,
      },
      {
        id: 'pricing',
        parentId: 'commerce-operations',
        parentModuleName: 'nodics.commerce',
        label: 'Pricing',
        route: '/commerce/operations/pricing',
        order: 520,
        moduleName: 'pricing',
        category: 'commerce',
        icon: 'pricing',
        availability: 'UP',
        group,
      },
    ]);

    const commerce = groups.find((entry) => entry.id === 'commerce');
    expect(
      commerce?.items.map((item) => [item.moduleName, item.id, item.depth]),
    ).toEqual([
      ['nodics.commerce', 'commerce-operations', 0],
      ['pricing', 'pricing', 1],
    ]);
    expect(commerce?.items[0]?.hasChildren).toBe(true);
  });

  it('keeps backend-driven payment operations as an expandable operations group', () => {
    const group = {
      id: 'payment-operations',
      label: 'Payment Operations',
      order: 360,
    };
    const groups = composeShellNavigation([
      {
        id: 'payment-operations',
        label: 'Payment Operations',
        route: '/commerce/payments',
        order: 360,
        moduleName: 'payment',
        category: 'commerce',
        icon: 'payment',
        availability: 'UP',
        group,
        workbenchTarget: {
          moduleName: 'payment',
          schemaName: 'paymentTransaction',
        },
      },
      {
        id: 'payment-methods',
        parentId: 'payment-operations',
        label: 'Payment Methods',
        route: '/commerce/payments/methods',
        order: 362,
        moduleName: 'payment',
        category: 'commerce',
        icon: 'payment',
        availability: 'UP',
        group,
        workbenchTarget: {
          moduleName: 'payment',
          schemaName: 'paymentMethod',
        },
      },
      {
        id: 'payment-providers',
        parentId: 'payment-operations',
        label: 'Payment Providers',
        route: '/commerce/payments/providers',
        order: 364,
        moduleName: 'payment',
        category: 'commerce',
        icon: 'payment',
        availability: 'UP',
        group,
        workbenchTarget: {
          moduleName: 'payment',
          schemaName: 'paymentProvider',
        },
      },
    ]);

    const paymentOperations = groups.find((entry) => entry.id === 'payment-operations');
    expect(
      paymentOperations?.items.map((item) => [item.id, item.depth, item.hasChildren]),
    ).toEqual([
      ['payment-operations', 0, true],
      ['payment-methods', 1, false],
      ['payment-providers', 1, false],
    ]);
  });
});
