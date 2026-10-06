/** @file Synthetic owner-projected refresh assignment form; contains no runtime grant or schedule. */
import type { CopilotSettings } from '../../src/assistant/api/copilotAdministrationClient';

export const refreshAssignmentFixture: CopilotSettings['sections'][number] = {
  code: 'refresh-publisher-new',
  scope: 'ENTERPRISE',
  title: 'Assign source event publisher',
  editable: true,
  fields: [
    { id: 'assigned', label: 'Assignment enabled', kind: 'boolean', value: true },
    { id: 'publisherId', label: 'Publisher service identity', kind: 'text', value: '' },
    {
      id: 'sourceCode',
      label: 'Knowledge source',
      kind: 'select',
      value: 'framework-guides',
      options: ['framework-guides', 'project-guides'],
    },
    { id: 'definitionCode', label: 'Process definition', kind: 'text', value: '' },
    {
      id: 'version',
      label: 'Published Process version',
      kind: 'number',
      value: 1,
      minimum: 1,
      maximum: 2147483647,
    },
  ],
};
