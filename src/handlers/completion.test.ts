import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { TextDocuments } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { loadCompletionTests } from '../../test-utils/test-cases/completion/index.ts';
import { TreeManager } from '../lib/treesitter/manager.ts';
import { handleCompletionRequest } from './completion/index.ts';

const textDocumentsStub = {} as unknown as TextDocuments<TextDocument>;

const categories = [
  'statement-key',
  'effect-value',
  'action-value',
  'resource-value',
  'principal-block',
  'principal-block-identifier',
  'principal-block-type',
  'principal-type',
  'principal-typed-value',
  'principal-value',
  'condition-block',
  'condition-key',
  'condition-operator',
];

describe('handleCompletionRequest', async () => {
  let treeManager: TreeManager;
  before(async () => {
    treeManager = new TreeManager();
  });

  for (const category of categories) {
    describe(category, async () => {
      const tests = loadCompletionTests(category);
      for (const testCase of tests) {
        it(`${testCase.category}/${testCase.filename}`, async () => {
          const uri = `test://${testCase.category}/${testCase.filename}`;
          await treeManager.openDocument(uri, testCase.doc, testCase.lang);
          const response = await handleCompletionRequest(
            { position: testCase.position, textDocument: { uri } },
            textDocumentsStub,
            treeManager,
          );
          const labels = response.items.map((item) => item.label);
          if (testCase.exact) {
            assert.deepEqual(labels.sort(), [...(testCase.includes ?? [])].sort());
          } else {
            if (testCase.includes) {
              const notFound = testCase.includes.filter((label) => !labels.includes(label));
              assert.deepEqual([], notFound, 'expected these labels');
            }
            if (testCase.excludes) {
              const found = testCase.excludes.filter((label) => labels.includes(label));
              assert.deepEqual([], found, 'did not expect these labels');
            }
          }
        });
      }
    });
  }
});
