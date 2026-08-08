import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Divider,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import mermaid from 'mermaid';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';

import { axisTokens } from '../../../../app/axisTheme';
import { arrayProperty, stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';

const MAX_BLOCKS = 1000;
const MAX_LIST_ITEMS = 200;
const MAX_TABLE_ROWS = 200;
const MAX_TEXT_LENGTH = 100_000;
const MAX_IMAGE_SOURCE_LENGTH = 3_000_000;
const MAX_DIAGRAM_LENGTH = 20_000;

type DocumentationBlock = Readonly<Record<string, unknown>>;

interface DocumentationLink {
  readonly title: string;
  readonly route: string;
}

const readableLinkSx = {
  color: 'secondary.main',
  fontWeight: axisTokens.typography.weight.medium,
  textDecorationColor: 'primary.main',
  textDecorationThickness: '1px',
  textUnderlineOffset: '0.2em',
  '&:hover': {
    color: 'text.primary',
    textDecorationColor: 'primary.main',
  },
} as const;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : fallback;
}

function stringList(value: unknown, limit = MAX_LIST_ITEMS): readonly string[] {
  return Array.isArray(value) ? value.slice(0, limit).map((item) => text(item)) : [];
}

function documentationLink(value: unknown): DocumentationLink | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
  const record = value as Readonly<Record<string, unknown>>;
  const title = text(record.title);
  const route = text(record.route);
  return title && route.startsWith('/docs') ? { title, route } : undefined;
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

function safeImageSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_IMAGE_SOURCE_LENGTH) return;
  if (
    /^data:image\/(?:jpeg|png|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)
  ) {
    return value;
  }
  if (value.startsWith('/brand/') || value.startsWith('/docs-assets/')) {
    return value;
  }
  return undefined;
}

function fragmentId(hash: string): string | undefined {
  if (!hash.startsWith('#') || hash.length < 2) return undefined;
  try {
    const decoded = decodeURIComponent(hash.slice(1));
    return /^[A-Za-z0-9._:-]{1,128}$/.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function scrollToDocumentationAnchor(anchor: string): void {
  const target = document.getElementById(anchor);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function inlineContent(value: string): ReactNode {
  const parts: ReactNode[] = [];
  const inlinePattern =
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = inlinePattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push(value.slice(cursor, match.index));
    if (match[3]) {
      parts.push(<code key={`code:${String(match.index)}`}>{match[3]}</code>);
    } else if (match[4]) {
      parts.push(<strong key={`strong:${String(match.index)}`}>{match[4]}</strong>);
    } else if (match[5]) {
      parts.push(<em key={`em:${String(match.index)}`}>{match[5]}</em>);
    } else {
      const label = match[1] ?? '';
      const href = safeHref(match[2] ?? '');
      if (!href) {
        parts.push(label);
      } else if (href.startsWith('/')) {
        parts.push(
          <Link
            component={RouterLink}
            key={`${String(match.index)}:${href}`}
            sx={readableLinkSx}
            to={href}
            underline="always"
          >
            {label}
          </Link>,
        );
      } else {
        parts.push(
          <Link
            href={href}
            key={`${String(match.index)}:${href}`}
            rel={href.startsWith('http') ? 'noreferrer' : undefined}
            sx={readableLinkSx}
            target={href.startsWith('http') ? '_blank' : undefined}
            underline="always"
          >
            {label}
          </Link>,
        );
      }
    }
    cursor = inlinePattern.lastIndex;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.length > 0 ? parts : value;
}

function headingVariant(level: number): 'h1' | 'h2' | 'h3' | 'h4' {
  if (level <= 1) return 'h1';
  if (level === 2) return 'h2';
  if (level === 3) return 'h3';
  return 'h4';
}

function DocumentationDiagramRenderer({
  block,
  blockKey,
}: {
  readonly block: DocumentationBlock;
  readonly blockKey: string;
}) {
  const diagramId = useId().replace(/:/g, '');
  const diagramText = text(block.text).slice(0, MAX_DIAGRAM_LENGTH);
  const title = text(block.title, 'Documentation diagram');
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: '#ffffff',
        fontFamily: 'Inter, Roboto, Arial, sans-serif',
        primaryColor: '#fff7dc',
        primaryBorderColor: '#f7c600',
        primaryTextColor: '#242a31',
        lineColor: '#6b7280',
        secondaryColor: '#ecfdf5',
        tertiaryColor: '#eff6ff',
      },
    });
    mermaid
      .render(`nodicsDocsDiagram${diagramId}`, diagramText)
      .then((result) => {
        if (!active) return;
        setSvg(result.svg);
        setError(undefined);
      })
      .catch(() => {
        if (!active) return;
        setSvg(undefined);
        setError(
          'Diagram could not be rendered. The source is shown below for troubleshooting.',
        );
      });
    return () => {
      active = false;
    };
  }, [diagramId, diagramText]);

  return (
    <Box
      component="figure"
      key={blockKey}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        m: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          bgcolor: 'action.hover',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 2,
          py: 1.25,
        }}
      >
        <Typography
          component="figcaption"
          sx={{ fontWeight: axisTokens.typography.weight.bold }}
        >
          {title}
        </Typography>
      </Box>
      {svg ? (
        <Box
          dangerouslySetInnerHTML={{ __html: svg }}
          sx={{
            overflowX: 'auto',
            p: 2,
            '& svg': {
              display: 'block',
              height: 'auto',
              maxWidth: '100%',
              mx: 'auto',
            },
          }}
        />
      ) : null}
      {error ? (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Typography color="error.main">{error}</Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: 'grey.900',
              borderRadius: 1.5,
              color: 'grey.100',
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.6,
              m: 0,
              overflowX: 'auto',
              p: 2,
              whiteSpace: 'pre',
            }}
          >
            <code>{diagramText}</code>
          </Box>
        </Stack>
      ) : null}
    </Box>
  );
}

