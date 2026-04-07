import type { Connection, DocumentLink, DocumentLinkParams, TextDocuments } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import type { TreeManager } from '../../lib/treesitter/manager.ts';

export function documentLinkHandler(
  params: DocumentLinkParams,
  documents: TextDocuments<TextDocument>,
  treeManager: TreeManager,
  connection: Connection,
): DocumentLink[] {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const handler = treeManager.getLanguageHandler(params.textDocument.uri);
  if (!handler) return [];

  const policyDocuments = handler.getAllPolicyDocuments(params.textDocument.uri);
  const links: DocumentLink[] = [];

  for (const policyDoc of policyDocuments) {
    const actionKeys =
      policyDoc.policyFormat === 'hcl-block' ? new Set(['actions', 'not_actions']) : new Set(['Action', 'NotAction']);

    for (const statement of policyDoc.statements) {
      for (const entry of statement.entries) {
        if (!actionKeys.has(entry.key)) continue;

        for (const value of entry.values) {
          const colonIndex = value.text.indexOf(':');
          if (colonIndex === -1) continue;

          const action = ServiceReference.getAction(value.text);
          if (!action) continue;

          const range = value.range;

          if (action.iamUrl) {
            links.push({
              range,
              target: action.iamUrl,
              tooltip: 'IAM Actions, Conditions, and Context Keys',
            });
          }
          if (action.operationUrl) {
            links.push({
              range,
              target: action.operationUrl,
              tooltip: 'API Operation Documentation',
            });
          }
        }
      }
    }
  }

  connection.console.debug(`Found ${links.length} document links in ${params.textDocument.uri}`);

  return links;
}
