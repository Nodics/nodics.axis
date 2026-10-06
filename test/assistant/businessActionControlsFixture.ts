/** @file Synthetic server-owned business controls for renderer tests; not a client configuration registry. */
export const businessActionControlsFixture = {
  code: 'business-actions',
  title: 'Business action controls',
  scope: 'TENANT_RUNTIME',
  editable: true,
  fields: [
    {
      id: 'invitations',
      label: 'New invitations to existing enterprises',
      kind: 'boolean',
      value: false,
    },
    {
      id: 'prices',
      label: 'New prices for existing products',
      kind: 'boolean',
      value: false,
    },
    {
      id: 'planning',
      label: 'Interpret supported business requests',
      kind: 'boolean',
      value: false,
    },
    {
      id: 'recovery',
      label: 'Inspect original business results',
      kind: 'boolean',
      value: false,
    },
  ],
};
