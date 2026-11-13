import type { ContentDesignerFormPresentation } from '../../../src/operations/contentExperience/api/contentDesignerClient';

/** Distinct owner copy verifies customization without moving domain copy into Axis. */
export const designerFormPresentation: ContentDesignerFormPresentation = {
  newPageTitle: 'Create a page',
  pageNameLabel: 'Page display name',
  pageNameHelp: 'Choose a readable name for the library.',
  createdMessage: 'The page was saved. Continue from its saved copy.',
  continueLabel: 'Continue this saved page',
  knownSavedMessage: 'Edit this page through its saved copy.',
  changedAfterCreationMessage: 'Later form edits are retained here.',
  publicationUnconfirmedMessage:
    'Inspect the original publication before another command.',
};
