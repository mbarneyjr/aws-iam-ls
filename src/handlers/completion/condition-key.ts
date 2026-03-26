import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import type { ConditionKeyLocation } from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import type { ConditionKey, GlobalConditionKey } from '../../lib/iam-policy/reference/types.ts';
import { expandActionPattern } from '../../lib/iam-policy/wildcard.ts';
import { type CompletionContext, partialRange } from './index.ts';

export function completeConditionKey(location: ConditionKeyLocation, context: CompletionContext): CompletionList {
  const statement = context.handler.getStatementContext(context.uri, context.position);
  const existingKeys = location.operator ? Object.keys(statement?.Condition?.[location.operator] ?? {}) : [];
  const range = partialRange(context.position, location.partial.length);
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  // Build a lookup for global keys so we can enrich service-specific keys with descriptions
  const globalByName = new Map<string, GlobalConditionKey>();
  for (const global of ServiceReference.getGlobalConditionKeys()) {
    globalByName.set(global.name, global);
  }

  // Action-specific condition keys
  const actions = statement?.Action ?? statement?.NotAction;
  if (actions && actions.length > 0) {
    const expandedActions: string[] = [];
    for (const action of actions) {
      for (const expanded of expandActionPattern(action)) {
        expandedActions.push(expanded);
      }
    }

    for (const key of ServiceReference.getConditionKeysForActions(expandedActions)) {
      if (seen.has(key.name)) continue;
      if (existingKeys.includes(key.name)) continue;
      if (location.partial && !key.name.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
      seen.add(key.name);

      const global = globalByName.get(key.name);
      const service = key.name.split(':')[0];
      const conditionKeyData = service ? ServiceReference.getConditionKey(service, key.name) : undefined;
      items.push({
        label: key.name,
        kind: CompletionItemKind.Property,
        textEdit: { range, newText: key.name },
        documentation: {
          kind: MarkupKind.Markdown,
          value: formatDocumentation(key.types, global, conditionKeyData),
        },
      });
    }
  }

  // Global condition keys not already added via action-specific keys
  for (const global of ServiceReference.getGlobalConditionKeys()) {
    if (seen.has(global.name)) continue;
    if (existingKeys.includes(global.name)) continue;
    if (location.partial && !global.name.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
    seen.add(global.name);
    items.push({
      label: global.name,
      kind: CompletionItemKind.Property,
      textEdit: { range, newText: global.name },
      documentation: {
        kind: MarkupKind.Markdown,
        value: formatDocumentation([], global),
      },
    });
  }

  return { items, isIncomplete: false };
}

function formatDocumentation(
  types: string[],
  global: GlobalConditionKey | undefined,
  conditionKey?: ConditionKey,
): string {
  const parts: string[] = [];

  const description = global?.description ?? conditionKey?.description;
  if (description) parts.push(description);

  const meta: string[] = [];
  const type = types.length > 0 ? types.join(', ') : undefined;
  if (type) meta.push(`**Type:** ${type}`);
  if (global?.valueType === 'multi') meta.push('**Value type:** Multivalued');
  if (global?.availability) meta.push(`**Availability:** ${global.availability}`);
  if (meta.length > 0) parts.push(meta.join('\n\n'));

  return parts.join('\n\n');
}
