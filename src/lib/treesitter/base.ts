import type { Position, Range } from 'vscode-languageserver';
import type { Language, Node, Tree } from 'web-tree-sitter';
import { Parser } from 'web-tree-sitter';

await Parser.init();

export type { Position, Range };

export type StatementValue = {
  text: string;
  range: Range;
};

export type StatementEntry = {
  key: string;
  keyRange: Range;
  values: StatementValue[];
  valueRange: Range;
  children?: StatementEntry[];
};

export type StatementNode = {
  range: Range;
  entries: StatementEntry[];
};

export type PolicyDocumentNode = {
  range: Range;
  policyFormat: PolicyFormat;
  statements: StatementNode[];
};

export function nodeRange(node: Node): Range {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  };
}

export type PolicyFormat = 'standard' | 'hcl-block';

export type CursorContext = {
  keys: string[];
  role: 'key' | 'value';
  partial: string;
  value: string;
  range?: Range;
  policyFormat: PolicyFormat;
};

export type StatementContext = {
  Sid?: string;
  Effect?: string;
  Action?: string[];
  NotAction?: string[];
  Resource?: string[];
  NotResource?: string[];
  Principal?: Record<string, string[]> | string;
  NotPrincipal?: Record<string, string[]> | string;
  Condition?: Record<string, Record<string, string[]>>;
};

export class TreeBase {
  #trees = new Map<string, Tree>();
  #parser: Parser;

  constructor(language: Language) {
    this.#parser = new Parser();
    this.#parser.setLanguage(language);
  }

  getTree(uri: string) {
    return this.#trees.get(uri);
  }

  openDocument(uri: string, content: string) {
    this.#parse(uri, content);
  }

  updateDocument(uri: string, content: string) {
    this.#parse(uri, content);
  }

  closeDocument(uri: string) {
    this.#trees.get(uri)?.delete();
    this.#trees.delete(uri);
  }

  #parse(uri: string, content: string) {
    const tree = this.#parser.parse(content);
    if (!tree) return;

    const existing = this.#trees.get(uri);
    existing?.delete();

    this.#trees.set(uri, tree);
  }

  getNodeAtPosition(uri: string, position: Position) {
    const tree = this.getTree(uri);
    if (!tree) return null;

    const node = tree.rootNode.descendantForPosition({
      row: position.line,
      column: position.character,
    });
    return node;
  }

  getCursorContext(_uri: string, _position: Position): CursorContext | null {
    throw new Error('getCursorContext must be implemented by a subclass');
  }

  getStatementContext(_uri: string, _position: Position): StatementContext | null {
    throw new Error('getStatementContext must be implemented by a subclass');
  }

  getSiblingKeys(_uri: string, _position: Position): string[] {
    throw new Error('getSiblingKeys must be implemented by a subclass');
  }

  getAllPolicyDocuments(_uri: string): PolicyDocumentNode[] {
    throw new Error('getAllPolicyDocuments must be implemented by a subclass');
  }
}
