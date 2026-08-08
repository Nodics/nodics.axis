import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = path.join(root, 'content/documentation');
const navigationPath = path.join(sourceRoot, 'navigation.json');
const pageOutputPath = path.join(
  root,
  'data/core/data/documentation/axisDocumentationPageData.js',
);
const componentOutputPath = path.join(
  root,
  'data/core/data/documentation/axisDocumentationComponentData.js',
);
const routeOutputPath = path.join(
  root,
  'data/core/data/documentation/axisDocumentationRouteData.js',
);
const migrationRegisterPath = path.join(
  root,
  'content/documentation/migration-register.json',
);
const manifestPath = path.join(root, 'manifest/docs-content-pack.json');
const checkOnly = process.argv.includes('--check');

const navigation = JSON.parse(fs.readFileSync(navigationPath, 'utf8'));
const pages = navigation.pages;
const previousMigrationRegister = fs.existsSync(migrationRegisterPath)
  ? JSON.parse(fs.readFileSync(migrationRegisterPath, 'utf8'))
  : { sources: [] };
const previousMigrationByEvidence = new Map(
  previousMigrationRegister.sources.map((source) => [source.evidence, source]),
);
const routeByEvidence = new Map(
  pages.map((page) => [page.evidence.replace(/^docs\//, ''), page.route]),
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function wordCount(value) {
  return (value.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || []).length;
}

function markdownHeadings(value) {
  return value.split(/\r?\n/).flatMap((line) => {
    const match = /^#{2,4}\s+(.+)$/.exec(line.trim());
    return match?.[1] ? [match[1]] : [];
  });
}

function normalizeLinks(value) {
  return value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, targetValue) => {
    const target = targetValue.trim();
    const [pathValue, anchor] = target.split('#');
    if (!pathValue.endsWith('.md')) return match;
    const baseName = path.basename(pathValue);
    const route =
      baseName === 'README.md' ? '/docs/nodics-axis' : routeByEvidence.get(baseName);
    if (!route) return match;
    return `[${label}](${route}${anchor ? `#${anchor}` : ''})`;
  });
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => normalizeLinks(cell.trim()));
}

function isTableSeparator(line) {
  const cells = tableCells(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
  );
}

function parseMarkdown(markdown, pageCode) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let index = 0;
  let headingIndex = 0;

  const flushParagraph = () => {
    const value = paragraph.join(' ').trim();
    paragraph = [];
    if (value) blocks.push({ kind: 'paragraph', text: normalizeLinks(value) });
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      const language = trimmed.slice(3).trim() || 'text';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: 'code', language, text: code.join('\n') });
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      if (level > 1) {
        headingIndex += 1;
        const text = normalizeLinks(heading[2].trim());
        blocks.push({
          kind: 'heading',
          level,
          text,
          anchor: `${pageCode}-${headingIndex}-${slug(text)}`,
        });
      }
      index += 1;
      continue;
    }

    if (
      trimmed.includes('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      flushParagraph();
      const headers = tableCells(trimmed);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      const items = [unordered[1]];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        const current = lines[index].trim();
        const item = /^[-*]\s+(.+)$/.exec(current);
        if (item) {
          items.push(item[1]);
          index += 1;
          continue;
        }
        if (
          /^(#{1,4})\s+/.test(current) ||
          /^\d+\.\s+/.test(current) ||
          current.startsWith('```') ||
          current.startsWith('>')
        ) {
          break;
        }
        items[items.length - 1] += ` ${current}`;
        index += 1;
      }
      blocks.push({
        kind: 'unordered-list',
        items: items.map((item) => normalizeLinks(item)),
      });
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      const items = [ordered[1]];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        const current = lines[index].trim();
        const item = /^\d+\.\s+(.+)$/.exec(current);
        if (item) {
          items.push(item[1]);
          index += 1;
          continue;
        }
        if (
          /^(#{1,4})\s+/.test(current) ||
          /^[-*]\s+/.test(current) ||
          current.startsWith('```') ||
          current.startsWith('>')
        ) {
          break;
        }
        items[items.length - 1] += ` ${current}`;
        index += 1;
      }
      blocks.push({
        kind: 'ordered-list',
        items: items.map((item) => normalizeLinks(item)),
      });
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({
        kind: 'blockquote',
        text: normalizeLinks(quote.join(' ').trim()),
      });
      continue;
    }

    if (!trimmed || /^-{3,}$/.test(trimmed)) {
      flushParagraph();
      index += 1;
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function recordModule(records, description) {
  return `'use strict';\n\n/** @description ${description} */\nmodule.exports = ${JSON.stringify(
    records,
    null,
    2,
  )};\n`;
}

async function writeOrCheck(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  const prettierConfig = (await prettier.resolveConfig(absolutePath)) || {};
  const formattedContent = await prettier.format(content, {
    ...prettierConfig,
    filepath: absolutePath,
  });
  if (checkOnly) {
    const current = fs.existsSync(absolutePath)
      ? fs.readFileSync(absolutePath, 'utf8')
      : undefined;
    if (current !== formattedContent) {
      throw new Error(`Generated documentation is stale: ${relativePath}`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, formattedContent);
}

const sourcePages = pages.map((page) => {
  const sourcePath = path.join(sourceRoot, page.source);
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const blocks = parseMarkdown(markdown, page.code);
  const headings = blocks
    .filter((block) => block.kind === 'heading')
    .map((block) => ({
      text: block.text,
      anchor: block.anchor,
      level: block.level,
    }));
  return {
    ...page,
    markdown,
    blocks,
    headings,
    sourceHash: sha256(markdown),
    wordCount: wordCount(markdown),
  };
});

const navigationItems = sourcePages.map((page) => ({
  code: `axis.${page.code}`,
  title: page.title,
  route: page.route,
  section: slug(page.section),
  sectionTitle: page.section,
  sectionOrder: page.sectionOrder,
  order: page.order,
  audience: page.audience,
  summary: page.summary,
  searchText: `${page.title} ${page.summary} ${page.markdown}`,
}));

const navigationComponent = {
  code: 'axisDocumentationNavigation',
  typeCode: 'axisDocumentationNavigationComponentType',
  renderer: 'documentation.component.navigation',
  accessMode: 'AUTHENTICATED',
  properties: {
    title: navigation.title,
    searchLabel: 'Search Nodics Axis documentation',
    searchPlaceholder:
      'Search setup, architecture, features, security, and troubleshooting',
    emptyMessage: 'No Nodics Axis documentation matches your search.',
    sections: Array.from(
      new Map(
        sourcePages.map((page) => [
          page.section,
          {
            code: slug(page.section),
            title: page.section,
            order: page.sectionOrder,
          },
        ]),
      ).values(),
    ),
    items: navigationItems,
  },
  active: true,
};

const pageRecords = Object.fromEntries(
  sourcePages.map((page, index) => [
    `record${index}`,
    {
      code: `axisDocsPage${page.code.replaceAll('-', '')}`,
      name: page.title,
      cmsSite: ['axisDocumentationSite'],
      typeCode: 'axisDocumentationArticlePageType',
      template: 'axisDocumentationArticleTemplate',
      renderer: 'documentation.page.article',
      cmsComponents: [
        {
          target: 'axisDocumentationNavigation',
          slot: 'navigation',
          index: 5,
          active: true,
        },
        {
          target: `axisDocsComponent${page.code.replaceAll('-', '')}`,
          slot: 'article',
          index: 10,
          active: true,
        },
      ],
      active: true,
    },
  ]),
);

const routeRecords = Object.fromEntries(
  sourcePages.map((page, index) => [
    `record${index}`,
    {
      code: `axisDocsRoute${page.code.replaceAll('-', '')}`,
      site: 'axisDocumentationSite',
      path: page.route,
      locale: 'en',
      channel: 'web',
      page: `axisDocsPage${page.code.replaceAll('-', '')}`,
      routeType: 'PAGE',
      deliveryState: 'ONLINE',
      accessMode: 'AUTHENTICATED',
      active: true,
    },
  ]),
);

const articleRecords = Object.fromEntries(
  sourcePages.map((page, index) => [
    `record${index + 1}`,
    {
      code: `axisDocsComponent${page.code.replaceAll('-', '')}`,
      typeCode: 'axisDocumentationArticleComponentType',
      renderer: 'documentation.component.article',
      accessMode: 'AUTHENTICATED',
      properties: {
        code: `axis.${page.code}`,
        title: page.title,
        route: page.route,
        section: slug(page.section),
        sectionTitle: page.section,
        category: page.section,
        audience: page.audience,
        summary: page.summary,
        headings: page.headings,
        blocks: page.blocks,
        searchText: navigationItems[index].searchText,
        source: {
          repository: 'nodics.axis',
          path: `content/documentation/${page.source}`,
          evidence: page.evidence,
          hash: page.sourceHash,
          version: navigation.version,
        },
        previous:
          index > 0
            ? {
                title: sourcePages[index - 1].title,
                route: sourcePages[index - 1].route,
              }
            : undefined,
        next:
          index < sourcePages.length - 1
            ? {
                title: sourcePages[index + 1].title,
                route: sourcePages[index + 1].route,
              }
            : undefined,
      },
      active: true,
    },
  ]),
);

const componentRecords = {
  record0: navigationComponent,
  ...articleRecords,
};

const migrationRegister = {
  pack: navigation.pack,
  version: navigation.version,
  generatedAtPolicy: 'deterministic-no-timestamp',
  sources: sourcePages.map((page) => {
    const evidencePath = path.join(root, page.evidence);
    const previousEvidence = previousMigrationByEvidence.get(page.evidence);
    const evidence = fs.existsSync(evidencePath)
      ? fs.readFileSync(evidencePath, 'utf8')
      : undefined;
    const evidenceHash =
      previousEvidence?.evidenceHash ?? (evidence && sha256(evidence));
    const evidenceWordCount =
      previousEvidence?.evidenceWordCount ?? (evidence && wordCount(evidence));
    const evidenceHeadings =
      previousEvidence?.evidenceHeadings ?? (evidence && markdownHeadings(evidence));
    if (
      typeof evidenceHash !== 'string' ||
      typeof evidenceWordCount !== 'number' ||
      !Array.isArray(evidenceHeadings)
    ) {
      throw new Error(`Migration evidence is unavailable: ${page.evidence}`);
    }
    return {
      evidence: page.evidence,
      evidenceStatus:
        page.evidence === 'README.md'
          ? 'retained-high-level-summary'
          : 'retired-after-verified-migration',
      evidenceHash,
      evidenceWordCount,
      evidenceHeadings,
      canonicalSource: `content/documentation/${page.source}`,
      destinationRoute: page.route,
      disposition: 'migrated',
      sourceHash: page.sourceHash,
      wordCount: page.wordCount,
      headings: page.headings.map((heading) => heading.text),
    };
  }),
};

await writeOrCheck(
  path.relative(root, pageOutputPath),
  recordModule(pageRecords, 'Generated Nodics Axis documentation pages.'),
);
await writeOrCheck(
  path.relative(root, componentOutputPath),
  recordModule(
    componentRecords,
    'Generated Nodics Axis documentation navigation and article content.',
  ),
);
await writeOrCheck(
  path.relative(root, routeOutputPath),
  recordModule(
    routeRecords,
    'Generated authenticated Nodics Axis documentation routes.',
  ),
);
await writeOrCheck(
  path.relative(root, migrationRegisterPath),
  `${JSON.stringify(migrationRegister, null, 2)}\n`,
);

const generatedFiles = [
  'data/core/data/documentation/axisDocumentationCatalogData.js',
  'data/core/data/documentation/axisDocumentationComponentData.js',
  'data/core/data/documentation/axisDocumentationPageData.js',
  'data/core/data/documentation/axisDocumentationRendererData.js',
  'data/core/data/documentation/axisDocumentationRouteData.js',
  'data/core/data/documentation/axisDocumentationSiteData.js',
  'data/core/data/documentation/axisDocumentationSlotData.js',
  'data/core/data/documentation/axisDocumentationTemplateData.js',
  'data/core/data/documentation/axisDocumentationTypeCodeData.js',
  'data/core/headers/axisDocumentationContentPackHeader.js',
];
const generatedHashes = Object.fromEntries(
  generatedFiles.map((fileName) => [
    fileName,
    sha256(fs.readFileSync(path.join(root, fileName))),
  ]),
);
const releaseChecksum = sha256(
  Object.keys(generatedHashes)
    .sort()
    .map((fileName) => `${fileName}:${generatedHashes[fileName]}`)
    .join('|'),
);
const manifest = {
  pack: navigation.pack,
  version: navigation.version,
  contractVersion: navigation.contractVersion,
  sourceMode: 'canonical-structured-source',
  sourceAuthority: 'content/documentation',
  sites: ['axisDocumentationSite'],
  accessMode: 'AUTHENTICATED',
  pages: sourcePages.length,
  components: sourcePages.length + 1,
  routes: sourcePages.length,
  migrationRegister: 'content/documentation/migration-register.json',
  releaseChecksum,
  generatedHashes,
};
await writeOrCheck(
  path.relative(root, manifestPath),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  `${checkOnly ? 'Validated' : 'Generated'} ${sourcePages.length} Axis documentation pages`,
);
