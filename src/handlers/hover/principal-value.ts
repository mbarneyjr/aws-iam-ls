import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { PrincipalValueLocation } from '../../lib/iam-policy/location.ts';

export function handlePrincipalValueHover(location: PrincipalValueLocation): Hover | null {
  if (location.value === '*') {
    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value:
          '**Public (unauthenticated) access**\n\nMatches all principals, including anonymous users.\n\n> **Warning:** Combining `"Principal": "*"` with `"Effect": "Allow"` grants public access. Always scope with a `Condition` element unless public access is intended.',
      },
    };
  }

  return null;
}
