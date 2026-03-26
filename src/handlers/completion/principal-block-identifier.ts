import type { CompletionList } from 'vscode-languageserver';
import type { PrincipalBlockIdentifierLocation } from '../../lib/iam-policy/location.ts';
import type { CompletionContext } from './index.ts';
import { completePrincipalIdentifier } from './principal-identifier-completions.ts';

export function completePrincipalBlockIdentifier(
  location: PrincipalBlockIdentifierLocation,
  context: CompletionContext,
): CompletionList {
  return completePrincipalIdentifier(location.principalType, location.partial, context.position);
}
