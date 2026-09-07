import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectionCentresRoutePage } from '../../src/operations/location/CollectionCentresRoutePage';
import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreWorkspaceData,
} from '../../src/operations/location/api/collectionCentresClient';

vi.mock('../../src/operations/location/api/collectionCentresClient', async () => {
  const actual =
    await vi.importActual<
      typeof import('../../src/operations/location/api/collectionCentresClient')
    >('../../src/operations/location/api/collectionCentresClient');
  return {
    ...actual,
    loadCollectionCentreWorkspaceData: vi.fn(),
  };
});

const mockedLoadWorkspaceData = vi.mocked(loadCollectionCentreWorkspaceData);

const sampleData: CollectionCentreWorkspaceData = Object.freeze({
  records: Object.freeze([
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
    Object.freeze({
      code: 'WCP_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      name: 'Partner Mall Bin',
      collectionPointType: 'SAMPLE_E_WASTE_DROP_OFF',
      locationCode: 'LOC_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      addressCode: 'ADDR_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      operatorEnterpriseCode: 'BEAH',
      operatorEnterpriseName: 'BEAH',
      assetOwnerEnterpriseCode: '',
      assetOwnerEnterpriseName: '',
      enterpriseRelationshipCodes: Object.freeze(['BEAH']),
      addressLine: 'Mall entrance - Dubai',
      city: 'Dubai',
      countryCode: 'AE',
      latitude: 25.2900224,
      longitude: 55.3804174,
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
  sourceCounts: Object.freeze({
    collectionPoints: 2,
    locations: 2,
    addresses: 2,
    enterprises: 2,
  }),
  unavailableSources: Object.freeze([]),
});

function renderPage() {
  const navigation = {
    id: 'waste-collection-centres',
    moduleName: 'wasteCollection',
    label: 'Collection Centres',
    route: '/waste/collection-centres',
    category: 'sustainability',
    icon: 'waste',
    order: 1420.5,
    availability: 'UP',
    featureState: 'ACTIVE',
    workbenchTarget: {
      moduleName: 'wasteCollection',
      schemaName: 'wasteCollectionPoint',
    },
  } as const;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CollectionCentresRoutePage
          accessToken="token"
          bootstrap={{ moduleConnections: {}, navigation: [navigation] } as never}
          navigation={navigation}
          runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Collection Centres route', () => {
  beforeEach(() => {
    mockedLoadWorkspaceData.mockResolvedValue(sampleData);
  });

  it('renders collection-centre list, map markers, and separate coordinates', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Collection centres' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Collection centres map')).toBeVisible();
    expect(
      await screen.findByRole('button', {
        name: 'Averda Recycling Center - Al Safa marker',
      }),
    ).toBeVisible();
    expect(screen.getByText('25.156990')).toBeVisible();
    expect(screen.getByText('55.227787')).toBeVisible();
  });

  it('filters from enterprise to linked collection centres', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText('Averda Recycling Center - Al Safa');
    await user.click(screen.getByRole('combobox', { name: 'Enterprise' }));
    await user.click(screen.getByRole('option', { name: 'BEAH Recycling Services' }));

    expect(
      screen.getAllByText('Averda Recycling Center - Al Safa').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Partner Mall Bin')).toBeNull();
    expect(screen.getByText('1 visible')).toBeVisible();
  });

  it('selects a centre from a map marker and exposes traversal links', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Partner Mall Bin marker' }),
    );
    expect(
      await screen.findByText(/Location: LOC_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN/),
    ).toBeVisible();
    expect(screen.getByText('Operator: BEAH')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Enterprise' })).toHaveAttribute(
      'href',
      '/enterprises/BEAH',
    );
  });

  it('exposes asset-owner traversal when the collection centre has a separate owner', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Averda Recycling Center - Al Safa marker',
      }),
    );

    expect(screen.getByText('Asset owner: BEAH Recycling Services')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Asset owner' })).toHaveAttribute(
      'href',
      '/enterprises/BEAH_RECYCLING_SERVICES',
    );
  });
});
