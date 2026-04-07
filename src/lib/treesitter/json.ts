import { resolve } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { Language } from 'web-tree-sitter';
import type {
  CursorContext,
  PolicyDocumentNode,
  Position,
  Range,
  StatementContext,
  StatementEntry,
  StatementValue,
} from './base.ts';
import { nodeRange, TreeBase } from './base.ts';

export class TreeJson extends TreeBase {
  static async init() {
    const grammarDir = resolve(import.meta.dirname, '../../grammars');
    const language = await Language.load(resolve(grammarDir, 'tree-sitter-json.wasm'));
    return new TreeJson(language);
  }

  getCursorContext(uri: string, position: Position): CursorContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    const nodeBefore =
      position.character > 0
        ? this.getNodeAtPosition(uri, { line: position.line, character: position.character - 1 })
        : null;

    // Cursor right after closing quote — no completions
    if (this.#isCursorAfterClosingQuote(nodeBefore)) return null;

    // Cursor inside an array but outside any string — no completions
    if (this.#isCursorOutsideStringInArray(node, nodeBefore)) return null;

    // JSON requires cursor to be inside a string (after/within quotes)
    if (!this.#isInsideString(node) && (!nodeBefore || !this.#isInsideString(nodeBefore))) return null;

    let statementObject = this.#findStatementObject(node);
    if (!statementObject && nodeBefore) {
      statementObject = this.#findStatementObject(nodeBefore);
    }

    if (!statementObject) return null;

    const context1 = this.#resolveCursorContext(node, statementObject, position);
    const context2 = nodeBefore ? this.#resolveCursorContext(nodeBefore, statementObject, position) : null;
    return this.#pickBestCursorContext(context1, context2);
  }

  getStatementContext(uri: string, position: Position): StatementContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    let statementObject = this.#findStatementObject(node);
    if (!statementObject && position.character > 0) {
      const nodeBefore = this.getNodeAtPosition(uri, { line: position.line, character: position.character - 1 });
      if (nodeBefore) statementObject = this.#findStatementObject(nodeBefore);
    }
    if (!statementObject) return null;

    return this.#extractStatementContext(statementObject);
  }

  getSiblingKeys(uri: string, position: Position): string[] {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return [];

    let statementObject = this.#findStatementObject(node);
    if (!statementObject && position.character > 0) {
      const nodeBefore = this.getNodeAtPosition(uri, { line: position.line, character: position.character - 1 });
      if (nodeBefore) statementObject = this.#findStatementObject(nodeBefore);
    }
    if (!statementObject) return [];

    return this.#collectExistingKeys(this.#findInnermostObject(node, statementObject));
  }

  getAllPolicyDocuments(uri: string): PolicyDocumentNode[] {
    const tree = this.getTree(uri);
    if (!tree) return [];

    const objects = this.#findAllStatementObjects(tree.rootNode);

    // Group by parent array (each Statement array = one policy document)
    const groups = new Map<number, { array: Node; objects: Node[] }>();
    for (const object of objects) {
      const array = object.parent;
      if (!array || array.type !== 'array') continue;
      const existing = groups.get(array.id);
      if (existing) {
        existing.objects.push(object);
      } else {
        groups.set(array.id, { array, objects: [object] });
      }
    }

    const results: PolicyDocumentNode[] = [];
    for (const group of groups.values()) {
      results.push({
        range: nodeRange(group.array),
        policyFormat: 'standard',
        statements: group.objects.map((object) => ({
          range: nodeRange(object),
          entries: this.#buildStatementEntries(object),
        })),
      });
    }
    return results;
  }

  #findAllStatementObjects(root: Node): Node[] {
    const results: Node[] = [];
    const visit = (node: Node) => {
      if (node.type === 'object' && this.#isInsideStatementArray(node)) {
        results.push(node);
        return; // skip descendants
      }
      for (const child of node.namedChildren) {
        visit(child);
      }
    };
    visit(root);
    return results;
  }

