import type { Diagnostic } from 'vscode-languageclient';
import type { StatementEntry } from '../../lib/treesitter/base.ts';
import { ElementValidator } from './base.ts';
import { createDiagnostic } from './utils.ts';

const strictSidPattern = /^[A-Za-z0-9]*$/;
const resourcePolicySidPattern = /^[A-Za-z0-9 ]*$/;

export class SidValidator extends ElementValidator {
  #sids: Record<string, StatementEntry> = {};
  constructor() {
    super();
    this.#sids = {};
  }

  validate(entry: StatementEntry, isResourcePolicy = false): Array<Diagnostic> {
    const diagnostics: Array<Diagnostic> = super.validate(entry);
    const sidValue = entry.values[0]?.text;
    if (!sidValue) return diagnostics;
    if (sidValue in this.#sids) {
      diagnostics.push(createDiagnostic(`Duplicate statement id value "${sidValue}"`, entry.valueRange));
      diagnostics.push(createDiagnostic(`Duplicate statement id value "${sidValue}"`, this.#sids[sidValue].valueRange));
    }
    this.#sids[sidValue] = entry;

    const pattern = isResourcePolicy ? resourcePolicySidPattern : strictSidPattern;
    if (!pattern.test(sidValue)) {
      const message = isResourcePolicy
        ? 'Sid must contain only ASCII letters (A-Z, a-z), digits (0-9), and spaces'
        : 'Sid must contain only ASCII letters (A-Z, a-z) and digits (0-9)';
      diagnostics.push(createDiagnostic(message, entry.values[0].range));
    }
    return diagnostics;
  }
}
