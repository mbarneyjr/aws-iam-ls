import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { Language, Parser } from 'web-tree-sitter';
import { loadCompletionTests } from './test-cases/completion/index.ts';

await Parser.init();

const grammarDir = resolve(import.meta.dirname, '../src/grammars');
const grammars: Record<string, Language> = {
  yaml: await Language.load(resolve(grammarDir, 'tree-sitter-yaml.wasm')),
  json: await Language.load(resolve(grammarDir, 'tree-sitter-json.wasm')),
  hcl: await Language.load(resolve(grammarDir, 'tree-sitter-hcl.wasm')),
};

function printTree(node: Node, indent = 0): string {
  const pos = `[${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}]`;
  const text = node.childCount === 0 ? ` ${JSON.stringify(node.text)}` : '';
  let result = `${' '.repeat(indent)}${node.type} ${pos}${text}\n`;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) result += printTree(child, indent + 2);
  }
  return result;
}

function ancestorChain(node: Node): string {
  const parts: string[] = [];
  let current: Node | null = node;
  while (current) {
    parts.push(current.type);
    current = current.parent;
  }
  return parts.join(' > ');
}

const completionDir = resolve(import.meta.dirname, './test-cases/completion');

for (const dirName of readdirSync(completionDir).sort()) {
  const dirPath = resolve(completionDir, dirName);
  if (!statSync(dirPath).isDirectory()) continue;

  const tests = loadCompletionTests(dirName);

  for (const t of tests) {
    const parser = new Parser();
    parser.setLanguage(grammars[t.lang]);
    const tree = parser.parse(t.doc);
    if (!tree) continue;

    let output = '';
    output += `category: ${t.category}\n`;
    output += `filename: ${t.filename}\n`;
    output += `cursor: (${t.position.line}, ${t.position.character})\n`;
    output += `doc: ${JSON.stringify(t.doc)}\n`;
    output += '\n';
    output += printTree(tree.rootNode);

    const node = tree.rootNode.descendantForPosition({
      row: t.position.line,
      column: t.position.character,
    });
    if (node) {
      output += `\ncursor node: type="${node.type}" text=${JSON.stringify(node.text.slice(0, 60))}\n`;
      output += `chain: ${ancestorChain(node)}\n`;
    }

    const baseName = t.filename.replace(/\.[^.]+$/, '');
    const outPath = resolve(dirPath, `${baseName}.ast.txt`);
    writeFileSync(outPath, output);
    console.log(`wrote ${outPath}`);

    tree.delete();
  }
}
