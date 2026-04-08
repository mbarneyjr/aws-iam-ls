#!/usr/bin/env node

import { createConnection, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { handleCompletionRequest } from './handlers/completion/index.ts';
import { diagnosticsHandler } from './handlers/diagnostics/diagnostics.ts';
import { documentLinkHandler } from './handlers/document-link/document-link.ts';
import { hoverHandler } from './handlers/hover/index.ts';
import { TreeManager } from './lib/treesitter/manager.ts';

const connection = createConnection();
const documents = new TextDocuments(TextDocument);
const treeManager = new TreeManager(connection);

connection.onInitialize(async () => {
  connection.console.log(`Started the AWS IAM Policy Language Server`);
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        triggerCharacters: ['"', ':', '*'],
      },
      hoverProvider: true,
      documentLinkProvider: {},
    },
  };
});

documents.onDidOpen(async ({ document }) => {
  await treeManager.openDocument(document.uri, document.getText(), document.languageId);
  await diagnosticsHandler(document, treeManager, connection);
});
documents.onDidChangeContent(async ({ document }) => {
  await treeManager.updateDocument(document.uri, document.getText());
  await diagnosticsHandler(document, treeManager, connection);
});
documents.onDidClose(async ({ document }) => {
  await treeManager.closeDocument(document.uri);
});

connection.onCompletion((params) => handleCompletionRequest(params, documents, treeManager, connection));
connection.onDocumentLinks((params) => documentLinkHandler(params, documents, treeManager, connection));
connection.onHover((params) => hoverHandler(params, treeManager, connection));

documents.listen(connection);
connection.listen();
