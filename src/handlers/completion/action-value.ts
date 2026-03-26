import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import type { ActionValueLocation } from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import type { Action } from '../../lib/iam-policy/reference/types.ts';
import { type CompletionContext, partialRange } from './index.ts';

export function completeActionValue(location: ActionValueLocation, context: CompletionContext): CompletionList {
  const potentialLabels = ServiceReference.getAllActions();
  const range = partialRange(context.position, location.partial.length);
  const items: CompletionItem[] = [];
  for (const label of potentialLabels) {
    if (location.partial && !label.toLowerCase().startsWith(location.partial.toLowerCase())) continue;
    const item: CompletionItem = {
      label,
      kind: CompletionItemKind.Enum,
      textEdit: { range, newText: label },
    };
    const [service, actionName] = label.split(':');
    if (service && actionName) {
      const action = ServiceReference.getAction(service, actionName);
      if (action) {
        item.detail = action.description;
        if (action.description) {
          item.documentation = {
            kind: MarkupKind.Markdown,
            value: formatActionDocumentation(action),
          };
        }
      }
    }
    items.push(item);
  }
  return { items, isIncomplete: false };
}

function formatActionDocumentation(action: Action): string {
  const parts: string[] = [];

  if (action.accessLevel) parts.push(`**Access Level**: ${action.accessLevel}`);

  if (action.resourceTypes && action.resourceTypes.length > 0) {
    const resources = action.resourceTypes.map((resourceType) =>
      resourceType.required ? `- \`${resourceType.name}\` *(required)*` : `- \`${resourceType.name}\``,
    );
    parts.push(`**Resource types**\n${resources.join('\n')}`);
  }

  if (action.conditionKeys.length > 0) {
    const keys = action.conditionKeys.map((key) => `- \`${key}\``);
    parts.push(`**Condition keys**\n${keys.join('\n')}`);
  }

  if (action.dependentActions && action.dependentActions.length > 0) {
    parts.push(`**Dependent actions:** ${action.dependentActions.map((depAction) => `\`${depAction}\``).join(', ')}`);
  }

  return parts.join('\n\n');
}
