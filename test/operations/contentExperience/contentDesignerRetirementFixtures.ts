/** Deterministic CMS presentation fixture; production copy is supplied by the owner model. */
import type { ContentDesignerRetirementPresentation } from '../../../src/operations/contentExperience/api/contentDesignerClient';

export const retirementPresentation: ContentDesignerRetirementPresentation = {
  title: 'Retire content',
  targetLabel: 'Record kind',
  codeLabel: 'Record code',
  catalogLabel: 'Catalog',
  siteLabel: 'Site',
  enterpriseLabel: 'Enterprise',
  reviewLabel: 'Review retirement',
  reviewTitle: 'Review content retirement',
  confirmLabel: 'Confirm retirement',
  cancelLabel: 'Close review',
  acknowledgeLabel: 'I reviewed this record, scope and consequence',
  inspectionLabel: 'I inspected the current CMS record after this outcome',
  uncertainMessage:
    'The outcome is uncertain. Inspect the current owner record before another submission.',
  successMessage: 'Retirement saved as an inactive version.',
  changedMessage: 'Authority or scope changed. Review the current selection again.',
  historyMessage:
    'History is retained. References, Media assets and publications are not removed.',
  actions: [
    {
      operation: 'deleteSection',
      label: 'Section placement',
      consequence: 'Only this placement is retired; its component remains.',
    },
    {
      operation: 'deleteComponent',
      label: 'Shared component',
      consequence: 'This component may be shared across Sites in this Catalog.',
    },
    {
      operation: 'detachMedia',
      label: 'Media association',
      consequence: 'Only the association is retired; the Media asset remains.',
    },
  ],
};
