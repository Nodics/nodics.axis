import { expect, it } from 'vitest';
import { workbenchRelationshipConnectionScope } from '../../../src/workbench/form/WorkbenchRelationshipRuntime';

const source = {
  cms: [
    { instanceId: 'cms-staged', endpoint: 'https://staged.example.test/nodics/cms' },
  ],
  profile: [
    {
      instanceId: 'platform',
      endpoint: 'https://platform.example.test/nodics/profile',
    },
  ],
};
it('keeps relationship snapshots stable across catalogue ordering and unrelated presentation changes', () => {
  expect(
    workbenchRelationshipConnectionScope({
      profile: source.profile,
      cms: source.cms.map((owner) => ({
        ...owner,
        state: 'UP',
        displayName: 'Content',
      })),
    }),
  ).toBe(workbenchRelationshipConnectionScope(source));
});
it('partitions the same logical instance when its endpoint changes', () => {
  expect(
    workbenchRelationshipConnectionScope({
      ...source,
      cms: [
        { ...source.cms[0]!, endpoint: 'https://replacement.example.test/nodics/cms' },
      ],
    }),
  ).not.toBe(workbenchRelationshipConnectionScope(source));
});
it('does not share a partition across different module owners or instances', () => {
  const initial = workbenchRelationshipConnectionScope(source);
  expect(
    workbenchRelationshipConnectionScope({
      ...source,
      cms: [{ ...source.cms[0]!, instanceId: 'new-staged' }],
    }),
  ).not.toBe(initial);
  expect(
    workbenchRelationshipConnectionScope({
      other: source.cms,
      profile: source.profile,
    }),
  ).not.toBe(initial);
  expect(workbenchRelationshipConnectionScope({ profile: source.profile })).not.toBe(
    initial,
  );
});
it('derives the partition without mutating the supplied canonical catalogue', () => {
  const frozen = Object.freeze({ cms: Object.freeze([...source.cms]) });
  expect(() => workbenchRelationshipConnectionScope(frozen)).not.toThrow();
  expect(frozen.cms).toEqual(source.cms);
});
