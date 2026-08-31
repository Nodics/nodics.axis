export type CmsRichTextMark = Readonly<{
  attrs?: Readonly<Record<string, unknown>>;
  type: string;
}>;

export type CmsRichTextNode = Readonly<{
  attrs?: Readonly<Record<string, unknown>>;
  content?: readonly CmsRichTextNode[];
  marks?: readonly CmsRichTextMark[];
  text?: string;
  type: string;
}>;

export type CmsRichTextDocument = Readonly<{
  content: readonly CmsRichTextNode[];
  type: 'doc';
}>;

export type DocumentationContentBlock = Readonly<Record<string, unknown>>;

export interface CmsRichTextComponentProperties {
  readonly content: CmsRichTextDocument;
  readonly blocks: readonly DocumentationContentBlock[];
  readonly plainText: string;
  readonly format: 'cms-rich-text-json';
}

const EMPTY_DOCUMENT: CmsRichTextDocument = Object.freeze({
  type: 'doc',
  content: Object.freeze([
    Object.freeze({
      type: 'paragraph',
      content: Object.freeze([]),
    }),
  ]),
});

const MAX_TEXT = 100_000;
const MAX_BLOCKS = 1_000;
const MAX_LIST_ITEMS = 200;
const MAX_TABLE_ROWS = 100;

function boundedText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

function textNode(text: string, marks?: readonly CmsRichTextMark[]): CmsRichTextNode {
  return Object.freeze({
    type: 'text',
    text: boundedText(text),
    ...(marks && marks.length > 0 ? { marks: Object.freeze([...marks]) } : {}),
  });
}

function paragraphNode(content: readonly CmsRichTextNode[] = []): CmsRichTextNode {
  return Object.freeze({ type: 'paragraph', content: Object.freeze([...content]) });
}

function inlineNodesFromMarkdown(value: string): readonly CmsRichTextNode[] {
  const nodes: CmsRichTextNode[] = [];
  const pattern =
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) nodes.push(textNode(value.slice(cursor, match.index)));
    if (match[1] && match[2]) {
      nodes.push(
        textNode(match[1], [
          Object.freeze({ type: 'link', attrs: Object.freeze({ href: match[2] }) }),
        ]),
      );
    } else if (match[3]) {
      nodes.push(textNode(match[3], [Object.freeze({ type: 'code' })]));
    } else if (match[4]) {
      nodes.push(textNode(match[4], [Object.freeze({ type: 'bold' })]));
    } else if (match[5]) {
      nodes.push(textNode(match[5], [Object.freeze({ type: 'italic' })]));
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) nodes.push(textNode(value.slice(cursor)));
  return Object.freeze(nodes);
}

function listItemNode(value: string): CmsRichTextNode {
  return Object.freeze({
    type: 'listItem',
    content: Object.freeze([paragraphNode(inlineNodesFromMarkdown(value))]),
  });
}

function tableCellNode(value: string, header = false): CmsRichTextNode {
  return Object.freeze({
    type: header ? 'tableHeader' : 'tableCell',
    content: Object.freeze([paragraphNode(inlineNodesFromMarkdown(value))]),
  });
}

function tableRowNode(cells: readonly string[], header = false): CmsRichTextNode {
  return Object.freeze({
    type: 'tableRow',
    content: Object.freeze(
      cells.slice(0, 20).map((cell) => tableCellNode(cell, header)),
    ),
  });
}

function isRichTextDocument(value: unknown): value is CmsRichTextDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { readonly type?: unknown }).type === 'doc' &&
    Array.isArray((value as { readonly content?: unknown }).content)
  );
}

function stringItems(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(
        value
          .slice(0, MAX_LIST_ITEMS)
          .map((item) => boundedText(item))
          .filter(Boolean),
      )
    : Object.freeze([]);
}

function stringRows(value: unknown): readonly (readonly string[])[] {
  return Array.isArray(value)
    ? Object.freeze(
        value
          .slice(0, MAX_TABLE_ROWS)
          .map((row) => stringItems(row))
          .filter((row) => row.length > 0),
      )
    : Object.freeze([]);
}

