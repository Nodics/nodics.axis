import { describe, expect, it } from 'vitest';

import { composeShellNavigation } from '../../../src/app/shell/shellNavigation';

describe('Axis shell navigation composition', () => {
  it('does not synthesize a local dashboard and groups backend capabilities by business area', () => {
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
      'Content & Experience',
      'Products & Merchandising',
    ]);
    expect(groups[1]?.items[0]).toEqual(
      expect.objectContaining({ label: 'Pricing', availability: 'DEGRADED' }),
    );
  });

  it('uses backend-owned groups and places children directly after their parent', () => {
    const groups = composeShellNavigation([
      {
        id: 'system-integrations',
        label: 'System Workspace',
        route: '/system-integrations',
        order: 5,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'operations',
        availability: 'UP',
      },
      {
        id: 'dashboard',
        parentId: 'system-integrations',
        label: 'Dashboard',
        route: '/dashboard',
        order: 900,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'dashboard',
        availability: 'UP',
      },
      {
        id: 'administration',
        label: 'Administration',
        route: '/administration',
        order: 10,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'registry',
        availability: 'UP',
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
      },
    ]);

    const operations = groups.find((entry) => entry.id === 'system-integrations');
    expect(operations?.items.map((item) => [item.id, item.depth])).toEqual([
      ['system-integrations', 0],
      ['dashboard', 1],
      ['administration', 0],
      ['registry', 1],
    ]);
    expect(operations?.items[2]?.hasChildren).toBe(true);
  });

  it('renders the backend-owned dashboard under System Workspace without marking it local', () => {
    const groups = composeShellNavigation([
      {
        id: 'system-integrations',
        label: 'System Workspace',
        route: '/system-integrations',
        order: 90,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'operations',
        availability: 'UP',
      },
      {
        id: 'dashboard',
        parentId: 'system-integrations',
        label: 'Dashboard',
        route: '/dashboard',
        order: 900,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'dashboard',
        availability: 'UP',
      },
      {
        id: 'overall-runtime-status',
        parentId: 'system-integrations',
        label: 'Overall Runtime Status',
        route: '/system-integrations',
        order: 901,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'operations',
        availability: 'UP',
      },
    ]);

    const operations = groups.find((entry) => entry.id === 'system-integrations');
    expect(
      operations?.items.map((item) => [item.id, item.route, item.depth, item.local]),
    ).toEqual([
      ['system-integrations', '/system-integrations', 0, false],
      ['dashboard', '/dashboard', 1, false],
      ['overall-runtime-status', '/system-integrations', 1, false],
    ]);
  });

  it('keeps the documentation dashboard visible in its backend-owned group', () => {
    const groups = composeShellNavigation([
      {
        id: 'content-dashboard',
        label: 'Dashboard',
        route: '/content',
        order: 200,
        moduleName: 'wcms',
        category: 'content',
        icon: 'content',
        availability: 'UP',
      },
      {
        id: 'documentation-dashboard',
        label: 'Dashboard',
        route: '/docs',
        order: 105,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'content',
        availability: 'UP',
        featureState: 'ACTIVE',
        group: { id: 'documentation', label: 'Documentation', order: 1600 },
      },
      {
        id: 'documentation-framework',
        label: 'Framework',
        route: '/docs/framework',
        order: 110,
        moduleName: 'backoffice',
        category: 'platform',
        icon: 'content',
        availability: 'UP',
        featureState: 'DISABLED',
        group: { id: 'documentation', label: 'Documentation', order: 1600 },
      },
    ]);

    expect(groups.map((group) => group.id)).toEqual(['content', 'documentation']);
    expect(groups[1]).toEqual(
      expect.objectContaining({
        id: 'documentation',
        label: 'Documentation',
        items: [
          expect.objectContaining({
            id: 'documentation-dashboard',
            label: 'Dashboard',
            route: '/docs',
          }),
        ],
      }),
    );
  });

  it('moves WCMS page composition items out of system operations into content experience', () => {
    const groups = composeShellNavigation([
      {
        id: 'wcms',
        label: 'Web Content Management System',
        route: '/content',
        order: 100,
        moduleName: 'cms',
        category: 'platform',
        icon: 'content',
        availability: 'UP',
      },
      {
        id: 'renderer-mappings',
        parentId: 'wcms',
        label: 'Renderer Mappings',
        route: '/content/renderer-mappings',
        order: 110,
        moduleName: 'cms',
        category: 'platform',
        icon: 'content',
        availability: 'UP',
      },
      {
        id: 'assigned-work',
        label: 'Assigned to Me',
        route: '/work/assigned',
        order: 120,
        moduleName: 'workflow',
        category: 'platform',
        icon: 'task',
        availability: 'UP',
      },
    ]);

    const content = groups.find((entry) => entry.id === 'content');
    const process = groups.find((entry) => entry.id === 'process-and-automations');

    expect(groups.find((entry) => entry.id === 'system-integrations')).toBeUndefined();
    expect(content?.items.map((item) => [item.id, item.depth])).toEqual([
      ['wcms', 0],
      ['renderer-mappings', 1],
    ]);
    expect(process?.items.map((item) => item.id)).toEqual(['assigned-work']);
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

    const commerce = groups.find((entry) => entry.id === 'products-merchandising');
    expect(
      commerce?.items.map((item) => [item.moduleName, item.id, item.depth]),
    ).toEqual([
      ['nodics.commerce', 'commerce-operations', 0],
      ['pricing', 'pricing', 1],
    ]);
    expect(commerce?.items[0]?.hasChildren).toBe(true);
  });

  it('keeps backend-driven payment operations as an expandable operations group', () => {
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

  it('merges customer experience, discovery, and publishing into business areas', () => {
    const groups = composeShellNavigation([
      {
        id: 'contact-submissions',
        label: 'Contact Submissions',
        route: '/engagement/contact-submissions',
        order: 10,
        moduleName: 'contactSubmission',
        category: 'experience',
        icon: 'message',
        availability: 'UP',
        group: {
          id: 'customer-experience',
          label: 'Customer Experience',
          order: 320,
        },
      },
      {
        id: 'discovery-config',
        label: 'Discovery Configuration',
        route: '/discovery/configuration',
        order: 20,
        moduleName: 'discoveryConfig',
        category: 'platform',
        icon: 'search',
        availability: 'UP',
      },
      {
        id: 'publishing-requests',
        label: 'Publishing Requests',
        route: '/publishing/requests',
        order: 30,
        moduleName: 'publish',
        category: 'content',
        icon: 'publish',
        availability: 'UP',
      },
    ]);

    expect(groups.map((group) => [group.id, group.label])).toEqual([
      ['organization', 'Customer Experience'],
      ['search-discovery', 'Search & Discovery'],
      ['publishing', 'Publishing'],
    ]);
  });

  it('keeps child entries under their backend-owned parent group before keyword fallback', () => {
    const groups = composeShellNavigation([
      {
        id: 'customer-engagement',
        label: 'Customer Engagement',
        route: '/engagement',
        order: 10,
        moduleName: 'engagementCore',
        category: 'experience',
        icon: 'message',
        availability: 'UP',
        group: {
          id: 'customer-experience',
          label: 'Customer Experience',
          order: 320,
        },
      },
      {
        id: 'testimonial-editorial',
        parentId: 'customer-engagement',
        parentModuleName: 'engagementCore',
        label: 'Editorial Versions',
        route: '/engagement/testimonial-editorial',
        order: 20,
        moduleName: 'testimonial',
        category: 'experience',
        icon: 'message',
        availability: 'UP',
      },
      {
        id: 'review-publications',
        parentId: 'customer-engagement',
        parentModuleName: 'engagementCore',
        label: 'Published Reviews',
        route: '/engagement/review-publications',
        order: 30,
        moduleName: 'customerReview',
        category: 'experience',
        icon: 'message',
        availability: 'UP',
      },
      {
        id: 'engagement-delivery-attempts',
        parentId: 'customer-engagement',
        parentModuleName: 'engagementCore',
        label: 'Provider Deliveries',
        route: '/engagement/provider-deliveries',
        order: 40,
        moduleName: 'engagementCore',
        category: 'experience',
        icon: 'message',
        availability: 'UP',
      },
    ]);

    const customerGroup = groups.find((group) => group.id === 'organization');
    expect(customerGroup?.items.map((item) => [item.id, item.depth])).toEqual([
      ['customer-engagement', 0],
      ['testimonial-editorial', 1],
      ['review-publications', 1],
      ['engagement-delivery-attempts', 1],
    ]);
    expect(groups.find((group) => group.id === 'editorial-space')).toBeUndefined();
    expect(groups.find((group) => group.id === 'publishing')).toBeUndefined();
    expect(
      groups.find((group) => group.id === 'fulfillment-operations'),
    ).toBeUndefined();
  });
});