  #buildStatementEntries(object: Node): StatementEntry[] {
    const entries: StatementEntry[] = [];
    for (const child of object.namedChildren) {
      if (child.type !== 'pair') continue;
      const key = this.#getPairKeyText(child);
      if (!key) continue;

      const keyString = child.namedChildren[0];
      const keyRange: Range = keyString ? nodeRange(keyString) : nodeRange(child);

      const values = this.#readPairStatementValues(child);
      const valueRange = this.#getPairValueRange(child);

      const nestedKeys = new Set(['Condition', 'Principal', 'NotPrincipal']);
      let children: StatementEntry[] | undefined;
      if (nestedKeys.has(key)) {
        const valueNode = child.namedChildren[1];
        if (valueNode?.type === 'object') {
          children = this.#buildNestedEntries(valueNode);
        }
      }

      entries.push({ key, keyRange, values, valueRange, ...(children ? { children } : {}) });
    }
    return entries;
  }

  #buildNestedEntries(object: Node): StatementEntry[] {
    const entries: StatementEntry[] = [];
    for (const child of object.namedChildren) {
      if (child.type !== 'pair') continue;
      const key = this.#getPairKeyText(child);
      if (!key) continue;

      const keyString = child.namedChildren[0];
      const keyRange: Range = keyString ? nodeRange(keyString) : nodeRange(child);

      const values = this.#readPairStatementValues(child);
      const valueRange = this.#getPairValueRange(child);

      const valueNode = child.namedChildren[1];
      let children: StatementEntry[] | undefined;
      if (valueNode?.type === 'object') {
        children = this.#buildNestedEntries(valueNode);
      }

      entries.push({ key, keyRange, values, valueRange, ...(children ? { children } : {}) });
    }
    return entries;
  }

  #readPairStatementValues(pair: Node): StatementValue[] {
    const valueNode = pair.namedChildren[1];
    if (!valueNode) return [];

    if (valueNode.type === 'string') {
      const content = valueNode.namedChildren.find((child) => child.type === 'string_content');
      if (!content?.text) return [];
      return [{ text: content.text, range: nodeRange(content) }];
    }

    if (valueNode.type === 'array') {
      const values: StatementValue[] = [];
      for (const element of valueNode.namedChildren) {
        if (element.type !== 'string') continue;
        const content = element.namedChildren.find((child) => child.type === 'string_content');
        if (content?.text) {
          values.push({ text: content.text, range: nodeRange(content) });
        }
      }
      return values;
    }

    return [];
  }

  #getPairValueRange(pair: Node): Range {
    const valueNode = pair.namedChildren[1];
    if (!valueNode) {
      return {
        start: { line: pair.endPosition.row, character: pair.endPosition.column },
        end: { line: pair.endPosition.row, character: pair.endPosition.column },
      };
    }
    return nodeRange(valueNode);
  }

  #resolveCursorContext(node: Node, statementObject: Node, position: Position): CursorContext | null {
    const cursorPath = this.#buildCursorPath(node, statementObject, position);
    return { ...cursorPath, policyFormat: 'standard' };
  }

  #pickBestCursorContext(a: CursorContext | null, b: CursorContext | null): CursorContext | null {
    if (!a) return b;
    if (!b) return a;
    if (a.partial === '' && b.partial !== '') return b;
    if (a.partial === '' && b.partial === '' && b.keys.length > a.keys.length) return b;
    return a;
  }

  /**
   * Walk up from cursor to statement object, building the chain of pair
   * keys crossed along the way.
   */
  #buildCursorPath(cursorNode: Node, statementObject: Node, position: Position) {
    const keys: string[] = [];
    let role: 'key' | 'value' | null = null;
    let previous: Node | null = null;
    let current: Node | null = cursorNode;

    while (current && current.id !== statementObject.id) {
      if (current.type === 'object' && role === null) {
        role = 'key';
      }

      if (current.type === 'pair') {
        const pairKey = this.#getPairKeyText(current);

        if (role === null) {
          if (previous && current.namedChildren[0] && previous.id === current.namedChildren[0].id) {
            role = 'key';
          } else {
            role = 'value';
            if (pairKey) keys.unshift(pairKey);
          }
        } else {
          if (pairKey) keys.unshift(pairKey);
        }
      }

      previous = current;
      current = current.parent;
    }

    // When cursor falls on the statementObject (e.g., after an incomplete pair like
    // "Effect": ), check if a child pair is on the same line — if so, the cursor
    // is in that pair's value area.
    if (role === null && cursorNode.id === statementObject.id) {
      const pairOnLine = statementObject.namedChildren.find(
        (child) => child.type === 'pair' && child.startPosition.row === position.line,
      );
      if (pairOnLine) {
        const pairKey = this.#getPairKeyText(pairOnLine);
        if (pairKey) {
          keys.unshift(pairKey);
          role = 'value';
        }
      }
    }

    if (role === null) role = 'key';
    const { partial, value, range } = this.#extractPartialAndValue(cursorNode, position);

    return { keys, role, partial, value, range };
  }

  /**
   * Walk up from a node to find an object that sits inside a Statement array.
   */
  #findStatementObject(node: Node): Node | null {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'object' && this.#isInsideStatementArray(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Check that an object is a direct child of an array whose parent pair
   * has the key "Statement".
   */
  #isInsideStatementArray(object: Node): boolean {
    if (object.parent?.type !== 'array') return false;
    const pair = object.parent.parent;
    if (pair?.type !== 'pair') return false;
    return this.#getPairKeyText(pair) === 'Statement';
  }

  /**
   * Get the text content of a pair's key (first named child string).
   */
  #getPairKeyText(pair: Node): string | null {
    const keyString = pair.namedChildren[0];
    if (keyString?.type !== 'string') return null;
    const content = keyString.namedChildren.find((child) => child.type === 'string_content');
    return content?.text ?? null;
  }

  /**
   * Find the first object between node and stmtObject (inclusive of node).
   */
  #findInnermostObject(node: Node, statementObject: Node): Node {
    let current: Node | null = node;
    while (current && current.id !== statementObject.id) {
      if (current.type === 'object') return current;
      current = current.parent;
    }
    return statementObject;
  }

  /**
   * Collect all key names from pair children of an object.
   */
  #collectExistingKeys(object: Node): string[] {
    return object.namedChildren
      .filter((child) => child.type === 'pair')
      .map((pair) => this.#getPairKeyText(pair))
      .filter((key): key is string => key !== null);
  }

  /**
   * Check if a node is inside a string (i.e. cursor is after/within quotes).
   */
  #isInsideString(node: Node): boolean {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'string' || current.type === 'string_content') return true;
      if (current.type === '"') {
        // Opening quote means cursor is inside the string; closing quote means outside.
        const parent = current.parent;
        if (parent?.type === 'string' && current.id === parent.lastChild?.id) return false;
        return true;
      }
      if (current.type === 'pair' || current.type === 'object' || current.type === 'array') return false;
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if the cursor is right after a closing quote. The node at the cursor
   * position may still be inside the string, but the user has finished the string.
   */
  #isCursorAfterClosingQuote(nodeBefore: Node | null): boolean {
    if (!nodeBefore || nodeBefore.type !== '"') return false;
    const parent = nodeBefore.parent;
    if (parent?.type !== 'string') return false;
    return nodeBefore.id === parent.lastChild?.id;
  }

  /**
   * Check if the cursor is inside an array value but not inside any string.
   * This is the case for the known `json_no-quote` test failures where the cursor
   * is between array elements or after `[` but before any `"`.
   */
  #isCursorOutsideStringInArray(node: Node, nodeBefore: Node | null): boolean {
    const target = nodeBefore ?? node;
    let current: Node | null = target;
    while (current) {
      if (current.type === 'string' || current.type === 'string_content') return false;
      if (current.type === 'array')
        return !this.#isInsideString(node) && (!nodeBefore || !this.#isInsideString(nodeBefore));
      if (current.type === 'object') return false;
      current = current.parent;
    }
    return false;
  }

  /**
   * Extract the partial text (up to cursor) and full value from the nearest
   * string_content node.
   */
  #extractPartialAndValue(node: Node, position: Position): { partial: string; value: string; range?: Range } {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'string_content') {
        const value = current.text;
        const range = nodeRange(current);
        if (position.line === current.startPosition.row) {
          return { partial: value.slice(0, position.character - current.startPosition.column), value, range };
        }
        return { partial: value, value, range };
      }
      if (current.type === 'object' || current.type === 'pair') break;
      current = current.parent;
    }
    return { partial: '', value: '' };
  }

  /**
   * Read string values from a JSON pair's value (string or array of strings).
   */
  #readPairStringValues(pair: Node): string[] {
    const valueNode = pair.namedChildren[1];
    if (!valueNode) return [];

    if (valueNode.type === 'string') {
      const content = valueNode.namedChildren.find((child) => child.type === 'string_content');
      return content?.text ? [content.text] : [];
    }

    if (valueNode.type === 'array') {
      const values: string[] = [];
      for (const element of valueNode.namedChildren) {
        if (element.type !== 'string') continue;
        const content = element.namedChildren.find((child) => child.type === 'string_content');
        if (content?.text) values.push(content.text);
      }
      return values;
    }

    return [];
  }

  /**
   * Extract the statement structure from a JSON statement object.
   */
  #extractStatementContext(statementObject: Node): StatementContext {
    const context: StatementContext = {};
    for (const child of statementObject.namedChildren) {
      if (child.type !== 'pair') continue;
      const key = this.#getPairKeyText(child);
      if (key === 'Sid') {
        const values = this.#readPairStringValues(child);
        if (values.length > 0) context.Sid = values[0];
      } else if (key === 'Effect') {
        const values = this.#readPairStringValues(child);
        if (values.length > 0) context.Effect = values[0];
      } else if (key === 'Action') {
        context.Action = this.#readPairStringValues(child);
      } else if (key === 'NotAction') {
        context.NotAction = this.#readPairStringValues(child);
      } else if (key === 'Resource') {
        context.Resource = this.#readPairStringValues(child);
      } else if (key === 'NotResource') {
        context.NotResource = this.#readPairStringValues(child);
      } else if (key === 'Principal' || key === 'NotPrincipal') {
        const value = this.#readPrincipalValue(child);
        if (value) {
          if (key === 'Principal') context.Principal = value;
          else context.NotPrincipal = value;
        }
      } else if (key === 'Condition') {
        context.Condition = this.#readConditionValue(child);
      }
    }
    return context;
  }

  /**
   * Read a Principal/NotPrincipal value: either "*" or a mapping of type → values.
   */
  #readPrincipalValue(pair: Node): Record<string, string[]> | string | null {
    const values = this.#readPairStringValues(pair);
    if (values.length === 1 && values[0] === '*') return '*';

    const valueNode = pair.namedChildren[1];
    if (!valueNode || valueNode.type !== 'object') return null;

    const result: Record<string, string[]> = {};
    for (const child of valueNode.namedChildren) {
      if (child.type !== 'pair') continue;
      const typeKey = this.#getPairKeyText(child);
      if (typeKey) result[typeKey] = this.#readPairStringValues(child);
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Read a Condition block: mapping of operator → (mapping of key → values).
   */
  #readConditionValue(pair: Node): Record<string, Record<string, string[]>> {
    const result: Record<string, Record<string, string[]>> = {};
    const valueNode = pair.namedChildren[1];
    if (!valueNode || valueNode.type !== 'object') return result;

    for (const operatorPair of valueNode.namedChildren) {
      if (operatorPair.type !== 'pair') continue;
      const operator = this.#getPairKeyText(operatorPair);
      if (!operator) continue;

      const innerObject = operatorPair.namedChildren[1];
      if (!innerObject || innerObject.type !== 'object') {
        result[operator] = {};
        continue;
      }

      const keys: Record<string, string[]> = {};
      for (const keyPair of innerObject.namedChildren) {
        if (keyPair.type !== 'pair') continue;
        const conditionKey = this.#getPairKeyText(keyPair);
        if (conditionKey) keys[conditionKey] = this.#readPairStringValues(keyPair);
      }
      result[operator] = keys;
    }
    return result;
  }
}