export function textToCmsRichTextDocument(value: string): CmsRichTextDocument {
  const content = boundedText(value)
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section): CmsRichTextNode => {
      const heading = /^(#{1,3})\s+(.+)$/u.exec(section);
      if (heading?.[1] && heading[2]) {
        return Object.freeze({
          type: 'heading',
          attrs: Object.freeze({ level: Math.min(3, heading[1].length) }),
          content: inlineNodesFromMarkdown(heading[2]),
        });
      }
      return paragraphNode(inlineNodesFromMarkdown(section));
    });
  return Object.freeze({
    type: 'doc',
    content: Object.freeze(content.length > 0 ? content : EMPTY_DOCUMENT.content),
  });
}

export function documentationBlocksToCmsRichTextDocument(
  blocks: unknown,
  fallbackText = '',
): CmsRichTextDocument {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return textToCmsRichTextDocument(fallbackText);
  }
  const content = blocks.slice(0, MAX_BLOCKS).flatMap((block): CmsRichTextNode[] => {
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return [];
    const record = block as Readonly<Record<string, unknown>>;
    const kind = boundedText(record.kind);
    if (kind === 'heading') {
      return [
        Object.freeze({
          type: 'heading',
          attrs: Object.freeze({
            level:
              typeof record.level === 'number'
                ? Math.min(3, Math.max(1, record.level))
                : 2,
          }),
          content: inlineNodesFromMarkdown(boundedText(record.text)),
        }),
      ];
    }
    if (kind === 'paragraph') {
      return [paragraphNode(inlineNodesFromMarkdown(boundedText(record.text)))];
    }
    if (kind === 'unordered-list' || kind === 'ordered-list') {
      return [
        Object.freeze({
          type: kind === 'ordered-list' ? 'orderedList' : 'bulletList',
          content: Object.freeze(stringItems(record.items).map(listItemNode)),
        }),
      ];
    }
    if (kind === 'blockquote') {
      return [
        Object.freeze({
          type: 'blockquote',
          content: Object.freeze([
            paragraphNode(inlineNodesFromMarkdown(boundedText(record.text))),
          ]),
        }),
      ];
    }
    if (kind === 'code' || kind === 'diagram') {
      return [
        Object.freeze({
          type: 'codeBlock',
          attrs: Object.freeze({ language: boundedText(record.language) || undefined }),
          content: Object.freeze([textNode(boundedText(record.text))]),
        }),
      ];
    }
    if (kind === 'image') {
      return [
        Object.freeze({
          type: 'image',
          attrs: Object.freeze({
            alt: boundedText(record.alt) || boundedText(record.title),
            src: boundedText(record.source),
            title: boundedText(record.title),
          }),
        }),
      ];
    }
    if (kind === 'table') {
      const headers = stringItems(record.headers);
      const rows = stringRows(record.rows);
      return [
        Object.freeze({
          type: 'table',
          content: Object.freeze([
            ...(headers.length > 0 ? [tableRowNode(headers, true)] : []),
            ...rows.map((row) => tableRowNode(row)),
          ]),
        }),
      ];
    }
    return [];
  });
  return Object.freeze({
    type: 'doc',
    content: Object.freeze(content.length > 0 ? content : EMPTY_DOCUMENT.content),
  });
}

function markText(
  value: string,
  marks: readonly CmsRichTextMark[] | undefined,
): string {
  return (marks ?? []).reduce((current, mark) => {
    if (mark.type === 'bold') return `**${current}**`;
    if (mark.type === 'italic') return `*${current}*`;
    if (mark.type === 'code') return `\`${current}\``;
    if (mark.type === 'link') {
      const href = boundedText(mark.attrs?.href);
      return href ? `[${current}](${href})` : current;
    }
    return current;
  }, value);
}

function inlineText(nodes: readonly CmsRichTextNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'text') return markText(boundedText(node.text), node.marks);
      return inlineText(node.content);
    })
    .join('');
}

function plainInlineText(nodes: readonly CmsRichTextNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) =>
      node.type === 'text' ? boundedText(node.text) : plainInlineText(node.content),
    )
    .join('');
}

function listText(node: CmsRichTextNode): readonly string[] {
  return Object.freeze(
    (node.content ?? [])
      .filter((item) => item.type === 'listItem')
      .map((item) => inlineText(item.content?.[0]?.content))
      .filter(Boolean)
      .slice(0, MAX_LIST_ITEMS),
  );
}

