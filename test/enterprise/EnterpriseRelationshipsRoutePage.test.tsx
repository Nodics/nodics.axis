import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseRelationshipsRoutePage } from '../../src/operations/enterprise/EnterpriseRelationshipsRoutePage';
import {
  loadEnterpriseRelationshipData,
  type EnterpriseRelationshipData,
} from '../../src/operations/enterprise/api/enterpriseRelationshipsClient';

vi.mock('../../src/operations/enterprise/api/enterpriseRelationshipsClient', async () => {
  const actual =
    await vi.importActual<
      typeof import('../../src/operations/enterprise/api/enterpriseRelationshipsClient')
    >('../../src/operations/enterprise/api/enterpriseRelationshipsClient');
  return {
    ...actual,
    loadEnterpriseRelationshipData: vi.fn(),
  };
});

const mockedLoadRelationshipData = vi.mocked(loadEnterpriseRelationshipData);

const relationshipData: EnterpriseRelationshipData = Object.freeze({
  enterprise: Object.freeze({
    code: 'NODICS_WASTE_MANAGEMENT_CO',
    name: 'Nodics Waste Management Co.',
  }),
  collectionCentres: Object.freeze([
    Object.freeze({
      code: 'WCP_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      name: 'Averda Recycling Center - Al Safa',
      collectionPointType: 'SAMPLE_E_WASTE_DROP_OFF',
      locationCode: 'LOC_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      addressCode: 'ADDR_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      operatorEnterpriseCode: 'NODICS_WASTE_MANAGEMENT_CO',
      operatorEnterpriseName: 'Nodics Waste Management Co.',
      assetOwnerEnterpriseCode: 'BEAH_RECYCLING_SERVICES',
      assetOwnerEnterpriseName: 'BEAH Recycling Services',
      enterpriseRelationshipCodes: Object.freeze([
        'NODICS_WASTE_MANAGEMENT_CO',
        'BEAH_RECYCLING_SERVICES',
      ]),
      addressLine: '62 18C St - Al Safa - Dubai',
      city: 'Dubai',
      countryCode: 'AE',
      latitude: 25.1569903,
      longitude: 55.2277866,
      operatingStatus: 'ACTIVE',
      publicVisibility: 'PUBLIC',
      status: 'ACTIVE',
      serviceCapabilities: Object.freeze(['DROP_OFF']),
      point: Object.freeze({}),
      location: Object.freeze({}),
      address: Object.freeze({}),
      enterprise: Object.freeze({}),
    }),
  ]),
  promotions: Object.freeze([
    Object.freeze({
      source: 'promotion',
      code: 'PROMO_001',
      name: 'Welcome Reward',
      relationship: 'Marketplace vendor',
      status: 'ACTIVE',
      route: '/schema-workbench?module=promotion&schema=promotion',
      record: Object.freeze({}),
    }),
  ]),
  coupons: Object.freeze([
    Object.freeze({
      source: 'coupon',
      code: 'COUPON_001',
      name: 'COUPON_001',
      relationship: 'Issuer',
      status: 'AVAILABLE',
      route: '/schema-workbench?module=promotion&schema=coupon',
      record: Object.freeze({}),
    }),
  ]),
  sourceCounts: Object.freeze({
    enterprises: 2,
    collectionCentres: 1,
    promotions: 1,
    coupons: 1,
  }),
  unavailableSources: Object.freeze([]),
  projection: Object.freeze({
    mode: 'AXIS_AGGREGATION',
    backendProjectionAvailable: false,
    authoritativeSources: Object.freeze([
      'wasteCollection.wasteCollectionPoint.operatorEnterpriseRef',
      'wasteCollection.wasteCollectionPoint.assetOwnerEnterpriseRef',
    ]),
  }),
});

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/enterprises/NODICS_WASTE_MANAGEMENT_CO']}>
        <Routes>
          <Route
            path="/enterprises/:enterpriseCode"
            element={
              <EnterpriseRelationshipsRoutePage
                accessToken="token"
                bootstrap={{ moduleConnections: {}, navigation: [] } as never}
                runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Enterprise relationships route', () => {
  beforeEach(() => {
    mockedLoadRelationshipData.mockResolvedValue(relationshipData);
  });

  it('renders enterprise relationship counts and linked collection centres', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Nodics Waste Management Co.',
      }),
    ).toBeVisible();
    expect(screen.getByText('Averda Recycling Center - Al Safa')).toBeVisible();
    expect(screen.getByText('LOC_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA')).toBeVisible();
    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(
      screen.getByText('Relationship view is assembled from owning module records.'),
    ).toBeVisible();
  });

  it('shows promotion and coupon relationship traversal links', async () => {
    renderPage();

    expect(await screen.findByText('Welcome Reward')).toBeVisible();
    expect(screen.getByText('COUPON_001')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Open source' })[0]).toHaveAttribute(
      'href',
      '/schema-workbench?module=promotion&schema=promotion',
    );
    expect(screen.getByRole('link', { name: 'Coupon records' })).toHaveAttribute(
      'href',
      '/schema-workbench?module=promotion&schema=coupon',
    );
  });
});
