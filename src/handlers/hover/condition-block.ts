import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { ConditionBlockLocation } from '../../lib/iam-policy/location.ts';

const conditionBlockAttributes: Record<string, string> = {
  test: 'The condition operator to evaluate (e.g., `StringEquals`, `ArnLike`, `IpAddress`).',
  variable: 'The condition key to evaluate (e.g., `aws:SourceIp`, `s3:prefix`).',
  values: 'List of values to compare against the condition key.',
};

export function handleConditionBlockHover(location: ConditionBlockLocation): Hover | null {
  const description = conditionBlockAttributes[location.value];
  if (!description) return null;

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: description,
    },
  };
}
