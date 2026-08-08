/*
    Nodics - Enterprice Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is the confidential and proprietary information of Nodics ("Confidential Information").
    You shall not disclose such Confidential Information and shall use it only in accordance with the
    terms of the license agreement you entered into with Nodics.

 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function markdownWordCount(value: string): number {
  return (value.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) ?? []).length;
}

function markdownHeadings(value: string): readonly string[] {
  return value.split(/\r?\n/).flatMap((line) => {
    const match = /^#{2,4}\s+(.+)$/.exec(line.trim());
    return match?.[1] ? [match[1]] : [];
  });
}

function requireClauses(relativePath: string, clauses: string[]): void {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const clause of clauses) {
    expect(content, `${relativePath} must preserve: ${clause}`).toContain(clause);
  }
}

describe('Axis distributed implementation documentation', () => {
  it('ships a directly importable immutable documentation content pack', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'manifest/docs-content-pack.json'), 'utf8'),
    ) as {
      readonly pack: string;
      readonly generatedHashes: Readonly<Record<string, string>>;
      readonly releaseChecksum: string;
    };
    expect(manifest.pack).toBe('nodics.axis');
    for (const [relativePath, expectedHash] of Object.entries(
      manifest.generatedHashes,
    )) {
      const actualHash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest('hex');
      expect(actualHash, relativePath).toBe(expectedHash);
    }
    const releaseChecksum = crypto
      .createHash('sha256')
      .update(
        Object.keys(manifest.generatedHashes)
          .sort()
          .map(
            (fileName) => `${fileName}:${String(manifest.generatedHashes[fileName])}`,
          )
          .join('|'),
      )
      .digest('hex');
    expect(releaseChecksum).toBe(manifest.releaseChecksum);
  });

  it('generates every granular Axis page from canonical source without losing README or docs detail', () => {
    const navigation = JSON.parse(
      fs.readFileSync(path.join(root, 'content/documentation/navigation.json'), 'utf8'),
    ) as {
      readonly pages: readonly {
        readonly title: string;
        readonly source: string;
        readonly evidence: string;
        readonly route: string;
      }[];
    };
    const register = JSON.parse(
      fs.readFileSync(
        path.join(root, 'content/documentation/migration-register.json'),
        'utf8',
      ),
    ) as {
      readonly sources: readonly {
        readonly evidence: string;
        readonly evidenceStatus: string;
        readonly evidenceHash: string;
        readonly evidenceWordCount: number;
        readonly evidenceHeadings: readonly string[];
        readonly canonicalSource: string;
        readonly destinationRoute: string;
        readonly disposition: string;
        readonly wordCount: number;
        readonly headings: readonly string[];
      }[];
    };
    const expectedEvidence = navigation.pages.map((page) => page.evidence).sort();

    expect(register.sources.map((source) => source.evidence).sort()).toEqual(
      expectedEvidence,
    );
    expect(navigation.pages).toHaveLength(expectedEvidence.length);
    expect(
      fs.existsSync(path.join(root, 'docs'))
        ? fs.readdirSync(path.join(root, 'docs')).filter((name) => name.endsWith('.md'))
        : [],
    ).toEqual([]);

    const generatedComponents = fs.readFileSync(
      path.join(root, 'data/core/data/documentation/axisDocumentationComponentData.js'),
      'utf8',
    );
    for (const page of navigation.pages) {
      const migration = register.sources.find(
        (source) => source.evidence === page.evidence,
      );
      expect(migration).toBeDefined();
      expect(migration?.disposition).toBe('migrated');
      expect(migration?.destinationRoute).toBe(page.route);

      const canonical = fs.readFileSync(
        path.join(root, 'content/documentation', page.source),
        'utf8',
      );
      expect(markdownWordCount(canonical)).toBeGreaterThanOrEqual(
        migration?.evidenceWordCount ?? Number.POSITIVE_INFINITY,
      );
      expect(migration?.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(migration?.evidenceHeadings.length).toBeGreaterThan(0);
      expect(migration?.evidenceStatus).toBe(
        page.evidence === 'README.md'
          ? 'retained-high-level-summary'
          : 'retired-after-verified-migration',
      );
      expect(migration?.wordCount).toBe(markdownWordCount(canonical));
      expect(migration?.headings).toEqual(markdownHeadings(canonical));
      expect(generatedComponents).toContain(page.title);
      expect(generatedComponents).toContain(`content/documentation/${page.source}`);
    }
  });

  it('keeps partial-discovery and repository ownership rules enforceable', () => {
    requireClauses('AGENTS.md', [
      'Design Axis for partial discovery',
      'successful, unauthorized',
      'business-user, administrator, backend contract',
      'CMS-delivered component properties as the authority',
      'Never localize by parsing English error text',
      'Backend-driven presentation remains declarative and non-executable',
      'Every implemented Axis functionality must include a dedicated safe',
      'Every project and module keeps a concise README',
    ]);
    requireClauses(
      'content/documentation/pages/implementation-and-documentation-contract.md',
      [
        '## Local Discovery Chain',
        '## Repository Ownership',
        '## Placement Rules',
        '## Required Feature Documentation',
        '### Successful',
        '### Unauthorized',
        '### Boundary',
        '### Failure And Recovery',
        '### Customization',
        'Customize and extend safely',
        'Configurable page copy comes from CMS component properties',
        'Locale, channel, and backend-resolved fallback',
        '## Acceptance',
      ],
    );
    requireClauses('content/documentation/pages/feature-delivery-checklist.md', [
      '## 7. Partial-discovery and use-case proof',
      'successful, unauthorized/invalid, boundary/responsive',
      'Link Nodics-owned business and backend guidance',
      'long translated labels, right-to-left direction',
    ]);
  });

  it('gives every canonical feature page a safe customization path', () => {
    const navigation = JSON.parse(
      fs.readFileSync(path.join(root, 'content/documentation/navigation.json'), 'utf8'),
    ) as {
      readonly pages: readonly { readonly source: string }[];
    };
    for (const page of navigation.pages) {
      const canonical = fs.readFileSync(
        path.join(root, 'content', 'documentation', page.source),
        'utf8',
      );
      expect(canonical, page.source).toContain('## Customize and extend safely');
    }
  });
});
