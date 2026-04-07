import type { CompletionItem, CompletionList, CompletionParams, Connection } from 'vscode-languageserver';
import { InsertTextFormat } from 'vscode-languageserver';
import type { TextDocuments } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { type PolicyLocation, resolvePolicyLocation } from '../../lib/iam-policy/location.ts';
import type { TreeBase } from '../../lib/treesitter/base.ts';
import type { TreeManager } from '../../lib/treesitter/manager.ts';
import { completeActionValue } from './action-value.ts';
import { completeConditionBlock } from './condition-block.ts';
import { completeConditionKey } from './condition-key.ts';
import { completeConditionOperator } from './condition-operator.ts';
import { completeEffectValue } from './effect-value.ts';
import { completePrincipalBlock } from './principal-block.ts';
import { completePrincipalBlockIdentifier } from './principal-block-identifier.ts';
import { completePrincipalBlockType } from './principal-block-type.ts';
import { completePrincipalType } from './principal-type.ts';
import { completePrincipalTypedValue } from './principal-typed-value.ts';
import { completePrincipalValue } from './principal-value.ts';
import { completeResourceValue } from './resource-value.ts';
import { completeStatementBlock } from './statement-block.ts';
import { completeStatementKey } from './statement-key.ts';

export type CompletionContext = {
  handler: TreeBase;
  uri: string;
  position: { line: number; character: number };
};

const emptyResult: CompletionList = { items: [], isIncomplete: false };

export function partialRange(position: { line: number; character: number }, partialLength: number) {
  return {
    start: { line: position.line, character: position.character - partialLength },
    end: { line: position.line, character: position.character },
  };
}

export async function handleCompletionRequest(
  params: CompletionParams,
  _documents: TextDocuments<TextDocument>,
  treeManager: TreeManager,
  connection: Connection,
): Promise<CompletionList> {
  const handler = treeManager.getLanguageHandler(params.textDocument.uri);
  if (!handler) return emptyResult;

  const position = params.position;
  const cursorContext = handler.getCursorContext(params.textDocument.uri, position);
  if (!cursorContext) return emptyResult;

  const location = resolvePolicyLocation(cursorContext);
  connection.console.debug(
    `Completion debug: ${JSON.stringify({
      uri: params.textDocument.uri,
      cursorContext,
      location,
      position: params.position,
    })}`,
  );
  const result = handleLocationCompletion(location, {
    handler,
    uri: params.textDocument.uri,
    position,
  });

  result.items = result.items.map(toSnippet);

  connection.console.debug(
    `Found ${result.items.length} completion items for ${params.textDocument.uri} at line ${position.line}, character ${position.character}`,
  );

  return result;
}

function handleLocationCompletion(location: PolicyLocation, context: CompletionContext) {
  if (location.type === 'statement-key') {
    return completeStatementKey(location, context);
  } else if (location.type === 'statement-block') {
    return completeStatementBlock(location, context);
  } else if (location.type === 'effect-value') {
    return completeEffectValue(location, context);
  } else if (location.type === 'action-value') {
    return completeActionValue(location, context);
  } else if (location.type === 'resource-value') {
    return completeResourceValue(location, context);
  } else if (location.type === 'principal-value') {
    return completePrincipalValue(location, context);
  } else if (location.type === 'principal-type') {
    return completePrincipalType(location, context);
  } else if (location.type === 'principal-block') {
    return completePrincipalBlock(location, context);
  } else if (location.type === 'principal-block-identifier') {
    return completePrincipalBlockIdentifier(location, context);
  } else if (location.type === 'principal-block-type') {
    return completePrincipalBlockType(location, context);
  } else if (location.type === 'principal-typed-value') {
    return completePrincipalTypedValue(location, context);
  } else if (location.type === 'condition-block') {
    return completeConditionBlock(location, context);
  } else if (location.type === 'condition-key') {
    return completeConditionKey(location, context);
  } else if (location.type === 'condition-operator') {
    return completeConditionOperator(location, context);
  }
  return emptyResult;
}

function toSnippet(item: CompletionItem): CompletionItem {
  const text = item.textEdit && 'range' in item.textEdit ? item.textEdit.newText : (item.insertText ?? item.label);
  const snippetPlaceholderPattern = /\$\{([^}]+)\}/g;
  if (!snippetPlaceholderPattern.test(text)) return item;

  let tabStop = 0;
  const seen = new Map<string, number>();
  const snippetText = text.replace(snippetPlaceholderPattern, (_match, name: string) => {
    if (!seen.has(name)) {
      seen.set(name, ++tabStop);
    }
    return `\${${seen.get(name)}:${name}}`;
  });

  if (item.textEdit && 'range' in item.textEdit) {
    item.textEdit.newText = snippetText;
  } else {
    item.insertText = snippetText;
  }
  item.insertTextFormat = InsertTextFormat.Snippet;
  return item;
}
