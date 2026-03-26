import type { CompletionList } from 'vscode-languageserver';
import type { PrincipalTypedValueLocation } from '../../lib/iam-policy/location.ts';
import type { CompletionContext } from './index.ts';
import { completePrincipalIdentifier } from './principal-identifier-completions.ts';

export function completePrincipalTypedValue(
  location: PrincipalTypedValueLocation,
  context: CompletionContext,
): CompletionList {
  return completePrincipalIdentifier(location.principalType, location.partial, context.position);
}
