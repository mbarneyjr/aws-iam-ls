import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { PrincipalBlockTypeLocation, PrincipalTypeLocation } from '../../lib/iam-policy/location.ts';
import { principalTypes } from '../../lib/iam-policy/principals.ts';

export function handlePrincipalTypeHover(location: PrincipalTypeLocation | PrincipalBlockTypeLocation): Hover | null {
  if (location.value === '*') {
    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value: '**Public (unauthenticated) access**\n\nMatches all principals, including anonymous users.',
      },
    };
  }

  for (const principalType of Object.values(principalTypes)) {
    if (principalType.value === location.value) {
      return {
        range: location.range,
        contents: {
          kind: MarkupKind.Markdown,
          value: principalType.description,
        },
      };
    }
  }

  return null;
}
