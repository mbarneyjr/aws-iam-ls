import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { EffectValueLocation } from '../../lib/iam-policy/location.ts';

const effectDescriptions: Record<string, string> = {
  Allow: 'Grants access to the specified resources and actions.\n\nBy default, all requests are implicitly denied. An `Allow` overrides implicit denies but never overrides an explicit `Deny`.',
  Deny: 'Explicitly denies access to the specified resources and actions.\n\nAn explicit `Deny` always takes precedence — it overrides any `Allow` statements, regardless of where they appear.',
};

export function handleEffectValueHover(location: EffectValueLocation): Hover | null {
  const description = effectDescriptions[location.value];
  if (!description) return null;

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: description,
    },
  };
}
