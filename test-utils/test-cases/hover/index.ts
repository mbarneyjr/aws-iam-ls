import { readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const CURSOR_MARKER = '$0';

const extToLang: Record<string, 'yaml' | 'json' | 'hcl'> = {
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.tf': 'hcl',
};

export interface HoverTestCase {
  filename: string;
  category: string;
  lang: 'yaml' | 'json' | 'hcl';
  doc: string;
  position: { line: number; character: number };
  includes?: string[];
  isNull: boolean;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter');
  return { meta: parseYaml(match[1]), body: match[2] };
}

function parseTestCaseFile(dir: string, category: string, filename: string): HoverTestCase {
  const ext = extname(filename);
  const lang = extToLang[ext];
  if (!lang) throw new Error(`Unknown extension: ${ext}`);

  const raw = readFileSync(resolve(dir, filename), 'utf-8');
  const { meta, body } = parseFrontmatter(raw);

  const cursorIndex = body.indexOf(CURSOR_MARKER);
  if (cursorIndex === -1) throw new Error(`Missing ${CURSOR_MARKER} cursor marker in ${filename}`);

  const beforeCursor = body.slice(0, cursorIndex);
  const lines = beforeCursor.split('\n');
  const line = lines.length - 1;
  const character = lines[line].length;

  const doc = body.replace(CURSOR_MARKER, '');

  return {
    filename,
    category,
    lang,
    doc,
    position: { line, character },
    includes: meta.includes as string[] | undefined,
    isNull: (meta.isNull as boolean) ?? false,
  };
}

export function loadHoverTests(category: string): HoverTestCase[] {
  const dir = resolve(import.meta.dirname, category);
  return readdirSync(dir)
    .filter((f) => Object.keys(extToLang).includes(extname(f)))
    .sort()
    .map((f) => parseTestCaseFile(dir, category, f));
}
