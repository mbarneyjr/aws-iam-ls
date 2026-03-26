#!/usr/bin/env node

import { createConnection, ProposedFeatures, TextDocumentSyncKind, TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { handleCompletionRequest } from './handlers/completion/index.ts';
import { documentLinkHandler } from './handlers/document-link/document-link.ts';
import { TreeManager } from './lib/treesitter/manager.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const treeManager = new TreeManager();

connection.onInitialize(async () => {
  connection.console.log(`Starting the AWS IAM Policy Language Server`);
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        triggerCharacters: ['"', ':', '*'],
      },
      hoverProvider: false,
      documentLinkProvider: {},
    },
  };
});

documents.onDidOpen(({ document }) => treeManager.openDocument(document.uri, document.getText(), document.languageId));
documents.onDidChangeContent(({ document }) => treeManager.updateDocument(document.uri, document.getText()));
documents.onDidClose(({ document }) => treeManager.closeDocument(document.uri));

connection.onCompletion((params) => handleCompletionRequest(params, documents, treeManager));
connection.onDocumentLinks((params) => documentLinkHandler(params, documents, treeManager));

documents.listen(connection);
connection.listen();
