import type { Diagnostic } from 'vscode-languageclient';
import { isRegionValidForPartition, isValidPartition, partitions } from '../../lib/iam-policy/partitions.ts';
import type { Range, StatementEntry, StatementValue } from '../../lib/treesitter/base.ts';
import { ElementValidator } from './base.ts';
import { createDiagnostic } from './utils.ts';

const validPartitions = Object.keys(partitions);
const accountIdPattern = /^\d{12}$/;

function segmentRange(value: StatementValue, segmentIndex: number): Range {
  const segments = value.text.split(':');
  let offset = 0;
  for (let i = 0; i < segmentIndex; i++) {
    offset += segments[i].length + 1;
  }
  const startCharacter = value.range.start.character + offset;
  const endCharacter = startCharacter + segments[segmentIndex].length;
  return {
    start: { line: value.range.start.line, character: startCharacter },
    end: { line: value.range.start.line, character: endCharacter },
  };
}

function validateArn(value: StatementValue): Array<Diagnostic> {
  const text = value.text;
  const diagnostics: Array<Diagnostic> = [];

  if (!text.startsWith('arn:')) return [];

  const segments = text.split(':');
  if (segments.length > 1) {
    const partition = segments[1];
    if (partition === '') {
      diagnostics.push(createDiagnostic('partition is required', segmentRange(value, 1)));
    } else if (partition !== '*' && !Object.keys(partitions).includes(partition)) {
      diagnostics.push(
        createDiagnostic(`partition must be one of: ${[...validPartitions].join(',')}`, segmentRange(value, 1)),
      );
    }
  }

  if (segments.length > 3) {
    const partition = segments[1];
    const region = segments[3];
    if (isValidPartition(partition)) {
      if (region !== '*' && region !== '' && !isRegionValidForPartition(partition, region)) {
        diagnostics.push(createDiagnostic('invalid region for this partition', segmentRange(value, 3)));
      }
    }
  }

  if (segments.length > 4) {
    const account = segments[4];
    if (account !== '*' && account !== '' && !accountIdPattern.test(account)) {
      diagnostics.push(createDiagnostic('expected account id to be 12 digits', segmentRange(value, 4)));
    }
  }

  return diagnostics;
}

export class ResourceValidator extends ElementValidator {
  validate(entry: StatementEntry): Array<Diagnostic> {
    let diagnostics: Array<Diagnostic> = super.validate(entry);

    for (const value of entry.values) {
      diagnostics = diagnostics.concat(validateArn(value));
    }

    return diagnostics;
  }
}
