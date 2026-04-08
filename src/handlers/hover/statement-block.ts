import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { StatementBlockLocation } from '../../lib/iam-policy/location.ts';
import { findHclElement } from '../completion/statement-block.ts';

export function handleStatementBlockHover(location: StatementBlockLocation): Hover | null {
  const element = findHclElement(location.value);
  if (!element) return null;

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: element.description,
    },
  };
}
