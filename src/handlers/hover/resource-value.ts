import { type Hover, MarkupKind } from 'vscode-languageserver';
import { parseArn } from '../../lib/iam-policy/arn.ts';
import type { ResourceValueLocation } from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';

export function handleResourceValueHover(location: ResourceValueLocation): Hover | null {
  if (location.value === '*') {
    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value:
          'Matches **all resources**.\n\nSome actions do not support resource-level permissions and require `"Resource": "*"`.',
      },
    };
  }

  const parsed = parseArn(location.value);
  if (!parsed) return null;

  const resources = ServiceReference.getResources(parsed);
  if (resources.length === 0) return null;

  const lines: string[] = [];
  for (let i = 0; i < resources.length; i++) {
    lines.push(`**${parsed.service} ${resources[i].name}**`);
    if (resources[i].arnFormats.length > 0) {
      lines.push('\n**ARNs**');
      for (const format of resources[i].arnFormats) {
        lines.push(`- \`${format}\``);
      }
    }
    if (resources[i].conditionKeys.length > 0) {
      lines.push('\n**Condition keys**');
      for (const key of resources[i].conditionKeys) {
        lines.push(`- \`${key}\``);
      }
    }
    if (i + 1 !== resources.length) lines.push('\n---\n');
  }

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: lines.join('\n'),
    },
  };
}
