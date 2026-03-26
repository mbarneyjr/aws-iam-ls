import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import type { StatementBlockLocation } from '../../lib/iam-policy/location.ts';
import { StatementKeys } from '../../lib/iam-policy/statement-keys.ts';
import type { StatementContext } from '../../lib/treesitter/base.ts';
import { type CompletionContext, partialRange } from './index.ts';

export function completeStatementBlock(location: StatementBlockLocation, context: CompletionContext): CompletionList {
  const statement = context.handler.getStatementContext(context.uri, context.position);
  const existingKeys = deriveExistingKeys(statement);
  const existingGroups = new Set<string>();
  for (const key of existingKeys) {
    const element = findHclElement(key);
    if (element) existingGroups.add(element.group);
  }

  const range = partialRange(context.position, location.partial.length);
  const items: CompletionItem[] = [];
  for (const [, element] of Object.entries(StatementKeys)) {
    if (existingKeys.includes(element.hclKey)) continue;
    if (existingGroups.has(element.group)) continue;
    if (location.partial && !element.hclKey.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
    items.push({
      label: element.hclKey,
      kind: CompletionItemKind.Field,
      textEdit: { range, newText: element.hclKey },
      documentation: {
        kind: MarkupKind.Markdown,
        value: element.description,
      },
    });
  }

  return { items, isIncomplete: false };
}

export function findHclElement(key: string) {
  for (const [, element] of Object.entries(StatementKeys)) {
    if (element.hclKey === key) return element;
  }
  return null;
}

function deriveExistingKeys(statement: StatementContext | null): string[] {
  if (!statement) return [];
  const keys: string[] = [];
  for (const [name, element] of Object.entries(StatementKeys)) {
    // sub-blocks (condition, principals, not_principals) allow multiples — never exclude them
    if (name === 'Condition' || name === 'Principal' || name === 'NotPrincipal') continue;
    if (name in statement) {
      keys.push(element.hclKey);
    }
  }
  return keys;
}
