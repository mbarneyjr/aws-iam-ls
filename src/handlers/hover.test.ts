import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { Connection } from 'vscode-languageserver';
import { loadHoverTests } from '../../test-utils/test-cases/hover/index.ts';
import { TreeManager } from '../lib/treesitter/manager.ts';
import { hoverHandler } from './hover/index.ts';

const categories = [
  'statement-key',
  'statement-block',
  'effect-value',
  'action-value',
  'resource-value',
  'principal-value',
  'principal-type',
  'principal-typed-value',
  'principal-block',
  'principal-block-type',
  'principal-block-identifier',
  'condition-block',
  'condition-operator',
  'condition-key',
];

describe('hoverHandler', async () => {
  let treeManager: TreeManager;
  const connection = {
    console: {
      log: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as Connection;
  before(async () => {
    treeManager = new TreeManager(connection);
  });

  for (const category of categories) {
    describe(category, async () => {
      const tests = loadHoverTests(category);
      for (const testCase of tests) {
        it(`${testCase.category}/${testCase.filename}`, async () => {
          const uri = `test://${testCase.category}/${testCase.filename}`;
          await treeManager.openDocument(uri, testCase.doc, testCase.lang);
          const result = hoverHandler(
            { position: testCase.position, textDocument: { uri } },
            treeManager,
            connection,
          );
          if (testCase.isNull) {
            assert.equal(result, null, 'expected no hover result');
            return;
          }
          assert.notEqual(result, null, 'expected a hover result');
          const content =
            typeof result!.contents === 'string'
              ? result!.contents
              : 'value' in result!.contents
                ? result!.contents.value
                : '';
          if (testCase.includes) {
            for (const substring of testCase.includes) {
              assert.ok(content.includes(substring), `expected hover to contain "${substring}"`);
            }
          }
        });
      }
    });
  }
});
