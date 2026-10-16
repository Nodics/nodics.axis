import { describe, expect, it } from 'vitest';
import { parseWasteListingWorkspace } from '../../src/operations/wasteManagement/api/wasteListingClient';
import { authorPresentation } from './listingAuthoringFixtures';
const workspace = {
  contractVersion: 1,
  workspaceCode: 'waste.listing',
  viewCode: 'ewaste.listingRequests',
  presentation: authorPresentation,
};
describe('non-executable authoring presentation', () => {
  it('admits exact owner copy and removes unknown sensitive/executable fields', () => {
    const value = parseWasteListingWorkspace({
      ...workspace,
      presentation: {
        ...authorPresentation,
        authoring: {
          ...authorPresentation.authoring,
          endpoint: 'PRIVATE',
          accessToken: 'PRIVATE',
        },
      },
    });
    expect(value).toEqual(authorPresentation);
    expect(JSON.stringify(value)).not.toContain('PRIVATE');
  });
  it.each([
    {},
    { ...authorPresentation.authoring, confirmLabel: '' },
    { ...authorPresentation.authoring, uncertainMessage: 'x'.repeat(501) },
    { ...authorPresentation.authoring, inspectLabel: { html: '<script>' } },
  ])('refuses incomplete or executable copy: %j', (authoring) => {
    expect(() =>
      parseWasteListingWorkspace({
        ...workspace,
        presentation: { ...authorPresentation, authoring },
      }),
    ).toThrow();
  });
});
