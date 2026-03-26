import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import type { StatementKeyLocation } from '../../lib/iam-policy/location.ts';
import { StatementKeys } from '../../lib/iam-policy/statement-keys.ts';
import type { StatementContext } from '../../lib/treesitter/base.ts';
import { type CompletionContext, partialRange } from './index.ts';

export function completeStatementKey(location: StatementKeyLocation, context: CompletionContext): CompletionList {
  const statement = context.handler.getStatementContext(context.uri, context.position);
  const existingKeys = deriveExistingKeys(statement);
  const existingGroups = new Set<string>();
  for (const key of existingKeys) {
    const element = StatementKeys[key];
    if (element) existingGroups.add(element.group);
  }

  const range = partialRange(context.position, location.partial.length);
  const items: CompletionItem[] = [];
  for (const [name, element] of Object.entries(StatementKeys)) {
    if (existingKeys.includes(name)) continue;
    if (existingGroups.has(element.group)) continue;
    if (location.partial && !name.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
    items.push({
      label: name,
      kind: CompletionItemKind.Field,
      textEdit: { range, newText: name },
      documentation: {
        kind: MarkupKind.Markdown,
        value: element.description,
      },
    });
  }

  return { items, isIncomplete: false };
}

function deriveExistingKeys(statement: StatementContext | null): string[] {
  if (!statement) return [];
  const keys: string[] = [];
  for (const name of Object.keys(StatementKeys)) {
    if (name in statement) {
      keys.push(name);
    }
  }
  return keys;
}
