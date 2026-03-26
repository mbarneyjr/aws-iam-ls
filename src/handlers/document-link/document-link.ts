import type { DocumentLink, DocumentLinkParams, TextDocuments } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import type { TreeManager } from '../../lib/treesitter/manager.ts';

export function documentLinkHandler(
  params: DocumentLinkParams,
  documents: TextDocuments<TextDocument>,
  _treeManager: TreeManager,
): DocumentLink[] {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const links: DocumentLink[] = [];
  const actionSet = new Set(ServiceReference.getAllActions().map((a) => a.toLowerCase()));

  const pattern = /[a-z0-9-]+:[A-Za-z0-9*?]+/g;
  for (const match of text.matchAll(pattern)) {
    if (!actionSet.has(match[0].toLowerCase())) continue;

    const [service, actionName] = match[0].split(':');
    const action = ServiceReference.getAction(service, actionName);
    if (!action?.url) continue;

    const index = match.index ?? 0;
    const startPos = document.positionAt(index);
    const endPos = document.positionAt(index + match[0].length);
    links.push({
      range: { start: startPos, end: endPos },
      target: action.url,
      tooltip: 'API Operation Documentation',
    });
  }

  return links;
}
