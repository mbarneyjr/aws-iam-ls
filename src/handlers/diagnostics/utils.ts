import type { Diagnostic } from 'vscode-languageclient';
import type { Range } from '../../lib/treesitter/base.ts';

export function createDiagnostic(message: string, range: Range): Diagnostic {
  return {
    source: 'aws-iam-language-server',
    message,
    range,
  };
}
