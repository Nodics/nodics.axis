import { Box, Link, Stack, Typography, alpha } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import {
  normalizeCmsRichTextProperties,
  type CmsRichTextDocument,
  type CmsRichTextMark,
  type CmsRichTextNode,
} from './cmsRichTextContract';
import type { CmsComponentRendererProps } from '../renderers/shared/rendererTypes';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeHref(value: string): string | undefined {
  if (
    value.startsWith('/docs') ||
    value.startsWith('#') ||
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:')
  ) {
    return value;
  }
  return undefined;
}

function safeImageSource(value: string): string | undefined {
  if (
    value.startsWith('/brand/') ||
    value.startsWith('/docs-assets/') ||
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    /^data:image\/(?:jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  ) {
    return value;
  }
  return undefined;
}

function renderMarks(
  content: ReactNode,
  marks: readonly CmsRichTextMark[] | undefined,
  key: string,
): ReactNode {
  return (marks ?? []).reduce((current, mark, index) => {
    if (mark.type === 'bold')
      return <strong key={`${key}:bold:${String(index)}`}>{current}</strong>;
    if (mark.type === 'italic')
      return <em key={`${key}:italic:${String(index)}`}>{current}</em>;
    if (mark.type === 'underline')
      return <u key={`${key}:underline:${String(index)}`}>{current}</u>;
    if (mark.type === 'code')
      return <code key={`${key}:code:${String(index)}`}>{current}</code>;
    if (mark.type === 'link') {
      const href = safeHref(text(mark.attrs?.href));
      if (!href) return current;
      return href.startsWith('/') ? (
        <Link
          component={RouterLink}
          key={`${key}:link:${String(index)}`}
          to={href}
          underline="always"
        >
          {current}
        </Link>
      ) : (
        <Link
          href={href}
          key={`${key}:link:${String(index)}`}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          target={href.startsWith('http') ? '_blank' : undefined}
          underline="always"
        >
          {current}
        </Link>
      );
    }
    return current;
  }, content);
}

function renderInline(nodes: readonly CmsRichTextNode[] | undefined, key: string) {
  return (nodes ?? []).map((node, index) => {
    const nodeKey = `${key}:${String(index)}`;
    if (node.type === 'text') return renderMarks(text(node.text), node.marks, nodeKey);
    return renderRichNode(node, nodeKey);
  });
}

function renderTable(node: CmsRichTextNode, key: string) {
  return (
    <Box
      component="table"
      key={key}
      sx={{
        borderCollapse: 'collapse',
        border: '1px solid',
        borderColor: 'divider',
        width: '100%',
        '& td, & th': {
          border: '1px solid',
          borderColor: 'divider',
          p: 1.25,
          textAlign: 'left',
          verticalAlign: 'top',
        },
        '& th': {
          bgcolor: alpha(axisTokens.color.charcoal[900], 0.04),
          fontWeight: axisTokens.typography.weight.bold,
        },
      }}
    >
      <tbody>
        {(node.content ?? []).map((row, rowIndex) => (
          <tr key={`${key}:row:${String(rowIndex)}`}>
            {(row.content ?? []).map((cell, cellIndex) => {
              const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
              return (
                <Cell key={`${key}:cell:${String(rowIndex)}:${String(cellIndex)}`}>
                  {renderInline(
                    cell.content?.[0]?.content,
                    `${key}:cell:${String(rowIndex)}:${String(cellIndex)}`,
                  )}
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

function renderRichNode(node: CmsRichTextNode, key: string): ReactNode {
  if (node.type === 'paragraph') {
    return (
      <Typography key={key} sx={{ lineHeight: 1.75 }}>
        {renderInline(node.content, key)}
      </Typography>
    );
  }
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 2;
    return (
      <Typography
        component={
          `h${String(Math.min(4, Math.max(1, level)))}` as 'h1' | 'h2' | 'h3' | 'h4'
        }
        key={key}
        variant={level <= 1 ? 'h3' : level === 2 ? 'h4' : 'h5'}
      >
        {renderInline(node.content, key)}
      </Typography>
    );
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const List = node.type === 'orderedList' ? 'ol' : 'ul';
    return (
      <Box component={List} key={key} sx={{ m: 0, pl: 3 }}>
        {(node.content ?? []).map((item, index) => (
          <Typography
            component="li"
            key={`${key}:item:${String(index)}`}
            sx={{ lineHeight: 1.75, mb: 0.5 }}
          >
            {renderInline(item.content?.[0]?.content, `${key}:item:${String(index)}`)}
          </Typography>
        ))}
      </Box>
    );
  }
  if (node.type === 'blockquote') {
    return (
      <Box
        component="blockquote"
        key={key}
        sx={{ borderLeft: 4, borderColor: 'primary.main', m: 0, pl: 2 }}
      >
        {renderInline(node.content?.[0]?.content, key)}
      </Box>
    );
  }
  if (node.type === 'codeBlock') {
    return (
      <Box
        component="pre"
        key={key}
        sx={{
          bgcolor: 'grey.900',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          color: 'grey.100',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.875rem',
          lineHeight: 1.65,
          m: 0,
          overflowX: 'auto',
          p: 2,
        }}
      >
        <code>{renderInline(node.content, key)}</code>
      </Box>
    );
  }
  if (node.type === 'image') {
    const source = safeImageSource(text(node.attrs?.src));
    if (!source) return null;
    return (
      <Box component="figure" key={key} sx={{ m: 0 }}>
        <Box
          alt={text(node.attrs?.alt) || 'CMS image'}
          component="img"
          src={source}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(axisTokens.radius.small)}px`,
            display: 'block',
            maxHeight: 460,
            maxWidth: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>
    );
  }
  if (node.type === 'table') return renderTable(node, key);
  return <Box key={key}>{renderInline(node.content, key)}</Box>;
}

export function CmsRichTextRenderer({ component }: CmsComponentRendererProps) {
  const richText = normalizeCmsRichTextProperties(component.properties);
  return (
    <CmsRichTextDocumentRenderer code={component.code} document={richText.content} />
  );
}

export function CmsRichTextDocumentRenderer({
  code,
  document,
}: {
  readonly code: string;
  readonly document: CmsRichTextDocument;
}) {
  return (
    <Stack spacing={2.25}>
      {document.content.map((node, index) =>
        renderRichNode(node, `${code}:rich:${String(index)}`),
      )}
    </Stack>
  );
}
