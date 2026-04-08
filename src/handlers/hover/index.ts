import type { Connection, Hover, HoverParams } from 'vscode-languageserver';
import { type PolicyLocation, resolvePolicyLocation } from '../../lib/iam-policy/location.ts';
import type { TreeManager } from '../../lib/treesitter/manager.ts';
import { handleActionValueHover } from './action-value.ts';
import { handleConditionBlockHover } from './condition-block.ts';
import { handleConditionKeyHover } from './condition-key.ts';
import { handleConditionOperatorHover } from './condition-operator.ts';
import { handleEffectValueHover } from './effect-value.ts';
import { handlePrincipalBlockHover } from './principal-block.ts';
import { handlePrincipalTypeHover } from './principal-type.ts';
import { handlePrincipalTypedValueHover } from './principal-typed-value.ts';
import { handlePrincipalValueHover } from './principal-value.ts';
import { handleResourceValueHover } from './resource-value.ts';
import { handleStatementBlockHover } from './statement-block.ts';
import { handleStatementKeyHover } from './statement-key.ts';

export function hoverHandler(params: HoverParams, treeManager: TreeManager, connection: Connection): Hover | null {
  const handler = treeManager.getLanguageHandler(params.textDocument.uri);
  if (!handler) return null;

  const position = params.position;
  const cursorContext = handler.getCursorContext(params.textDocument.uri, position);
  if (!cursorContext) return null;

  const location = resolvePolicyLocation(cursorContext);
  connection.console.debug(
    `Hover debug: ${JSON.stringify({
      uri: params.textDocument.uri,
      cursorContext,
      location,
      position: params.position,
    })}`,
  );

  return handleLocationHover(connection, location);
}

function handleLocationHover(connection: Connection, location: PolicyLocation) {
  if (location.type === 'statement-key') {
    return handleStatementKeyHover(connection, location);
  } else if (location.type === 'statement-block') {
    return handleStatementBlockHover(location);
  } else if (location.type === 'effect-value') {
    return handleEffectValueHover(location);
  } else if (location.type === 'action-value') {
    return handleActionValueHover(location);
  } else if (location.type === 'resource-value') {
    return handleResourceValueHover(location);
  } else if (location.type === 'principal-value') {
    return handlePrincipalValueHover(location);
  } else if (location.type === 'principal-type' || location.type === 'principal-block-type') {
    return handlePrincipalTypeHover(location);
  } else if (location.type === 'principal-block') {
    return handlePrincipalBlockHover(location);
  } else if (location.type === 'principal-typed-value' || location.type === 'principal-block-identifier') {
    return handlePrincipalTypedValueHover(location);
  } else if (location.type === 'condition-block') {
    return handleConditionBlockHover(location);
  } else if (location.type === 'condition-operator') {
    return handleConditionOperatorHover(location);
  } else if (location.type === 'condition-key') {
    return handleConditionKeyHover(location);
  }
  return null;
}
