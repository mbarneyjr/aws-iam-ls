import { resolve } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { Language } from 'web-tree-sitter';
import type { CursorContext, Position, StatementContext } from './base.ts';
import { TreeBase } from './base.ts';

export class TreeYaml extends TreeBase {
  static async init() {
    const grammarDir = resolve(import.meta.dirname, '../../grammars');
    const language = await Language.load(resolve(grammarDir, 'tree-sitter-yaml.wasm'));
    return new TreeYaml(language);
  }

  getCursorContext(uri: string, position: Position): CursorContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    const nodeBefore =
      position.column > 0 ? this.getNodeAtPosition(uri, { line: position.line, column: position.column - 1 }) : null;

    const root = this.getTree(uri)?.rootNode;
    if (!root) return null;

    const candidates = this.#findAllStatementMappings(root);
    if (candidates.length === 0) return this.#tryRecoverFromError(node, position);

    const match = this.#pickStatementMapping(candidates, position);
    if (!match) {
      return this.#resolveEmptyStatementItem(node, candidates, position) ?? this.#tryRecoverFromError(node, position);
    }

    if (match.relationship === 'contains') {
      const context1 = this.#resolveCursorContext(node, match.mapping, position);
      const context2 = nodeBefore ? this.#resolveCursorContext(nodeBefore, match.mapping, position) : null;
      return this.#pickBestCursorContext(context1, context2);
    }

