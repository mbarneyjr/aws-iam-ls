import type { CompletionItem, CompletionList } from 'vscode-languageserver';
import { CompletionItemKind } from 'vscode-languageserver';
import { partitions } from '../../lib/iam-policy/partitions.ts';
import { principalTypes } from '../../lib/iam-policy/principals.ts';
import { partialRange } from './index.ts';

const PARTITION_PLACEHOLDER = `\${Partition}`;
const REGION_PLACEHOLDER = `\${Region}`;
const ACCOUNT_PLACEHOLDER = `\${Account}`;

function getPatternsForType(principalType: string): { arn: string[]; nonArn: string[] } | null {
  switch (principalType) {
    case '*':
      return { arn: [], nonArn: ['*'] };
    case 'AWS':
      return {
        arn: (principalTypes.aws.patterns as readonly string[]).filter((pattern) =>
          pattern.startsWith('arn:'),
        ) as string[],
        nonArn: (principalTypes.aws.patterns as readonly string[]).filter(
          (pattern) => !pattern.startsWith('arn:'),
        ) as string[],
      };
    case 'Federated':
      return {
        arn: (principalTypes.federated.patterns as readonly string[]).filter((pattern) =>
          pattern.startsWith('arn:'),
        ) as string[],
        nonArn: (principalTypes.federated.patterns as readonly string[]).filter(
          (pattern) => !pattern.startsWith('arn:'),
        ) as string[],
      };
    case 'Service':
      return { arn: [], nonArn: [...principalTypes.service.patterns] };
    default:
      return null;
  }
}

export function completePrincipalIdentifier(
  principalType: string | null,
  partial: string,
  position: { line: number; character: number },
): CompletionList {
  if (!principalType) return { items: [], isIncomplete: false };

  const config = getPatternsForType(principalType);
  if (!config) return { items: [], isIncomplete: false };

  const range = partialRange(position, partial.length);
  const items: CompletionItem[] = [];

  if (!partial) {
    for (const pattern of [...config.nonArn, ...config.arn]) {
      items.push({ label: pattern, kind: CompletionItemKind.Value, textEdit: { range, newText: pattern } });
    }
    return { items, isIncomplete: false };
  }

  const parts = partial.split(':');

  if (parts.length === 1) {
    if (config.arn.length > 0 && 'arn'.startsWith(partial.toLowerCase())) {
      items.push({ label: 'arn', kind: CompletionItemKind.Constant, textEdit: { range, newText: 'arn' } });
    }
    for (const pattern of config.nonArn) {
      if (pattern.toLowerCase().startsWith(partial.toLowerCase())) {
        items.push({ label: pattern, kind: CompletionItemKind.Value, textEdit: { range, newText: pattern } });
      }
    }
  } else if (parts.length === 2) {
    for (const [id, partition] of Object.entries(partitions)) {
      const prefix = `${parts[0]}:${id}`;
      if (prefix.toLowerCase().startsWith(partial.toLowerCase())) {
        items.push({
          label: id,
          kind: CompletionItemKind.Enum,
          documentation: { kind: 'markdown', value: partition.name },
        });
      }
    }
  } else if (parts.length === 3) {
    const services = [...new Set(config.arn.map((pattern) => pattern.split(':')[2]))];
    for (const service of services) {
      const prefix = `${parts[0]}:${parts[1]}:${service}`;
      if (prefix.toLowerCase().startsWith(partial.toLowerCase())) {
        items.push({ label: service, kind: CompletionItemKind.Enum });
      }
    }
  } else if (parts.length === 4) {
    const service = parts[2];
    const serviceArns = config.arn.filter((pattern) => pattern.split(':')[2] === service);
    const hasRegionArn = serviceArns.some((pattern) => pattern.split(':')[3].length > 0);
    if (!hasRegionArn) {
      items.push({
        label: ':',
        kind: CompletionItemKind.Enum,
        documentation: { kind: 'markdown', value: 'No region component for this service' },
      });
    } else {
      const partition =
        parts[1] === 'aws' || parts[1] === 'aws-us-gov' || parts[1] === 'aws-cn'
          ? partitions[parts[1]]
          : partitions.aws;
      for (const region of partition.regions) {
        const prefix = `${parts[0]}:${parts[1]}:${parts[2]}:${region.id}`;
        if (prefix.toLowerCase().startsWith(partial.toLowerCase())) {
          items.push({
            label: region.id,
            kind: CompletionItemKind.Enum,
            documentation: { kind: 'markdown', value: region.name },
          });
        }
      }
    }
  } else if (parts.length === 5) {
    const label = `${partial}:`;
    items.push({
      label,
      kind: CompletionItemKind.Enum,
      textEdit: { range, newText: label },
      documentation: { kind: 'markdown', value: 'AWS Account ID' },
    });
  } else {
    const service = parts[2];
    const region = parts[3];
    const account = parts[4];
    const matching = config.arn.filter((pattern) => {
      const patternParts = pattern.split(':');
      if (patternParts[2] !== service) return false;
      if (region.length > 0 !== patternParts[3].length > 0) return false;
      if (account.length > 0 !== patternParts[4].length > 0) return false;
      return true;
    });
    for (const pattern of matching) {
      const label = pattern
        .replace(PARTITION_PLACEHOLDER, parts[1])
        .replace(REGION_PLACEHOLDER, region)
        .replace(ACCOUNT_PLACEHOLDER, account);
      if (!label.toLowerCase().startsWith(partial.toLowerCase())) continue;
      items.push({ label, kind: CompletionItemKind.Value, textEdit: { range, newText: label } });
    }
  }

  return { items, isIncomplete: false };
}
