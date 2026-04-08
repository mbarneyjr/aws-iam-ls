import { type Hover, MarkupKind } from 'vscode-languageserver';
import { conditionOperators } from '../../lib/iam-policy/condition-operators.ts';
import type { ConditionOperatorLocation } from '../../lib/iam-policy/location.ts';

export function handleConditionOperatorHover(location: ConditionOperatorLocation): Hover | null {
  const operator = conditionOperators[location.value as keyof typeof conditionOperators];
  if (!operator) return null;

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: operator.description,
    },
  };
}