    // relationship === 'extended': cursor is past the mapping
    const context1 = this.#resolveExtendedContext(node, match.mapping, position);
    const context2 = nodeBefore ? this.#resolveExtendedContext(nodeBefore, match.mapping, position) : null;
    return this.#pickBestCursorContext(context1, context2);
  }

  getStatementContext(uri: string, position: Position): StatementContext | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return null;

    const root = this.getTree(uri)?.rootNode;
    if (!root) return null;

    const candidates = this.#findAllStatementMappings(root);
    const match = this.#pickStatementMapping(candidates, position);
    if (!match) return null;

    return this.#extractStatementContext(match.mapping);
  }

  getSiblingKeys(uri: string, position: Position): string[] {
    const node = this.getNodeAtPosition(uri, position);
    if (!node) return [];

    const root = this.getTree(uri)?.rootNode;
    if (!root) return [];

    const candidates = this.#findAllStatementMappings(root);
    const match = this.#pickStatementMapping(candidates, position);
    if (!match) return [];

    const cursorPath = this.#buildCursorPath(node, match.mapping, position);
    if (!cursorPath || cursorPath.role !== 'key') return [];

    return this.#collectExistingKeysAtPath(match.mapping, cursorPath.keys);
  }

  /**
   * Traverse the tree from root, collecting every block_mapping that sits inside
   * a Statement sequence. Skip descendants of matched mappings (they can't nest).
   */
  #findAllStatementMappings(root: Node): Node[] {
    const results: Node[] = [];
    const visit = (node: Node) => {
      if (node.type === 'block_mapping' && this.#isInsideStatementSequence(node)) {
        results.push(node);
        return; // statement mappings can't nest
      }
      for (const child of node.namedChildren) {
        visit(child);
      }
    };
    visit(root);
    return results;
  }

  /**
   * Pick the best statement mapping for the cursor position.
   * - 'contains': cursor is within the mapping's row span
   * - 'extended': cursor is past the mapping's end but aligned with it
   */
  #pickStatementMapping(
    candidates: Node[],
    position: Position,
  ): { mapping: Node; relationship: 'contains' | 'extended' } | null {
    // First, try to find a mapping that contains the cursor
    let containsMatch: Node | null = null;
    for (const mapping of candidates) {
      if (mapping.startPosition.row <= position.line && position.line <= mapping.endPosition.row) {
        // Prefer deepest (highest startPosition.row)
        if (!containsMatch || mapping.startPosition.row > containsMatch.startPosition.row) {
          containsMatch = mapping;
        }
      }
    }
    if (containsMatch) return { mapping: containsMatch, relationship: 'contains' };

    // Next, try 'extended': cursor is past the mapping's end, column >= mapping's key column,
    // and no other candidate starts between the mapping's end and cursor line
    let extendedMatch: Node | null = null;
    for (const mapping of candidates) {
      const pastEnd =
        position.line > mapping.endPosition.row ||
        (position.line === mapping.endPosition.row && position.column >= mapping.endPosition.column);
      if (!pastEnd) continue;
      if (position.column < mapping.startPosition.column) continue;

      // Don't extend across sibling statement items. If a sibling block_sequence_item
      // starts between this mapping's end and the cursor, the cursor is in a different statement.
      if (this.#hasSiblingItemBetween(mapping, position)) continue;

      // Don't extend into a different Statement sequence. If the cursor is inside
      // another Statement block_sequence (different from the one containing this mapping),
      // skip this candidate.
      const parentSequence = this.#getParentStatementSequence(mapping);
      if (parentSequence) {
        const cursorInDifferentSequence = candidates.some((other) => {
          if (other.id === mapping.id) return false;
          const otherSequence = this.#getParentStatementSequence(other);
          if (!otherSequence || otherSequence.id === parentSequence.id) return false;
          return position.line >= otherSequence.startPosition.row && position.line <= otherSequence.endPosition.row;
        });
        if (cursorInDifferentSequence) continue;
      }

      // Check no other candidate starts between this mapping's end and cursor
      const hasIntervening = candidates.some(
        (other) =>
          other.id !== mapping.id &&
          other.startPosition.row > mapping.endPosition.row &&
          other.startPosition.row <= position.line,
      );
      if (hasIntervening) continue;

      // Prefer closest endPosition.row
      if (!extendedMatch || mapping.endPosition.row > extendedMatch.endPosition.row) {
        extendedMatch = mapping;
      }
    }
    if (extendedMatch) return { mapping: extendedMatch, relationship: 'extended' };

    return null;
  }

  /**
   * Handle the 'extended' case where the cursor is past the statement mapping.
   * Uses resolveWithinMapping to determine context relative to the mapping.
   */
  #resolveExtendedContext(cursorNode: Node, statementMapping: Node, position: Position): CursorContext | null {
    const resolved = this.#resolveWithinMapping(statementMapping, position);
    if (!resolved) return null;
    const { partial, value } = this.#extractPartialAndValue(cursorNode, position);
    return {
      keys: resolved.keys,
      role: resolved.role,
      partial,
      value,
      policyFormat: 'standard',
    };
  }

  /**
   * Check if a sibling block_sequence_item starts between a mapping's end and the
   * cursor position. This detects when the cursor is in a different statement item.
   */
  #hasSiblingItemBetween(mapping: Node, position: Position): boolean {
    const containingItem = this.#skipBlockNode(mapping.parent);
    if (containingItem?.type !== 'block_sequence_item') return false;
    const sequence = containingItem.parent;
    if (sequence?.type !== 'block_sequence') return false;
    return sequence.namedChildren.some(
      (sibling) =>
        sibling.type === 'block_sequence_item' &&
        sibling.id !== containingItem.id &&
        sibling.startPosition.row > mapping.endPosition.row &&
        sibling.startPosition.row <= position.line,
    );
  }

  /**
   * Check if the cursor is inside a Statement sequence in an area with no block_mapping
   * (e.g., a new empty `- ` entry, or past the `-` on the block_sequence node itself).
   * Returns statement-key context if so.
   *
   * Two strategies:
   * 1. Walk up from cursor node — works when cursor lands on/inside the sequence or item.
   * 2. Use candidates' parent sequences — works when cursor lands on an ancestor above
   *    the sequence (e.g., a root block_mapping that contains the Statement pair).
   */
  #resolveEmptyStatementItem(node: Node, candidates: Node[], position: Position): CursorContext | null {
    // Strategy 1: walk up from cursor node
    let current: Node | null = node;
    while (current) {
      if (current.type === 'block_sequence_item') {
        const sequence = current.parent;
        if (sequence?.type === 'block_sequence' && this.#isStatementSequence(sequence)) {
          return {
            keys: [],
            role: 'key',
            ...this.#extractPartialAndValue(node, position),
            policyFormat: 'standard',
          };
        }
      }
      if (current.type === 'block_sequence' && this.#isStatementSequence(current)) {
        return {
          keys: [],
          role: 'key',
          ...this.#extractPartialAndValue(node, position),
          policyFormat: 'standard',
        };
      }
      current = current.parent;
    }

    // Strategy 2: check if any candidate's sibling sequence item is empty and on the cursor line
    for (const mapping of candidates) {
      const containingItem = this.#skipBlockNode(mapping.parent);
      if (containingItem?.type !== 'block_sequence_item') continue;
      const sequence = containingItem.parent;
      if (sequence?.type !== 'block_sequence') continue;
      for (const sibling of sequence.namedChildren) {
        if (sibling.type !== 'block_sequence_item') continue;
        if (sibling.startPosition.row !== position.line) continue;
        const hasMapping = sibling.namedChildren.some(
          (child) =>
            child.type === 'block_mapping' ||
            (child.type === 'block_node' &&
              child.namedChildren.some((grandChild) => grandChild.type === 'block_mapping')),
        );
        if (!hasMapping) {
          return {
            keys: [],
            role: 'key',
            ...this.#extractPartialAndValue(node, position),
            policyFormat: 'standard',
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a block_sequence is the value of a "Statement" mapping pair.
   */
  #isStatementSequence(sequence: Node): boolean {
    const sequenceParent = this.#skipBlockNode(sequence.parent);
    return sequenceParent?.type === 'block_mapping_pair' && this.#getPairKeyText(sequenceParent) === 'Statement';
  }

  #resolveCursorContext(node: Node, statementMapping: Node, position: Position): CursorContext | null {
    const cursorPath = this.#buildCursorPath(node, statementMapping, position);
    if (!cursorPath) return null;
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
   * Walk up from cursor to statement mapping, building the chain of mapping pair
   * keys crossed along the way.
   */
  #buildCursorPath(cursorNode: Node, statementMapping: Node, position: Position) {
    // If cursor lands on a block_sequence on an empty line (no child spans it)
    // and the column is deeper than the nearest ancestor mapping's key column,
    // the user is in a value area but hasn't started an item — no completion context.
    // If the column matches the ancestor mapping's key column, the user is typing
    // a new sibling key, so let the traversal continue.
    if (cursorNode.type === 'block_sequence') {
      const hasChildOnLine = cursorNode.namedChildren.some(
        (child) => child.startPosition.row <= position.line && position.line <= child.endPosition.row,
      );
      if (!hasChildOnLine) {
        const ancestorMapping = this.#findAncestorMapping(cursorNode);
        const keyColumn = ancestorMapping
          ? ancestorMapping.startPosition.column
          : statementMapping.startPosition.column;
        if (position.column > keyColumn) return null;
      }
    }

    const keys: string[] = [];
    let role: 'key' | 'value' | null = null;
    let previous: Node | null = null;
    let current: Node | null = cursorNode;
    let colonPartial = '';

    while (current && current.id !== statementMapping.id) {
      if (current.type === 'block_mapping' && role === null) {
        // Check for colon-induced mapping (e.g., "- s3:" in a sequence is parsed as
        // a mapping {s3: null} instead of a scalar). If the mapping has one pair with
        // no value and sits inside a block_sequence_item, collapse it: treat the key
        // text + ":" as a partial value and skip past the mapping.
        if (this.#isColonInducedMapping(current)) {
          const pair = current.namedChildren.find((child) => child.type === 'block_mapping_pair');
          const keyText = pair ? this.#getPairKeyText(pair) : null;
          if (keyText) {
            colonPartial = `${keyText}:`;
            previous = current;
            current = current.parent;
            continue;
          }
        }
        // Check if cursor is in the value area of a pair on the same line that has
        // no value child (e.g., "Service: $cursor$" where the pair ends at the colon).
        const pairOnLine = current.namedChildren.find(
          (child) =>
            child.type === 'block_mapping_pair' &&
            child.startPosition.row === position.line &&
            child.namedChildren.length === 1 &&
            position.column > child.endPosition.column,
        );
        if (pairOnLine) {
          const pairKey = this.#getPairKeyText(pairOnLine);
          if (pairKey) {
            keys.unshift(pairKey);
            role = 'value';
            previous = current;
            current = current.parent;
            continue;
          }
        }
        // When cursor lands on an inner block_mapping (not the statement mapping),
        // check if the cursor is actually outside this mapping (column < key column).
        // If so, skip it — the cursor belongs to a parent mapping level.
        if (current.id !== statementMapping.id && position.column < current.startPosition.column) {
          previous = current;
          current = current.parent;
          continue;
        }
        // Resolve within the inner mapping to detect nested pair context (e.g.,
        // cursor on empty line inside "StringEquals:" maps to keys=['StringEquals'], role='key').
        if (current.id !== statementMapping.id) {
          const resolved = this.#resolveWithinMapping(current, position);
          if (resolved && resolved.keys.length > 0) {
            keys.unshift(...resolved.keys);
            role = resolved.role;
            previous = current;
            current = current.parent;
            continue;
          }
        }
        role = 'key';
      }

      // When nodeBefore lands on the ":" inside a colon-induced mapping, we enter
      // via the inner pair (setting role='value', keys=['s3']). When we reach the
      // parent mapping, undo that contribution and collapse to colonPartial.
      if (current.type === 'block_mapping' && role !== null && this.#isColonInducedMapping(current)) {
        const pair = current.namedChildren.find((child) => child.type === 'block_mapping_pair');
        const keyText = pair ? this.#getPairKeyText(pair) : null;
        if (keyText && keys.length > 0 && keys[0] === keyText) {
          keys.shift();
          colonPartial = `${keyText}:`;
          role = null;
          previous = current;
          current = current.parent;
          continue;
        }
      }

      if (current.type === 'block_mapping_pair') {
        const pairKey = this.#getPairKeyText(current);

        if (role === null) {
          // Innermost pair — determine key vs value
          const isOnKey = previous && current.namedChildren[0] && previous.id === current.namedChildren[0].id;
          // Tree-sitter extends a pair's value span to cover trailing whitespace.
          // If the cursor column matches the parent mapping's key column, the user
          // is typing a new sibling key, not editing this pair's value.
          const parentMapping = current.parent;
          const isAtParentKeyColumn =
            parentMapping?.type === 'block_mapping' && position.column === parentMapping.startPosition.column;

          if (isOnKey || isAtParentKeyColumn) {
            role = 'key';
          } else {
            role = 'value';
            if (pairKey) keys.unshift(pairKey);
          }
        } else {
          // Outer pair — cursor was in its value subtree
          if (pairKey) keys.unshift(pairKey);
        }
      }

      previous = current;
      current = current.parent;
    }

    // When cursor falls on the statementMapping (e.g., after an incomplete pair or
    // in a multi-line pair's value area), find the owning pair. If the cursor is
    // indented past the mapping's key column, it's in a value area — find the
    // last pair starting before the cursor position.
    if (role === null && cursorNode.id === statementMapping.id) {
      const resolved = this.#resolveWithinMapping(statementMapping, position);
      if (!resolved) return null;
      keys.push(...resolved.keys);
      role = resolved.role;
    }

    if (role === null) role = 'key';
    const { partial: extractedPartial, value: extractedValue } = this.#extractPartialAndValue(cursorNode, position);
    const partial = colonPartial || extractedPartial;
    const value = colonPartial ? colonPartial : extractedValue;

    return { keys, role, partial, value };
  }

  /**
   * Resolve the cursor's position within a block_mapping by finding the pair covering
   * the cursor line and recursively descending into nested mappings.
   */
  #resolveWithinMapping(mapping: Node, position: Position): { keys: string[]; role: 'key' | 'value' } | null {
    const keyColumn = mapping.startPosition.column;
    if (position.column < keyColumn) return null;
    if (position.column === keyColumn) return { keys: [], role: 'key' };

    let pairBeforeCursor: Node | null = null;
    for (const child of mapping.namedChildren) {
      if (child.type !== 'block_mapping_pair') continue;
      if (child.startPosition.row > position.line) break;
      pairBeforeCursor = child;
    }
    if (!pairBeforeCursor) return null;

    const pairKey = this.#getPairKeyText(pairBeforeCursor);
    if (!pairKey) return null;

    if (position.line > pairBeforeCursor.endPosition.row) {
      // Cursor is past the pair — if the pair has no value, the cursor is at a key
      // position within the pair's value area (e.g., `Principal:\n      $cursor$`).
      const hasValue = pairBeforeCursor.namedChildren.length > 1;
      if (!hasValue) {
        return { keys: [pairKey], role: 'key' };
      }
      // The pair has a value and cursor is past it — try descending into a nested
      // mapping (e.g., cursor on empty line after `Service:` entries, at the same
      // column as the nested mapping's keys).
      const nestedMapping = this.#findValueBlockMapping(pairBeforeCursor);
      if (nestedMapping) {
        const inner = this.#resolveWithinMapping(nestedMapping, position);
        if (inner) return { keys: [pairKey, ...inner.keys], role: inner.role };
      }
      // Check if the pair's value is a block_sequence and the cursor is within
      // or immediately after it at the sequence's item column (e.g., adding a
      // new `- ` entry under `Service:`).
      const valueSequence = this.#findValueBlockSequence(pairBeforeCursor);
      if (
        valueSequence &&
        position.line <= valueSequence.endPosition.row &&
        position.column >= valueSequence.startPosition.column
      ) {
        return { keys: [pairKey], role: 'value' };
      }
      return null;
    }

    // Cursor is within the pair's span — try to descend into a nested block_mapping.
    const nestedMapping = this.#findValueBlockMapping(pairBeforeCursor);
    if (nestedMapping) {
      const inner = this.#resolveWithinMapping(nestedMapping, position);
      if (inner) {
        return { keys: [pairKey, ...inner.keys], role: inner.role };
      }
    }

    return { keys: [pairKey], role: 'value' };
  }

  /**
   * Find a block_mapping in a pair's value, unwrapping block_node if present.
   */
  #findValueBlockMapping(pair: Node): Node | null {
    if (pair.namedChildren.length < 2) return null;
    let value: Node | null = pair.namedChildren[1];
    if (value.type === 'block_node') value = value.namedChildren[0] ?? null;
    return value?.type === 'block_mapping' ? value : null;
  }

  /**
   * Find a block_sequence in a pair's value, unwrapping block_node if present.
   */
  #findValueBlockSequence(pair: Node): Node | null {
    if (pair.namedChildren.length < 2) return null;
    let value: Node | null = pair.namedChildren[1];
    if (value.type === 'block_node') value = value.namedChildren[0] ?? null;
    return value?.type === 'block_sequence' ? value : null;
  }

  /**
   * Find the nearest ancestor block_mapping above a node, skipping block_node wrappers.
   */
  #findAncestorMapping(node: Node): Node | null {
    let current = node.parent;
    while (current) {
      if (current.type === 'block_mapping') return current;
      current = current.parent;
    }
    return null;
  }

  /**
   * Detect a colon-induced mapping: a block_mapping with exactly one pair that has
   * no value, sitting inside a block_sequence_item (e.g., "- s3:" parsed as {s3: null}).
   */
  #isColonInducedMapping(mapping: Node): boolean {
    const pairs = mapping.namedChildren.filter((child) => child.type === 'block_mapping_pair');
    if (pairs.length !== 1) return false;
    if (pairs[0].namedChildren.length > 1) return false;
    let parent: Node | null = mapping.parent;
    while (parent && parent.type === 'block_node') parent = parent.parent;
    return parent?.type === 'block_sequence_item';
  }

  /**
   * Walk up, skipping block_node wrappers.
   */
  #skipBlockNode(node: Node | null): Node | null {
    return node?.type === 'block_node' ? node.parent : node;
  }

  /**
   * Check that a block_mapping is a direct child of a block_sequence_item
   * whose parent block_sequence is the value of a "Statement" mapping pair.
   *
   * Expected chain (block_node is optional at each level):
   *   block_mapping > block_node? > block_sequence_item > block_sequence > block_node? > block_mapping_pair
   */
  #getParentStatementSequence(mapping: Node): Node | null {
    const item = this.#skipBlockNode(mapping.parent);
    if (item?.type !== 'block_sequence_item') return null;
    const sequence = item.parent;
    if (sequence?.type !== 'block_sequence') return null;
    return sequence;
  }

  #isInsideStatementSequence(mapping: Node): boolean {
    let node = this.#skipBlockNode(mapping.parent);
    if (node?.type !== 'block_sequence_item') return false;
    node = node.parent;
    if (node?.type !== 'block_sequence') return false;
    node = this.#skipBlockNode(node.parent);
    if (node?.type !== 'block_mapping_pair') return false;
    return this.#getPairKeyText(node) === 'Statement';
  }

  /**
   * Get the unquoted text of a block_mapping_pair's key.
   */
  #getPairKeyText(pair: Node): string | null {
    const keyFlow = pair.namedChildren.find((child) => child.type === 'flow_node');
    return this.#getScalarText(keyFlow);
  }

  /**
   * Get the unquoted text content of a flow_node's scalar child.
   */
  #getScalarText(flowNode: Node | undefined): string | null {
    const scalar = flowNode?.namedChildren.find((child) => child.type !== 'tag');
    if (!scalar) return null;
    if (scalar.type === 'plain_scalar') {
      return scalar.namedChildren.find((child: Node) => child.type === 'string_scalar')?.text ?? null;
    }
    if (scalar.type === 'double_quote_scalar' || scalar.type === 'single_quote_scalar') {
      return scalar.text.slice(1, -1);
    }
    return null;
  }

  /**
   * Walk down a mapping following a key path, then collect existing keys from
   * the innermost mapping. E.g., path=['Condition'] finds the Condition pair's
   * value mapping and returns its keys.
   */
  #collectExistingKeysAtPath(mapping: Node, keys: string[]): string[] {
    let current = mapping;
    for (const key of keys) {
      const pair = current.namedChildren.find(
        (child) => child.type === 'block_mapping_pair' && this.#getPairKeyText(child) === key,
      );
      if (!pair) return [];
      const nested = this.#findValueBlockMapping(pair);
      if (!nested) return [];
      current = nested;
    }
    return this.#collectExistingKeys(current);
  }

  /**
   * Collect all key names from block_mapping_pair children of a block_mapping.
   */
  #collectExistingKeys(mapping: Node): string[] {
    return mapping.namedChildren
      .filter((child) => child.type === 'block_mapping_pair')
      .map((pair) => this.#getPairKeyText(pair))
      .filter((key): key is string => key !== null);
  }

  /**
   * Extract the partial text (up to cursor) and full value from the nearest
   * scalar node.
   */
  #extractPartialAndValue(node: Node, position: Position): { partial: string; value: string } {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'string_scalar') {
        return this.#sliceToPositionAndValue(current.text, current.startPosition.column, position, node);
      }
      if (current.type === 'double_quote_scalar' || current.type === 'single_quote_scalar') {
        return this.#sliceToPositionAndValue(
          current.text.slice(1, -1),
          current.startPosition.column + 1,
          position,
          node,
        );
      }
      if (current.type === 'block_mapping' || current.type === 'block_mapping_pair') break;
      current = current.parent;
    }
    return { partial: '', value: '' };
  }

  #sliceToPositionAndValue(
    text: string,
    startColumn: number,
    position: Position,
    node: Node,
  ): { partial: string; value: string } {
    if (position.line === node.startPosition.row) {
      return { partial: text.slice(0, position.column - startColumn), value: text };
    }
    return { partial: text, value: text };
  }

  /**
   * When tree-sitter produces a root-level ERROR (e.g., unterminated quote in
   * "Effect: "), try to recover context from the ERROR node's children.
   */
  #tryRecoverFromError(node: Node, position: Position): CursorContext | null {
    let errorNode: Node | null = node;
    while (errorNode && errorNode.type !== 'ERROR') {
      errorNode = errorNode.parent;
    }

    // If no ERROR ancestor, look for an ERROR sibling in the root tree
    // (e.g., `Action: s3:` splits into ERROR + document at the colon boundary)
    if (!errorNode) {
      let root: Node = node;
      while (root.parent) root = root.parent;
      for (const child of root.children) {
        if (child.type === 'ERROR' && child.endPosition.row >= position.line) {
          errorNode = child;
          break;
        }
      }
    }

    if (!errorNode) return null;

    // Scan ERROR children for a Statement-like structure: "Statement" + ":"
    let foundStatement = false;
    let lastKey: string | null = null;
    for (const child of errorNode.children) {
      if (!foundStatement) {
        if (child.type === 'flow_node') {
          const text = this.#getScalarText(child);
          if (text === 'Statement') foundStatement = true;
        }
        continue;
      }

      // After finding "Statement", look for a key on the cursor line
      if (child.type === 'flow_node' && child.startPosition.row === position.line) {
        const keyText = this.#getScalarText(child);
        if (!keyText) continue;

        // Cursor within the key text — still typing the key
        if (position.column < child.endPosition.column) {
          const partial = keyText.slice(0, position.column - child.startPosition.column);
          return {
            keys: [],
            role: 'key',
            partial,
            value: partial,
            policyFormat: 'standard',
          };
        }

        // Cursor at key end — key is complete but ":" hasn't been typed yet
        if (position.column === child.endPosition.column) {
          return null;
        }

        return {
          keys: [keyText],
          role: 'value',
          partial: '',
          value: '',
          policyFormat: 'standard',
        };
      }

      // Handle block_mapping_pair on cursor line (e.g., `Action: s3:` where
      // the pair is inside the ERROR but the colon splits into a new document)
      if (child.type === 'block_mapping_pair' && child.startPosition.row === position.line) {
        const pairKey = this.#getPairKeyText(child);
        if (!pairKey) continue;

        const valueText = this.#getPairValueText(child) ?? '';
        // If cursor is past the ERROR end (colon continuation), append ":"
        const colonSuffix =
          errorNode.endPosition.row === position.line && position.column > errorNode.endPosition.column ? ':' : '';

        const fullValue = valueText + colonSuffix;
        return {
          keys: [pairKey],
          role: 'value',
          partial: fullValue,
          value: fullValue,
          policyFormat: 'standard',
        };
      }

      // Track the last statement-level key seen before the cursor line (e.g.,
      // "Resource" on line 4 when cursor is on line 5 inside a broken sequence item)
      if (child.type === 'flow_node' && child.startPosition.row < position.line) {
        const keyText = this.#getScalarText(child);
        if (keyText) {
          lastKey = keyText;
        }
      }
    }

    // If we found a key before cursor line and the cursor is in its value area
    // (e.g., `Resource:\n  - !Sub "arn:` where the open quote breaks the parse)
    if (lastKey) {
      const { partial, value } = this.#extractPartialAndValueFromErrorNode(errorNode, position);
      return {
        keys: [lastKey],
        role: 'value',
        partial,
        value,
        policyFormat: 'standard',
      };
    }

    return null;
  }

  /**
   * Extract the partial text and full value from an ERROR node for the cursor line.
   * Scans ERROR children on the cursor line to find the last child before/at the
   * cursor, then takes the substring from its end to the cursor column (partial)
   * and to the next child or end of content (value).
   */
  #extractPartialAndValueFromErrorNode(errorNode: Node, position: Position): { partial: string; value: string } {
    // Find the rightmost child on the cursor line that ends at or before the cursor,
    // and the leftmost child that starts after the cursor
    let afterColumn = 0;
    let nextChildColumn: number | null = null;
    for (const child of errorNode.children) {
      if (child.startPosition.row !== position.line) continue;
      if (child.endPosition.column <= position.column) {
        afterColumn = child.endPosition.column;
      } else if (nextChildColumn === null && child.startPosition.column > position.column) {
        nextChildColumn = child.startPosition.column;
      }
    }

    // Extract from the ERROR node's text: find the cursor line and slice
    const lines = errorNode.text.split('\n');
    const lineIndex = position.line - errorNode.startPosition.row;
    if (lineIndex < 0 || lineIndex >= lines.length) return { partial: '', value: '' };
    const line = lines[lineIndex];
    const startColumn = lineIndex === 0 ? errorNode.startPosition.column : 0;
    const partial = line.slice(afterColumn - startColumn, position.column - startColumn);
    const valueEnd = nextChildColumn !== null ? nextChildColumn - startColumn : line.length;
    const value = line.slice(afterColumn - startColumn, valueEnd);
    return { partial, value };
  }

  #getPairValueText(pair: Node): string | null {
    const flowNodes = pair.namedChildren.filter((child) => child.type === 'flow_node');
    return flowNodes.length >= 2 ? this.#getScalarText(flowNodes[1]) : null;
  }

  /**
   * Read string values from a mapping pair's value (scalar, block sequence, or flow sequence).
   */
  #readPairStringValues(pair: Node): string[] {
    if (pair.namedChildren.length < 2) return [];
    const valueNode = pair.namedChildren[1];

    // Direct flow_node scalar
    if (valueNode.type === 'flow_node') {
      const text = this.#getScalarText(valueNode);
      return text ? [text] : [];
    }

    // block_node wrapping a block_sequence or flow_node
    const inner = valueNode.type === 'block_node' ? (valueNode.namedChildren[0] ?? null) : valueNode;
    if (!inner) return [];

    if (inner.type === 'flow_node') {
      const text = this.#getScalarText(inner);
      return text ? [text] : [];
    }

    // Block sequence (e.g., Action:\n  - s3:GetObject\n  - s3:PutObject)
    if (inner.type === 'block_sequence') {
      const values: string[] = [];
      for (const item of inner.namedChildren) {
        if (item.type !== 'block_sequence_item') continue;
        const flowNode = item.namedChildren.find((child) => child.type === 'flow_node');
        const text = this.#getScalarText(flowNode);
        if (text) values.push(text);
      }
      return values;
    }

    // Flow sequence (e.g., Action: [s3:GetObject, s3:PutObject])
    if (inner.type === 'flow_sequence') {
      const values: string[] = [];
      for (const flowItem of inner.namedChildren) {
        if (flowItem.type !== 'flow_node') continue;
        const text = this.#getScalarText(flowItem);
        if (text) values.push(text);
      }
      return values;
    }

    return [];
  }

  /**
   * Extract the statement structure from a YAML statement block_mapping.
   */
  #extractStatementContext(statementMapping: Node): StatementContext {
    const context: StatementContext = {};
    for (const child of statementMapping.namedChildren) {
      if (child.type !== 'block_mapping_pair') continue;
      const key = this.#getPairKeyText(child);
      if (key === 'Sid') {
        const text = this.#getPairValueText(child);
        if (text) context.Sid = text;
      } else if (key === 'Effect') {
        const text = this.#getPairValueText(child);
        if (text) context.Effect = text;
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
   * Read a Principal/NotPrincipal value: either "*" (bare string) or a mapping of type → values.
   */
  #readPrincipalValue(pair: Node): Record<string, string[]> | string | null {
    const values = this.#readPairStringValues(pair);
    if (values.length === 1 && values[0] === '*') return '*';

    const mapping = this.#findValueBlockMapping(pair);
    if (!mapping) return null;

    const result: Record<string, string[]> = {};
    for (const child of mapping.namedChildren) {
      if (child.type !== 'block_mapping_pair') continue;
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
    const outerMapping = this.#findValueBlockMapping(pair);
    if (!outerMapping) return result;

    for (const operatorPair of outerMapping.namedChildren) {
      if (operatorPair.type !== 'block_mapping_pair') continue;
      const operator = this.#getPairKeyText(operatorPair);
      if (!operator) continue;

      const innerMapping = this.#findValueBlockMapping(operatorPair);
      if (!innerMapping) {
        result[operator] = {};
        continue;
      }

      const keys: Record<string, string[]> = {};
      for (const keyPair of innerMapping.namedChildren) {
        if (keyPair.type !== 'block_mapping_pair') continue;
        const conditionKey = this.#getPairKeyText(keyPair);
        if (conditionKey) keys[conditionKey] = this.#readPairStringValues(keyPair);
      }
      result[operator] = keys;
    }
    return result;
  }
}
