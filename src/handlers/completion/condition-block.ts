import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import type { ConditionBlockLocation } from '../../lib/iam-policy/location.ts';
import { type CompletionContext, partialRange } from './index.ts';

const conditionBlockAttributes: Record<string, { description: string }> = {
  test: {
    description: 'The condition operator to evaluate (e.g., `StringEquals`, `ArnLike`, `IpAddress`).',
  },
  variable: {
    description: 'The condition key to evaluate (e.g., `aws:SourceIp`, `s3:prefix`).',
  },
  values: {
    description: 'List of values to compare against the condition key.',
  },
};

export function completeConditionBlock(location: ConditionBlockLocation, context: CompletionContext): CompletionList {
  const siblingKeys = context.handler.getSiblingKeys(context.uri, context.position);
  const range = partialRange(context.position, location.partial.length);
  const items: CompletionItem[] = [];
  for (const [name, attr] of Object.entries(conditionBlockAttributes)) {
    if (siblingKeys.includes(name)) continue;
    if (location.partial && !name.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
    items.push({
      label: name,
      kind: CompletionItemKind.Field,
      textEdit: { range, newText: name },
      documentation: {
        kind: MarkupKind.Markdown,
        value: attr.description,
      },
    });
  }
  return { items, isIncomplete: false };
}