function DocumentationBlockRenderer({
  block,
  index,
}: {
  readonly block: DocumentationBlock;
  readonly index: number;
}) {
  const kind = text(block.kind);
  const key = `${kind}:${String(index)}`;
  if (kind === 'heading') {
    const level =
      typeof block.level === 'number' && Number.isInteger(block.level)
        ? Math.min(4, Math.max(1, block.level))
        : 2;
    return (
      <Typography
        component={`h${String(level)}` as 'h1' | 'h2' | 'h3' | 'h4'}
        id={text(block.anchor) || undefined}
        key={key}
        sx={{ scrollMarginTop: 96 }}
        variant={headingVariant(level)}
      >
        {inlineContent(text(block.text))}
      </Typography>
    );
  }
  if (kind === 'paragraph') {
    return (
      <Typography key={key} sx={{ lineHeight: 1.8 }}>
        {inlineContent(text(block.text))}
      </Typography>
    );
  }
  if (kind === 'unordered-list' || kind === 'ordered-list') {
    const Component = kind === 'ordered-list' ? 'ol' : 'ul';
    return (
      <Box component={Component} key={key} sx={{ m: 0, pl: 3.5 }}>
        {stringList(block.items).map((item, itemIndex) => (
          <Typography
            component="li"
            key={`${key}:${String(itemIndex)}`}
            sx={{ lineHeight: 1.8, mb: 0.75 }}
          >
            {inlineContent(item)}
          </Typography>
        ))}
      </Box>
    );
  }
  if (kind === 'blockquote') {
    return (
      <Box
        component="blockquote"
        key={key}
        sx={{ borderLeft: 4, borderColor: 'primary.main', m: 0, pl: 2 }}
      >
        <Typography color="text.secondary">
          {inlineContent(text(block.text))}
        </Typography>
      </Box>
    );
  }
  if (kind === 'code') {
    return (
      <Box
        component="pre"
        key={key}
        sx={{
          bgcolor: 'grey.900',
          borderRadius: 1.5,
          color: 'grey.100',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.65,
          m: 0,
          overflowX: 'auto',
          p: 2,
          whiteSpace: 'pre',
        }}
      >
        <code>{text(block.text)}</code>
      </Box>
    );
  }
  if (kind === 'diagram') {
    return <DocumentationDiagramRenderer block={block} blockKey={key} />;
  }
  if (kind === 'table') {
    const headers = stringList(block.headers, 50);
    const rows = Array.isArray(block.rows)
      ? block.rows.slice(0, MAX_TABLE_ROWS).map((row) => stringList(row, 50))
      : [];
    return (
      <TableContainer key={key} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headers.map((header, cellIndex) => (
                <TableCell key={`${key}:header:${String(cellIndex)}`}>
                  {inlineContent(header)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={`${key}:row:${String(rowIndex)}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`${key}:cell:${String(rowIndex)}:${String(cellIndex)}`}
                  >
                    {inlineContent(cell)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (kind === 'image') {
    const source = safeImageSource(block.source);
    if (!source) return null;
    const alt = text(block.alt, text(block.title, 'Documentation illustration'));
    const title = text(block.title);
    return (
      <Box component="figure" key={key} sx={{ m: 0 }}>
        <Box
          alt={alt}
          component="img"
          loading="lazy"
          src={source}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            display: 'block',
            height: 'auto',
            maxHeight: { xs: 420, md: 680 },
            maxWidth: '100%',
            mx: 'auto',
            objectFit: 'contain',
          }}
        />
        {title ? (
          <Typography
            component="figcaption"
            color="text.secondary"
            sx={{ mt: 1, textAlign: 'center' }}
            variant="body2"
          >
            {title}
          </Typography>
        ) : null}
      </Box>
    );
  }
  return null;
}

export function DocumentationArticleRenderer({ component }: CmsComponentRendererProps) {
  const location = useLocation();
  const title = stringProperty(component, 'title', 'Documentation');
  const category = stringProperty(component, 'category');
  const audience = stringList(arrayProperty(component, 'audience'), 20);
  const headings = arrayProperty(component, 'headings')
    .slice(0, 100)
    .flatMap((heading) => {
      if (typeof heading !== 'object' || heading === null || Array.isArray(heading)) {
        return [];
      }
      const record = heading as Readonly<Record<string, unknown>>;
      const label = text(record.text);
      const anchor = text(record.anchor);
      const level = typeof record.level === 'number' ? record.level : 2;
      return label && anchor && level > 1 ? [{ label, anchor, level }] : [];
    });
  const previous = documentationLink(component.properties.previous);
  const next = documentationLink(component.properties.next);
  const blocks = arrayProperty(component, 'blocks')
    .slice(0, MAX_BLOCKS)
    .filter(
      (block): block is DocumentationBlock =>
        typeof block === 'object' && block !== null && !Array.isArray(block),
    )
    .filter(
      (block, index) =>
        !(
          index === 0 &&
          block.kind === 'heading' &&
          block.level === 1 &&
          block.text === title
        ),
    );

  useEffect(() => {
    const anchor = fragmentId(location.hash);
    if (!anchor) return;
    const frame = window.requestAnimationFrame(() => {
      scrollToDocumentationAnchor(anchor);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [blocks, location.hash]);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Breadcrumbs aria-label="Documentation breadcrumb">
          <Link
            component={RouterLink}
            sx={readableLinkSx}
            to="/docs"
            underline="always"
          >
            Documentation
          </Link>
          {category ? <Typography color="text.secondary">{category}</Typography> : null}
          <Typography color="text.primary">{title}</Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {category ? <Chip label={category} size="small" /> : null}
          {audience.map((item) => (
            <Chip key={item} label={item} size="small" variant="outlined" />
          ))}
        </Box>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '2.5rem', lg: '3rem' },
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
          }}
          variant="h1"
        >
          {title}
        </Typography>
      </Stack>
      <Divider />
      {headings.length > 0 ? (
        <Box
          component="nav"
          aria-label="On this page"
          sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 2 }}
        >
          <Typography component="h2" gutterBottom variant="subtitle1">
            On this page
          </Typography>
          <Stack spacing={0.75}>
            {headings.map((heading) => (
              <Link
                href={`#${heading.anchor}`}
                key={heading.anchor}
                onClick={() => {
                  window.requestAnimationFrame(() => {
                    scrollToDocumentationAnchor(heading.anchor);
                  });
                }}
                sx={{
                  ...readableLinkSx,
                  pl: Math.max(0, heading.level - 2) * 1.5,
                }}
                underline="always"
                variant="body2"
              >
                {heading.label}
              </Link>
            ))}
          </Stack>
        </Box>
      ) : null}
      {blocks.map((block, index) => (
        <DocumentationBlockRenderer
          block={block}
          index={index}
          key={`${text(block.kind)}:${String(index)}`}
        />
      ))}
      {previous || next ? (
        <>
          <Divider />
          <Box
            component="nav"
            aria-label="Adjacent documentation"
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <Box>
              {previous ? (
                <Button
                  component={RouterLink}
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  to={previous.route}
                  variant="outlined"
                >
                  ← {previous.title}
                </Button>
              ) : null}
            </Box>
            <Box>
              {next ? (
                <Button
                  component={RouterLink}
                  fullWidth
                  sx={{ justifyContent: 'flex-end', textAlign: 'right' }}
                  to={next.route}
                  variant="outlined"
                >
                  {next.title} →
                </Button>
              ) : null}
            </Box>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