function tableRows(node: CmsRichTextNode): {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
} {
  const rows = (node.content ?? [])
    .filter((row) => row.type === 'tableRow')
    .map((row) =>
      (row.content ?? [])
        .filter((cell) => cell.type === 'tableCell' || cell.type === 'tableHeader')
        .map((cell) => inlineText(cell.content?.[0]?.content)),
    )
    .filter((row) => row.length > 0)
    .slice(0, MAX_TABLE_ROWS);
  const first = rows[0] ?? [];
  const firstIsHeader = (node.content?.[0]?.content ?? []).some(
    (cell) => cell.type === 'tableHeader',
  );
  return Object.freeze({
    headers: Object.freeze(firstIsHeader ? first : []),
    rows: Object.freeze(firstIsHeader ? rows.slice(1) : rows),
  });
}

function documentNodeToBlocks(
  node: CmsRichTextNode,
): readonly DocumentationContentBlock[] {
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 2;
    return [
      Object.freeze({
        kind: 'heading',
        level: Math.min(3, Math.max(1, level)),
        text: inlineText(node.content),
      }),
    ];
  }
  if (node.type === 'paragraph') {
    const value = inlineText(node.content);
    return value.trim() ? [Object.freeze({ kind: 'paragraph', text: value })] : [];
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return [
      Object.freeze({
        kind: node.type === 'orderedList' ? 'ordered-list' : 'unordered-list',
        items: listText(node),
      }),
    ];
  }
  if (node.type === 'blockquote') {
    const value = inlineText(node.content?.[0]?.content);
    return value.trim() ? [Object.freeze({ kind: 'blockquote', text: value })] : [];
  }
  if (node.type === 'codeBlock') {
    const language = boundedText(node.attrs?.language);
    const code = plainInlineText(node.content);
    return [
      Object.freeze({
        kind: language === 'mermaid' ? 'diagram' : 'code',
        ...(language ? { language } : {}),
        text: code,
      }),
    ];
  }
  if (node.type === 'image') {
    return [
      Object.freeze({
        kind: 'image',
        source: boundedText(node.attrs?.src),
        alt: boundedText(node.attrs?.alt),
        title: boundedText(node.attrs?.title),
      }),
    ];
  }
  if (node.type === 'table') {
    const rows = tableRows(node);
    return [
      Object.freeze({
        kind: 'table',
        headers: rows.headers,
        rows: rows.rows,
      }),
    ];
  }
  return node.content?.flatMap(documentNodeToBlocks) ?? [];
}

export function cmsRichTextDocumentToDocumentationBlocks(
  document: CmsRichTextDocument,
): readonly DocumentationContentBlock[] {
  return Object.freeze(
    document.content.flatMap(documentNodeToBlocks).slice(0, MAX_BLOCKS),
  );
}

export function cmsRichTextDocumentToText(document: CmsRichTextDocument): string {
  return document.content
    .map((node) => {
      if (node.type === 'heading') return inlineText(node.content);
      if (node.type === 'paragraph') return inlineText(node.content);
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        return listText(node).join('\n');
      }
      if (node.type === 'blockquote') return inlineText(node.content?.[0]?.content);
      if (node.type === 'codeBlock') return plainInlineText(node.content);
      if (node.type === 'table') {
        const rows = tableRows(node);
        return [...(rows.headers.length ? [rows.headers] : []), ...rows.rows]
          .map((row) => row.join(' | '))
          .join('\n');
      }
      if (node.type === 'image') return boundedText(node.attrs?.alt);
      return plainInlineText(node.content);
    })
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeCmsRichTextProperties(
  properties: Readonly<Record<string, unknown>>,
  fallbackText = '',
): CmsRichTextComponentProperties {
  const content = isRichTextDocument(properties.content)
    ? properties.content
    : documentationBlocksToCmsRichTextDocument(properties.blocks, fallbackText);
  const blocks = cmsRichTextDocumentToDocumentationBlocks(content);
  return Object.freeze({
    content,
    blocks,
    plainText: cmsRichTextDocumentToText(content),
    format: 'cms-rich-text-json',
  });
}

export function cmsRichTextComponentProperties(
  document: CmsRichTextDocument,
): CmsRichTextComponentProperties {
  return normalizeCmsRichTextProperties({ content: document });
}
