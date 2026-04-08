import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { PrincipalBlockLocation } from '../../lib/iam-policy/location.ts';

const principalBlockAttributes: Record<string, string> = {
  type: 'The type of principal. Valid values: `*`, `AWS`, `Service`, `Federated`, `CanonicalUser`.',
  identifiers: 'List of principal identifiers. The format depends on the `type` attribute.',
};

export function handlePrincipalBlockHover(location: PrincipalBlockLocation): Hover | null {
  const description = principalBlockAttributes[location.value];
  if (!description) return null;

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: description,
    },
  };
}
