import { describe, expect, it } from 'vitest';

import {
  cmsRichTextDocumentToDocumentationBlocks,
  cmsRichTextDocumentToText,
  documentationBlocksToCmsRichTextDocument,
} from '../../../src/cms/richText/cmsRichTextContract';

describe('cmsRichTextContract', () => {
  it('round-trips documentation content blocks through the generic rich text document', () => {
    const document = documentationBlocksToCmsRichTextDocument([
      { kind: 'heading', level: 2, text: 'Launch checklist' },
      {
        kind: 'paragraph',
        text: 'Read the [launch guide](https://nodics.ai/docs) before publishing.',
      },
      { kind: 'image', source: '/docs-assets/launch.png', alt: 'Launch diagram' },
      { kind: 'code', language: 'javascript', text: 'publish({ state: "STAGED" });' },
      {
        kind: 'table',
        headers: ['Step', 'Owner'],
        rows: [
          ['Draft', 'Author'],
          ['Publish', 'Approver'],
        ],
      },
    ]);

    expect(cmsRichTextDocumentToText(document)).toContain('Launch checklist');
    expect(cmsRichTextDocumentToText(document)).toContain('https://nodics.ai/docs');
    expect(cmsRichTextDocumentToText(document)).toContain('publish');

    const blocks = cmsRichTextDocumentToDocumentationBlocks(document);
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'heading', text: 'Launch checklist' }),
        expect.objectContaining({ kind: 'image', source: '/docs-assets/launch.png' }),
        expect.objectContaining({ kind: 'code', language: 'javascript' }),
        expect.objectContaining({ kind: 'table' }),
      ]),
    );
  });
});
