import path from 'node:path';
import type { ExtensionContext } from 'vscode';
import { LanguageClient, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('src', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  client = new LanguageClient('aws-iam-language-server', 'AWS IAM Language Server', serverOptions, {
    documentSelector: [{ language: 'json' }, { language: 'yaml' }, { language: 'terraform' }, { language: 'opentofu' }],
  });

  client.start();
}

export function deactivate() {
  if (client) {
    return client.stop();
  }
}
