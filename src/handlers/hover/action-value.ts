import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { ActionValueLocation } from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import { formatActionDocumentation } from '../completion/action-value.ts';

export function handleActionValueHover(location: ActionValueLocation): Hover | null {
  const action = ServiceReference.getAction(location.value);
  if (!action) return null;

  const lines: string[] = [`**${action.service}:${action.name}**`];
  if (action.description) lines.push(action.description);
  const docs = formatActionDocumentation(action);
  if (docs) lines.push(docs);

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join('\n\n'),
    },
  };
}
