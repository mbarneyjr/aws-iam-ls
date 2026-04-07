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

export class TreeHcl extends TreeBase {
  static async init() {
    const grammarDir = resolve(import.meta.dirname, '../../grammars');
    const language = await Language.load(resolve(grammarDir, 'tree-sitter-hcl.wasm'));
    return new TreeHcl(language);
  }

  getCursorContext(uri: string, position: Position): CursorContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    const nodeBefore =
      position.character > 0
        ? this.getNodeAtPosition(uri, { line: position.line, character: position.character - 1 })
        : null;

    // Try jsonencode mode first (more specific structure)
    const jsonencodeContext = this.#tryJsonencodeMode(node, nodeBefore, position);
    if (jsonencodeContext) return jsonencodeContext;

    // Try block mode
    const blockContext = this.#tryBlockMode(node, nodeBefore, position);
    if (blockContext) return blockContext;

    // Try error recovery (unterminated strings break the tree)
    return this.#tryRecoverFromError(node, nodeBefore, position);
  }

  getStatementContext(uri: string, position: Position): StatementContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    // Try jsonencode mode
    const statementObject = this.#findJsonencodeStatementObject(node);
    if (statementObject) return this.#extractJsonencodeStatementContext(statementObject);

    // Try block mode
    const statementBlock = this.#findStatementBlock(node);
    if (statementBlock) {
      const statementBody = statementBlock.namedChildren.find((child) => child.type === 'body') ?? null;
      if (statementBody) return this.#extractBlockStatementContext(statementBody);
    }

    return null;
  }

  getSiblingKeys(uri: string, position: Position): string[] {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return [];

    // Try jsonencode mode
    const statementObject = this.#findJsonencodeStatementObject(node);
    if (statementObject) return this.#collectObjectExistingKeys(this.#findInnermostObject(node, statementObject));

    // Try block mode
    const statementBlock = this.#findStatementBlock(node);
    if (statementBlock) {
      const statementBody = statementBlock.namedChildren.find((child) => child.type === 'body') ?? null;
      if (!statementBody) return [];
      let keysBody = this.#findInnermostBody(node, statementBody);
      // When cursor lands on a sub-block node, use that block's body
      if (node.type === 'block') {
        const subBody = node.namedChildren.find((child) => child.type === 'body');
        if (subBody) keysBody = subBody;
      }
      return this.#collectBodyExistingKeys(keysBody);
    }

    return [];
  }

  getAllPolicyDocuments(uri: string): PolicyDocumentNode[] {
    const tree = this.getTree(uri);
    if (!tree) return [];

    const root = tree.rootNode;
    const results: PolicyDocumentNode[] = [];

    // Block mode: statement { ... } — group by parent data block's body
    const blocks = this.#findAllStatementBlocks(root);
    const blockGroups = new Map<number, { parentBody: Node; blocks: Node[] }>();
    for (const block of blocks) {
      const parentBody = block.parent;
      if (!parentBody || parentBody.type !== 'body') continue;
      const existing = blockGroups.get(parentBody.id);
      if (existing) {
        existing.blocks.push(block);
      } else {
        blockGroups.set(parentBody.id, { parentBody, blocks: [block] });
      }
    }
    for (const group of blockGroups.values()) {
      results.push({
        range: nodeRange(group.parentBody),
        policyFormat: 'hcl-block',
        statements: group.blocks.map((block) => {
          const body = block.namedChildren.find((child) => child.type === 'body');
          return {
            range: nodeRange(block),
            entries: body ? this.#buildBlockStatementEntries(body) : [],
          };
        }),
      });
    }

    // Jsonencode mode: jsonencode({ Statement = [...] }) — group by parent tuple
    const objects = this.#findAllJsonencodeStatementObjects(root);
    const tupleGroups = new Map<number, { tuple: Node; objects: Node[] }>();
    for (const object of objects) {
      const tuple = this.#findParentTuple(object);
      if (!tuple) continue;
      const existing = tupleGroups.get(tuple.id);
      if (existing) {
        existing.objects.push(object);
      } else {
        tupleGroups.set(tuple.id, { tuple, objects: [object] });
      }
    }
    for (const group of tupleGroups.values()) {
      results.push({
        range: nodeRange(group.tuple),
        policyFormat: 'standard',
        statements: group.objects.map((object) => ({
          range: nodeRange(object),
          entries: this.#buildJsonencodeStatementEntries(object),
        })),
      });
    }

    return results;
  }

  #findParentTuple(object: Node): Node | null {
    let current: Node | null = object.parent;
    while (current && (current.type === 'collection_value' || current.type === 'expression')) {
      current = current.parent;
    }
    return current?.type === 'tuple' ? current : null;
  }

  #findAllStatementBlocks(root: Node): Node[] {
    const results: Node[] = [];
    const visit = (node: Node) => {
      if (node.type === 'block' && this.#getBlockIdentifier(node) === 'statement') {
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

  #findAllJsonencodeStatementObjects(root: Node): Node[] {
    const results: Node[] = [];
    const visit = (node: Node) => {
      if (node.type === 'object' && this.#isInsideStatementTuple(node)) {
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

  #buildBlockStatementEntries(body: Node): StatementEntry[] {
    const entries: StatementEntry[] = [];
    for (const child of body.namedChildren) {
      if (child.type === 'attribute') {
        const id = child.namedChildren.find((c) => c.type === 'identifier');
        if (!id) continue;

        const keyRange: Range = nodeRange(id);
        const expression = child.namedChildren.find((c) => c.type === 'expression');
        const values = expression ? this.#readExpressionStatementValues(expression) : [];
        const valueRange: Range = expression
          ? nodeRange(expression)
          : {
              start: { line: child.endPosition.row, character: child.endPosition.column },
              end: { line: child.endPosition.row, character: child.endPosition.column },
            };

        entries.push({ key: id.text, keyRange, values, valueRange });
      } else if (child.type === 'block') {
        const blockId = this.#getBlockIdentifier(child);
        if (!blockId) continue;

        const keyIdNode = child.namedChildren.find((c) => c.type === 'identifier');
        const keyRange: Range = keyIdNode ? nodeRange(keyIdNode) : nodeRange(child);
        const blockBody = child.namedChildren.find((c) => c.type === 'body');
        const children = blockBody ? this.#buildBlockStatementEntries(blockBody) : [];
        const valueRange: Range = blockBody ? nodeRange(blockBody) : nodeRange(child);

        entries.push({ key: blockId, keyRange, values: [], valueRange, children });
      }
    }
    return entries;
  }

  #readExpressionStatementValues(expression: Node): StatementValue[] {
    // Single string literal
    const literal = expression.namedChildren.find((child) => child.type === 'literal_value');
    if (literal) {
      const string = literal.namedChildren.find((child) => child.type === 'string_lit');
      const template = string?.namedChildren.find((child) => child.type === 'template_literal');
      if (template?.text) return [{ text: template.text, range: nodeRange(template) }];
      return [];
    }

    // Tuple of strings
    let tuple = expression.namedChildren.find((child) => child.type === 'tuple');
    if (!tuple) {
      const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
      tuple = collectionValue?.namedChildren.find((child) => child.type === 'tuple') ?? undefined;
    }
    if (tuple) {
      const values: StatementValue[] = [];
      for (const element of tuple.namedChildren) {
        const elementExpression = element.type === 'expression' ? element : null;
        const elementLiteral = elementExpression?.namedChildren.find((child) => child.type === 'literal_value');
        const elementString = elementLiteral?.namedChildren.find((child) => child.type === 'string_lit');
        const elementTemplate = elementString?.namedChildren.find((child) => child.type === 'template_literal');
        if (elementTemplate?.text) values.push({ text: elementTemplate.text, range: nodeRange(elementTemplate) });
      }
      return values;
    }

    return [];
  }

  #buildJsonencodeStatementEntries(object: Node): StatementEntry[] {
    const entries: StatementEntry[] = [];
    for (const child of object.namedChildren) {
      if (child.type !== 'object_elem') continue;
      const key = this.#getObjectElemKey(child);
      if (!key) continue;

      const keyExpression = child.namedChildren.find((c) => c.type === 'expression');
      const keyId = keyExpression?.namedChildren
        .find((c) => c.type === 'variable_expr')
        ?.namedChildren.find((c) => c.type === 'identifier');
      const keyRange: Range = keyId ? nodeRange(keyId) : nodeRange(child);

      const expressions = child.namedChildren.filter((c) => c.type === 'expression');
      const valueExpression = expressions.length >= 2 ? expressions[1] : null;
      const values = valueExpression ? this.#readJsonencodeExpressionStatementValues(valueExpression) : [];
      const valueRange: Range = valueExpression
        ? nodeRange(valueExpression)
        : {
            start: { line: child.endPosition.row, character: child.endPosition.column },
            end: { line: child.endPosition.row, character: child.endPosition.column },
          };

      const nestedKeys = new Set(['Condition', 'Principal', 'NotPrincipal']);
      let children: StatementEntry[] | undefined;
      if (nestedKeys.has(key) && valueExpression) {
        let nestedObject = valueExpression.namedChildren.find((c) => c.type === 'object');
        if (!nestedObject) {
          const collectionValue = valueExpression.namedChildren.find((c) => c.type === 'collection_value');
          nestedObject = collectionValue?.namedChildren.find((c) => c.type === 'object') ?? undefined;
        }
        if (nestedObject) {
          children = this.#buildJsonencodeNestedEntries(nestedObject);
        }
      }

      entries.push({ key, keyRange, values, valueRange, ...(children ? { children } : {}) });
    }
    return entries;
  }

  #readJsonencodeExpressionStatementValues(expression: Node): StatementValue[] {
    // Single string literal
    const literal = expression.namedChildren.find((child) => child.type === 'literal_value');
    if (literal) {
      const string = literal.namedChildren.find((child) => child.type === 'string_lit');
      const template = string?.namedChildren.find((child) => child.type === 'template_literal');
      if (template?.text) return [{ text: template.text, range: nodeRange(template) }];
      return [];
    }

    // Tuple
    let tuple = expression.namedChildren.find((child) => child.type === 'tuple');
    if (!tuple) {
      const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
      tuple = collectionValue?.namedChildren.find((child) => child.type === 'tuple') ?? undefined;
    }
    if (tuple) {
      const values: StatementValue[] = [];
      for (const element of tuple.namedChildren) {
        const elementExpression = element.type === 'expression' ? element : null;
        const elementLiteral = elementExpression?.namedChildren.find((child) => child.type === 'literal_value');
        const elementString = elementLiteral?.namedChildren.find((child) => child.type === 'string_lit');
        const elementTemplate = elementString?.namedChildren.find((child) => child.type === 'template_literal');
        if (elementTemplate?.text) values.push({ text: elementTemplate.text, range: nodeRange(elementTemplate) });
      }
      return values;
    }

    return [];
  }

  #buildJsonencodeNestedEntries(object: Node): StatementEntry[] {
    const entries: StatementEntry[] = [];
    for (const child of object.namedChildren) {
      if (child.type !== 'object_elem') continue;
      const key = this.#getObjectElemKey(child);
      if (!key) continue;

      const keyExpression = child.namedChildren.find((c) => c.type === 'expression');
      const keyId = keyExpression?.namedChildren
        .find((c) => c.type === 'variable_expr')
        ?.namedChildren.find((c) => c.type === 'identifier');
      const keyRange: Range = keyId ? nodeRange(keyId) : nodeRange(child);

      const expressions = child.namedChildren.filter((c) => c.type === 'expression');
      const valueExpression = expressions.length >= 2 ? expressions[1] : null;
      const values = valueExpression ? this.#readJsonencodeExpressionStatementValues(valueExpression) : [];
      const valueRange: Range = valueExpression
        ? nodeRange(valueExpression)
        : {
            start: { line: child.endPosition.row, character: child.endPosition.column },
            end: { line: child.endPosition.row, character: child.endPosition.column },
          };

      let nestedObject: Node | undefined;
      if (valueExpression) {
        nestedObject = valueExpression.namedChildren.find((c) => c.type === 'object');
        if (!nestedObject) {
          const collectionValue = valueExpression.namedChildren.find((c) => c.type === 'collection_value');
          nestedObject = collectionValue?.namedChildren.find((c) => c.type === 'object') ?? undefined;
        }
      }
      const children = nestedObject ? this.#buildJsonencodeNestedEntries(nestedObject) : undefined;

      entries.push({ key, keyRange, values, valueRange, ...(children ? { children } : {}) });
    }
    return entries;
  }

  // ---------------------------------------------------------------------------
  // Jsonencode mode — object/object_elem/tuple, PascalCase keys, same as JSON
  // ---------------------------------------------------------------------------

  #tryJsonencodeMode(node: Node, nodeBefore: Node | null, position: Position): CursorContext | null {
    let statementObject = this.#findJsonencodeStatementObject(node);
    if (!statementObject && nodeBefore) statementObject = this.#findJsonencodeStatementObject(nodeBefore);
    if (!statementObject) return null;

    const context1 = this.#resolveJsonencodeCursorContext(node, statementObject, position);
    const context2 = nodeBefore ? this.#resolveJsonencodeCursorContext(nodeBefore, statementObject, position) : null;
    return this.#pickBestCursorContext(context1, context2);
  }

  #resolveJsonencodeCursorContext(node: Node, statementObject: Node, position: Position): CursorContext | null {
    const cursorPath = this.#buildJsonencodeCursorPath(node, statementObject, position);
    if (cursorPath.role === 'value' && !this.#isInsideQuote(node)) return null;
    return { ...cursorPath, policyFormat: 'standard' };
  }

  #findJsonencodeStatementObject(node: Node): Node | null {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'object' && this.#isInsideStatementTuple(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Check that an object is an element of a tuple whose enclosing object_elem
   * has the key "Statement".
   */
  #isInsideStatementTuple(object: Node): boolean {
    // Walk up through expression/collection_value wrappers to reach the tuple
    let current: Node | null = object.parent;
    while (current && (current.type === 'collection_value' || current.type === 'expression')) {
      current = current.parent;
    }
    if (current?.type !== 'tuple') return false;

    // Walk up from tuple through wrappers to reach the object_elem
    current = current.parent;
    while (current && (current.type === 'collection_value' || current.type === 'expression')) {
      current = current.parent;
    }
    if (current?.type !== 'object_elem') return false;

    return this.#getObjectElemKey(current) === 'Statement';
  }

  #buildJsonencodeCursorPath(cursorNode: Node, statementObject: Node, position: Position) {
    const keys: string[] = [];
    let role: 'key' | 'value' | null = null;
    let previous: Node | null = null;
    let current: Node | null = cursorNode;

    while (current && current.id !== statementObject.id) {
      if (current.type === 'object' && role === null) {
        role = 'key';
      }

      if (current.type === 'object_elem') {
        const elementKey = this.#getObjectElemKey(current);
        const keyExpression = current.namedChildren.find((child) => child.type === 'expression');

        if (role === null) {
          if (previous && keyExpression && previous.id === keyExpression.id) {
            role = 'key';
          } else {
            role = 'value';
            if (elementKey) keys.unshift(elementKey);
          }
        } else {
          if (elementKey) keys.unshift(elementKey);
        }
      }

      previous = current;
      current = current.parent;
    }

    // When cursor falls on the statementObject (e.g., after an incomplete elem like
    // "Effect = "), check if a child elem or ERROR node is on the same line.
    if (role === null && cursorNode.id === statementObject.id) {
      for (const child of statementObject.namedChildren) {
        if (child.startPosition.row !== position.line) continue;
        if (child.type === 'object_elem' || child.type === 'ERROR') {
          const elementKey = this.#getObjectElemKey(child);
          if (elementKey) {
            keys.unshift(elementKey);
            role = 'value';
            break;
          }
        }
      }
    }

    if (role === null) role = 'key';
    const { partial, value, range } = this.#extractJsonencodePartialAndValue(cursorNode, position);
    return { keys, role, partial, value, range };
  }

  #getObjectElemKey(element: Node): string | null {
    const keyExpression = element.namedChildren.find((child) => child.type === 'expression');
    if (!keyExpression) return null;
    const variableExpression = keyExpression.namedChildren.find((child) => child.type === 'variable_expr');
    if (!variableExpression) return null;
    const id = variableExpression.namedChildren.find((child) => child.type === 'identifier');
    return id?.text ?? null;
  }

  #findInnermostObject(node: Node, statementObject: Node): Node {
    let current: Node | null = node;
    while (current && current.id !== statementObject.id) {
      if (current.type === 'object') return current;
      current = current.parent;
    }
    return statementObject;
  }

  #collectObjectExistingKeys(object: Node): string[] {
    return object.namedChildren
      .filter((child) => child.type === 'object_elem')
      .map((element) => this.#getObjectElemKey(element))
      .filter((key): key is string => key !== null);
  }

  #extractJsonencodePartialAndValue(node: Node, position: Position): { partial: string; value: string; range?: Range } {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'identifier' || current.type === 'template_literal') {
        const value = current.text;
        const range = nodeRange(current);
        if (position.line === current.startPosition.row) {
          return { partial: value.slice(0, position.character - current.startPosition.column), value, range };
        }
        return { partial: value, value, range };
      }
      if (current.type === 'object' || current.type === 'object_elem') break;
      current = current.parent;
    }
    return { partial: '', value: '' };
  }

  // ---------------------------------------------------------------------------
  // Block mode — block/body/attribute, snake_case keys
  // ---------------------------------------------------------------------------

  #tryBlockMode(node: Node, nodeBefore: Node | null, position: Position): CursorContext | null {
    let statementBlock = this.#findStatementBlock(node);
    if (!statementBlock && nodeBefore) statementBlock = this.#findStatementBlock(nodeBefore);
    if (!statementBlock) return null;

    const statementBody = statementBlock.namedChildren.find((child) => child.type === 'body') ?? null;

    // If cursor is inside the body, do normal cursor path walk
    if (statementBody && this.#isDescendantOf(node, statementBody)) {
      // Cursor right after a closing quote — no completions
      if (nodeBefore?.type === 'quoted_template_end') return null;
      const context1 = this.#resolveBlockCursorContext(node, statementBody, position);
      const context2 = nodeBefore ? this.#resolveBlockCursorContext(nodeBefore, statementBody, position) : null;
      return this.#pickBestCursorContext(context1, context2);
    }

    // Cursor is on the block itself (outside body span) — statement-key level
    const { partial, value, range } = this.#extractBlockPartialAndValue(node, position);

    // Check for incomplete attributes on the same line (may be in ERROR nodes
    // when tree-sitter can't parse the body due to a missing value)
    const searchParent = statementBody ?? statementBlock;
    for (const child of searchParent.namedChildren) {
      if (child.startPosition.row !== position.line) continue;
      if (child.type === 'attribute' || child.type === 'ERROR') {
        const id = child.namedChildren.find((namedChild) => namedChild.type === 'identifier');
        if (id) {
          if (!this.#isInsideQuote(node) && (!nodeBefore || !this.#isInsideQuote(nodeBefore))) return null;
          return {
            keys: [id.text],
            role: 'value',
            partial: '',
            value: '',
            policyFormat: 'hcl-block',
          };
        }
      }
    }

    return {
      keys: [],
      role: 'key',
      partial,
      value,
      range,
      policyFormat: 'hcl-block',
    };
  }

  #resolveBlockCursorContext(node: Node, statementBody: Node, position: Position): CursorContext | null {
    const cursorPath = this.#buildBlockCursorPath(node, statementBody, position);
    if (cursorPath.role === 'value' && !this.#isInsideQuote(node)) return null;
    // When inside a principals block's identifiers attribute, read the sibling
    // type attribute and append its value to the cursor path keys so the location
    // resolver can emit principal-block-identifier with the correct type.
    if (
      (cursorPath.keys[0] === 'principals' || cursorPath.keys[0] === 'not_principals') &&
      cursorPath.keys[1] === 'identifiers' &&
      cursorPath.role === 'value'
    ) {
      const principalsBlock = this.#findEnclosingBlock(node, cursorPath.keys[0], statementBody);
      if (principalsBlock) {
        const blockBody = principalsBlock.namedChildren.find((child) => child.type === 'body');
        const typeValue = blockBody ? this.#readAttributeStringValue(blockBody, 'type') : null;
        if (typeValue) cursorPath.keys.push(typeValue);
      }
    }
    return { ...cursorPath, policyFormat: 'hcl-block' };
  }

  #findStatementBlock(node: Node): Node | null {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'block' && this.#getBlockIdentifier(current) === 'statement') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  #getBlockIdentifier(block: Node): string | null {
    const id = block.namedChildren.find((child) => child.type === 'identifier');
    return id?.text ?? null;
  }

  #isDescendantOf(node: Node, ancestor: Node): boolean {
    let current: Node | null = node;
    while (current) {
      if (current.id === ancestor.id) return true;
      current = current.parent;
    }
    return false;
  }

  #buildBlockCursorPath(cursorNode: Node, statementBody: Node, position: Position) {
    const keys: string[] = [];
    let role: 'key' | 'value' | null = null;
    let previous: Node | null = null;
    let current: Node | null = cursorNode;

    while (current && current.id !== statementBody.id) {
      if (current.type === 'body' && role === null) {
        role = 'key';
      }

      if (current.type === 'attribute') {
        const attrKey = current.namedChildren.find((child) => child.type === 'identifier');

        if (role === null) {
          if (previous && attrKey && previous.id === attrKey.id) {
            role = 'key';
          } else {
            role = 'value';
            if (attrKey) keys.unshift(attrKey.text);
          }
        } else {
          if (attrKey) keys.unshift(attrKey.text);
        }
      }

      // Sub-blocks (e.g. condition, principals) contribute their identifier as a key
      if (current.type === 'block') {
        const blockIdentifier = this.#getBlockIdentifier(current);
        if (
          blockIdentifier === 'condition' ||
          blockIdentifier === 'principals' ||
          blockIdentifier === 'not_principals'
        ) {
          if (role === null) role = 'key';
          keys.unshift(blockIdentifier);
        }
      }

      previous = current;
      current = current.parent;
    }

    if (role === null) role = 'key';
    const { partial, value, range } = this.#extractBlockPartialAndValue(cursorNode, position);
    return { keys, role, partial, value, range };
  }

  #findEnclosingBlock(node: Node, blockName: string, statementBody: Node): Node | null {
    let current: Node | null = node;
    while (current && current.id !== statementBody.id) {
      if (current.type === 'block' && this.#getBlockIdentifier(current) === blockName) return current;
      current = current.parent;
    }
    return null;
  }

  #readAttributeStringValue(body: Node, name: string): string | null {
    for (const child of body.namedChildren) {
      if (child.type !== 'attribute') continue;
      const id = child.namedChildren.find((namedChild) => namedChild.type === 'identifier');
      if (id?.text !== name) continue;
      const expression = child.namedChildren.find((namedChild) => namedChild.type === 'expression');
      const literal = expression?.namedChildren.find((child) => child.type === 'literal_value');
      const string = literal?.namedChildren.find((child) => child.type === 'string_lit');
      const template = string?.namedChildren.find((child) => child.type === 'template_literal');
      return template?.text ?? null;
    }
    return null;
  }

  #findInnermostBody(node: Node, statementBody: Node): Node {
    let current: Node | null = node;
    while (current && current.id !== statementBody.id) {
      if (current.type === 'body') return current;
      current = current.parent;
    }
    return statementBody;
  }

  #collectBodyExistingKeys(body: Node): string[] {
    const keys: string[] = [];
    for (const child of body.namedChildren) {
      if (child.type === 'attribute') {
        const id = child.namedChildren.find((namedChild) => namedChild.type === 'identifier');
        if (id) keys.push(id.text);
      }
      // Sub-blocks (e.g. condition) are not included — HCL allows multiples
    }
    return keys;
  }

  #hasBodyAttribute(body: Node, name: string): boolean {
    return body.namedChildren.some(
      (child) =>
        child.type === 'attribute' && child.namedChildren.some((id) => id.type === 'identifier' && id.text === name),
    );
  }

  #extractBlockPartialAndValue(node: Node, position: Position): { partial: string; value: string; range?: Range } {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'identifier' || current.type === 'template_literal') {
        const value = current.text;
        const range = nodeRange(current);
        if (position.line === current.startPosition.row) {
          return { partial: value.slice(0, position.character - current.startPosition.column), value, range };
        }
        return { partial: value, value, range };
      }
      if (current.type === 'body' || current.type === 'attribute' || current.type === 'block') break;
      current = current.parent;
    }
    return { partial: '', value: '' };
  }

  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------

  #isInsideQuote(node: Node): boolean {
    let current: Node | null = node;
    while (current) {
      // The closing quote is part of string_lit but the cursor is past the string content
      if (current.type === 'quoted_template_end') return false;
      if (
        current.type === 'quoted_template' ||
        current.type === 'template_literal' ||
        current.type === 'string_lit' ||
        current.type === 'quoted_template_start'
      )
        return true;
      if (
        current.type === 'attribute' ||
        current.type === 'object_elem' ||
        current.type === 'body' ||
        current.type === 'object'
      )
        return false;
      current = current.parent;
    }
    return false;
  }

  /**
   * When tree-sitter produces a root-level ERROR (e.g., unterminated quote in
   * a value like `actions = ["`), scan the ERROR children for statement context.
   */
  #tryRecoverFromError(node: Node, nodeBefore: Node | null, position: Position): CursorContext | null {
    let errorNode: Node | null = node;
    while (errorNode && errorNode.type !== 'ERROR') {
      errorNode = errorNode.parent;
    }
    if (!errorNode) return null;

    // Cursor must be inside a quote. In ERROR recovery, the cursor node is the
    // ERROR itself so isInsideQuote won't find an ancestor. Check for a
    // quoted_template_start child on the cursor line before the cursor position.
    const hasQuoteOnLine =
      this.#isInsideQuote(node) ||
      (nodeBefore && this.#isInsideQuote(nodeBefore)) ||
      errorNode.children.some(
        (child) =>
          child.type === 'quoted_template_start' &&
          child.startPosition.row === position.line &&
          child.endPosition.column <= position.character,
      );
    if (!hasQuoteOnLine) return null;

    let foundStatement = false;
    let policyFormat: 'standard' | 'hcl-block' | null = null;
    let lastKey: string | null = null;
    let lastKeyFromAttribute = false;

    // Sub-block tracking (principals, not_principals, condition)
    const subBlockNames = new Set(['principals', 'not_principals', 'condition']);
    let pendingSubBlockId: string | null = null;
    let subBlockKey: string | null = null;
    let subBlockTypeValue: string | null = null;

    for (const child of errorNode.children) {
      // Stop at children past the cursor
      if (child.startPosition.row > position.line) break;

      // Detect statement marker: `identifier "statement"` (block) or
      // `expression > variable_expr > identifier "Statement"` (jsonencode)
      if (!foundStatement) {
        if (child.type === 'identifier' && child.text === 'statement') {
          foundStatement = true;
          policyFormat = 'hcl-block';
        } else if (child.type === 'expression') {
          const id = this.#getExpressionIdentifier(child);
          if (id === 'Statement') {
            foundStatement = true;
            policyFormat = 'standard';
          }
        }
        continue;
      }

      // Confirm sub-block entry when we see block_start after a known sub-block identifier
      if (child.type === 'block_start' && pendingSubBlockId) {
        subBlockKey = pendingSubBlockId;
        subBlockTypeValue = null;
        pendingSubBlockId = null;
        continue;
      }
      pendingSubBlockId = null;

      // Exit sub-block on block_end
      if (child.type === 'block_end' && subBlockKey) {
        subBlockKey = null;
        subBlockTypeValue = null;
        continue;
      }

      // Track key identifiers after statement marker
      if (child.type === 'identifier') {
        lastKey = child.text;
        lastKeyFromAttribute = false;
        if (subBlockNames.has(child.text)) {
          pendingSubBlockId = child.text;
        }
      } else if (child.type === 'expression') {
        const id = this.#getExpressionIdentifier(child);
        if (id) {
          lastKey = id;
          lastKeyFromAttribute = false;
        }
      } else if (child.type === 'object_elem') {
        const key = this.#getObjectElemKey(child);
        if (key) {
          lastKey = key;
          lastKeyFromAttribute = true;
        }
      } else if (child.type === 'attribute') {
        const id = child.namedChildren.find((namedChild) => namedChild.type === 'identifier');
        if (id) {
          lastKey = id.text;
          lastKeyFromAttribute = true;
          // Read type attribute value inside a principals sub-block
          if (subBlockKey && (subBlockKey === 'principals' || subBlockKey === 'not_principals') && id.text === 'type') {
            const expression = child.namedChildren.find((namedChild) => namedChild.type === 'expression');
            const literal = expression?.namedChildren.find((child) => child.type === 'literal_value');
            const string = literal?.namedChildren.find((child) => child.type === 'string_lit');
            const template = string?.namedChildren.find((child) => child.type === 'template_literal');
            if (template) subBlockTypeValue = template.text;
          }
        }
      }
    }

    if (!foundStatement || !lastKey || !policyFormat) return null;

    // Extract partial and value: when the key came from an attribute/object_elem
    // that contains the quote (e.g., `effect = "`), they're empty. When the
    // cursor node is inside a string (open quote slurped subsequent lines),
    // extract from the template_literal. Otherwise extract from ERROR node text.
    let partial = '';
    let value = '';
    let range: Range | undefined;
    if (!lastKeyFromAttribute) {
      if (this.#isInsideQuote(node)) {
        ({ partial, value, range } = this.#extractQuotedPartialAndValue(node, position));
      } else if (nodeBefore && this.#isInsideQuote(nodeBefore)) {
        ({ partial, value, range } = this.#extractQuotedPartialAndValue(nodeBefore, position));
      } else {
        ({ partial, value } = this.#extractPartialAndValueFromErrorNode(errorNode, position));
      }
    }

    // Build keys with sub-block prefix when inside a sub-block
    const keys = subBlockKey ? [subBlockKey, lastKey] : [lastKey];
    if (
      subBlockKey &&
      (subBlockKey === 'principals' || subBlockKey === 'not_principals') &&
      lastKey === 'identifiers' &&
      subBlockTypeValue
    ) {
      keys.push(subBlockTypeValue);
    }

    return {
      keys,
      role: 'value',
      partial,
      value,
      range,
      policyFormat,
    };
  }

  /**
   * Extract partial from inside a quoted string (when the open quote caused
   * tree-sitter to slurp subsequent lines into a string_lit).
   */
  #extractQuotedPartialAndValue(node: Node, position: Position): { partial: string; value: string; range?: Range } {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'template_literal') {
        const value = current.text;
        const range = nodeRange(current);
        if (position.line === current.startPosition.row) {
          return { partial: value.slice(0, position.character - current.startPosition.column), value, range };
        }
        return { partial: '', value, range };
      }
      if (current.type === 'quoted_template_start') return { partial: '', value: '' };
      if (current.type === 'string_lit') {
        // Cursor is right after the opening quote, no template_literal yet
        return { partial: '', value: '' };
      }
      current = current.parent;
    }
    return { partial: '', value: '' };
  }

  #extractPartialAndValueFromErrorNode(errorNode: Node, position: Position): { partial: string; value: string } {
    let afterColumn = 0;
    let nextChildColumn: number | null = null;
    for (const child of errorNode.children) {
      if (child.startPosition.row !== position.line) continue;
      // Only consider children that end on the same line (multi-line children
      // like attributes have endPosition from a different row)
      if (child.endPosition.row !== position.line) continue;
      if (child.endPosition.column <= position.character) {
        afterColumn = child.endPosition.column;
      } else if (nextChildColumn === null && child.startPosition.column > position.character) {
        nextChildColumn = child.startPosition.column;
      }
    }

    const lines = errorNode.text.split('\n');
    const lineIndex = position.line - errorNode.startPosition.row;
    if (lineIndex < 0 || lineIndex >= lines.length) return { partial: '', value: '' };
    const line = lines[lineIndex];
    const startColumn = lineIndex === 0 ? errorNode.startPosition.column : 0;
    const partial = line.slice(afterColumn - startColumn, position.character - startColumn);
    const valueEnd = nextChildColumn !== null ? nextChildColumn - startColumn : line.length;
    const value = line.slice(afterColumn - startColumn, valueEnd);
    return { partial, value };
  }

  #getExpressionIdentifier(expression: Node): string | null {
    const variableExpression = expression.namedChildren.find((child) => child.type === 'variable_expr');
    if (!variableExpression) return null;
    const id = variableExpression.namedChildren.find((child) => child.type === 'identifier');
    return id?.text ?? null;
  }

  #pickBestCursorContext(a: CursorContext | null, b: CursorContext | null): CursorContext | null {
    if (!a) return b;
    if (!b) return a;
    if (a.partial === '' && b.partial !== '') return b;
    if (a.partial === '' && b.partial === '' && b.keys.length > a.keys.length) return b;
    return a;
  }

  /**
   * Read all string values from an attribute in an HCL body.
   * Handles both single string (`actions = "s3:GetObject"`) and
   * tuple (`actions = ["s3:GetObject", "s3:PutObject"]`) forms.
   */
  #readAttributeStringValues(body: Node, name: string): string[] {
    for (const child of body.namedChildren) {
      if (child.type !== 'attribute') continue;
      const id = child.namedChildren.find((namedChild) => namedChild.type === 'identifier');
      if (id?.text !== name) continue;
      const expression = child.namedChildren.find((namedChild) => namedChild.type === 'expression');
      if (!expression) return [];

      // Single string literal
      const literal = expression.namedChildren.find((child) => child.type === 'literal_value');
      if (literal) {
        const string = literal.namedChildren.find((child) => child.type === 'string_lit');
        const template = string?.namedChildren.find((child) => child.type === 'template_literal');
        return template?.text ? [template.text] : [];
      }

      // Tuple of strings
      let tuple = expression.namedChildren.find((child) => child.type === 'tuple');
      if (!tuple) {
        const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
        tuple = collectionValue?.namedChildren.find((child) => child.type === 'tuple') ?? undefined;
      }
      if (tuple) {
        const values: string[] = [];
        for (const element of tuple.namedChildren) {
          const elementExpression = element.type === 'expression' ? element : null;
          const elementLiteral = elementExpression?.namedChildren.find((child) => child.type === 'literal_value');
          const elementString = elementLiteral?.namedChildren.find((child) => child.type === 'string_lit');
          const elementTemplate = elementString?.namedChildren.find((child) => child.type === 'template_literal');
          if (elementTemplate?.text) values.push(elementTemplate.text);
        }
        return values;
      }
    }
    return [];
  }

  /**
   * Read string values from an HCL expression (string literal or tuple of strings).
   */
  #readExpressionStringValues(expression: Node): string[] {
    const literal = expression.namedChildren.find((child) => child.type === 'literal_value');
    if (literal) {
      const string = literal.namedChildren.find((child) => child.type === 'string_lit');
      const template = string?.namedChildren.find((child) => child.type === 'template_literal');
      return template?.text ? [template.text] : [];
    }

    let tuple = expression.namedChildren.find((child) => child.type === 'tuple');
    if (!tuple) {
      const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
      tuple = collectionValue?.namedChildren.find((child) => child.type === 'tuple') ?? undefined;
    }
    if (tuple) {
      const values: string[] = [];
      for (const element of tuple.namedChildren) {
        const elementExpression = element.type === 'expression' ? element : null;
        const elementLiteral = elementExpression?.namedChildren.find((child) => child.type === 'literal_value');
        const elementString = elementLiteral?.namedChildren.find((child) => child.type === 'string_lit');
        const elementTemplate = elementString?.namedChildren.find((child) => child.type === 'template_literal');
        if (elementTemplate?.text) values.push(elementTemplate.text);
      }
      return values;
    }

    return [];
  }

  /**
   * Extract statement structure from an HCL block body (snake_case attributes).
   */
  #extractBlockStatementContext(statementBody: Node): StatementContext {
    const context: StatementContext = {};
    const sid = this.#readAttributeStringValue(statementBody, 'sid');
    if (sid) context.Sid = sid;
    const effect = this.#readAttributeStringValue(statementBody, 'effect');
    if (effect) context.Effect = effect;
    if (this.#hasBodyAttribute(statementBody, 'actions'))
      context.Action = this.#readAttributeStringValues(statementBody, 'actions');
    if (this.#hasBodyAttribute(statementBody, 'not_actions'))
      context.NotAction = this.#readAttributeStringValues(statementBody, 'not_actions');
    if (this.#hasBodyAttribute(statementBody, 'resources'))
      context.Resource = this.#readAttributeStringValues(statementBody, 'resources');
    if (this.#hasBodyAttribute(statementBody, 'not_resources'))
      context.NotResource = this.#readAttributeStringValues(statementBody, 'not_resources');

    // Read condition sub-blocks: condition { test = "Op" variable = "key" values = [...] }
    const condition: Record<string, Record<string, string[]>> = {};
    for (const child of statementBody.namedChildren) {
      if (child.type !== 'block' || this.#getBlockIdentifier(child) !== 'condition') continue;
      const blockBody = child.namedChildren.find((namedChild) => namedChild.type === 'body');
      if (!blockBody) continue;
      const test = this.#readAttributeStringValue(blockBody, 'test');
      const variable = this.#readAttributeStringValue(blockBody, 'variable');
      const values = this.#readAttributeStringValues(blockBody, 'values');
      if (test) {
        if (!condition[test]) condition[test] = {};
        if (variable) condition[test][variable] = values;
      }
    }
    if (Object.keys(condition).length > 0) context.Condition = condition;

    // Read principals/not_principals sub-blocks
    for (const blockName of ['principals', 'not_principals'] as const) {
      const principals: Record<string, string[]> = {};
      for (const child of statementBody.namedChildren) {
        if (child.type !== 'block' || this.#getBlockIdentifier(child) !== blockName) continue;
        const blockBody = child.namedChildren.find((namedChild) => namedChild.type === 'body');
        if (!blockBody) continue;
        const type = this.#readAttributeStringValue(blockBody, 'type');
        const identifiers = this.#readAttributeStringValues(blockBody, 'identifiers');
        if (type) {
          if (type === '*') {
            if (blockName === 'principals') context.Principal = '*';
            else context.NotPrincipal = '*';
            break;
          }
          principals[type] = identifiers;
        }
      }
      if (Object.keys(principals).length > 0) {
        if (blockName === 'principals') context.Principal = principals;
        else context.NotPrincipal = principals;
      }
    }

    return context;
  }

  /**
   * Extract statement structure from an HCL jsonencode object (PascalCase keys).
   */
  #extractJsonencodeStatementContext(statementObject: Node): StatementContext {
    const context: StatementContext = {};
    for (const child of statementObject.namedChildren) {
      if (child.type !== 'object_elem') continue;
      const key = this.#getObjectElemKey(child);
      const expressions = child.namedChildren.filter((namedChild) => namedChild.type === 'expression');
      const valueExpression = expressions.length >= 2 ? expressions[1] : null;
      if (!valueExpression) continue;
      if (key === 'Sid') {
        const values = this.#readExpressionStringValues(valueExpression);
        if (values.length > 0) context.Sid = values[0];
      } else if (key === 'Effect') {
        const values = this.#readExpressionStringValues(valueExpression);
        if (values.length > 0) context.Effect = values[0];
      } else if (key === 'Action') {
        context.Action = this.#readExpressionStringValues(valueExpression);
      } else if (key === 'NotAction') {
        context.NotAction = this.#readExpressionStringValues(valueExpression);
      } else if (key === 'Resource') {
        context.Resource = this.#readExpressionStringValues(valueExpression);
      } else if (key === 'NotResource') {
        context.NotResource = this.#readExpressionStringValues(valueExpression);
      } else if (key === 'Principal' || key === 'NotPrincipal') {
        const value = this.#readJsonencodePrincipalValue(valueExpression);
        if (value) {
          if (key === 'Principal') context.Principal = value;
          else context.NotPrincipal = value;
        }
      } else if (key === 'Condition') {
        context.Condition = this.#readJsonencodeConditionValue(valueExpression);
      }
    }
    return context;
  }

  #readJsonencodePrincipalValue(expression: Node): Record<string, string[]> | string | null {
    const values = this.#readExpressionStringValues(expression);
    if (values.length === 1 && values[0] === '*') return '*';

    let object = expression.namedChildren.find((child) => child.type === 'object');
    if (!object) {
      const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
      object = collectionValue?.namedChildren.find((child) => child.type === 'object') ?? undefined;
    }
    if (!object) return null;

    const result: Record<string, string[]> = {};
    for (const child of object.namedChildren) {
      if (child.type !== 'object_elem') continue;
      const typeKey = this.#getObjectElemKey(child);
      const expressions = child.namedChildren.filter((namedChild) => namedChild.type === 'expression');
      const valueExpressionession = expressions.length >= 2 ? expressions[1] : null;
      if (typeKey && valueExpressionession) result[typeKey] = this.#readExpressionStringValues(valueExpressionession);
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  #readJsonencodeConditionValue(expression: Node): Record<string, Record<string, string[]>> {
    const result: Record<string, Record<string, string[]>> = {};
    let object = expression.namedChildren.find((child) => child.type === 'object');
    if (!object) {
      const collectionValue = expression.namedChildren.find((child) => child.type === 'collection_value');
      object = collectionValue?.namedChildren.find((child) => child.type === 'object') ?? undefined;
    }
    if (!object) return result;

    for (const operatorElement of object.namedChildren) {
      if (operatorElement.type !== 'object_elem') continue;
      const operator = this.#getObjectElemKey(operatorElement);
      if (!operator) continue;

      const expressions = operatorElement.namedChildren.filter((child) => child.type === 'expression');
      const valueExpressionession = expressions.length >= 2 ? expressions[1] : null;
      if (!valueExpressionession) {
        result[operator] = {};
        continue;
      }

      let innerObject = valueExpressionession.namedChildren.find((child) => child.type === 'object');
      if (!innerObject) {
        const collectionValue = valueExpressionession.namedChildren.find((child) => child.type === 'collection_value');
        innerObject = collectionValue?.namedChildren.find((child) => child.type === 'object') ?? undefined;
      }
      if (!innerObject) {
        result[operator] = {};
        continue;
      }

      const keys: Record<string, string[]> = {};
      for (const keyElement of innerObject.namedChildren) {
        if (keyElement.type !== 'object_elem') continue;
        const conditionKey = this.#getObjectElemKey(keyElement);
        const keyExpressionessions = keyElement.namedChildren.filter((child) => child.type === 'expression');
        const keyValueExpression = keyExpressionessions.length >= 2 ? keyExpressionessions[1] : null;
        if (conditionKey && keyValueExpression)
          keys[conditionKey] = this.#readExpressionStringValues(keyValueExpression);
      }
      result[operator] = keys;
    }
    return result;
  }
}
