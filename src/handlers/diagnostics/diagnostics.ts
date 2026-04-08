import type { Connection, Diagnostic } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { PolicyDocumentNode } from '../../lib/treesitter/base.ts';
import type { TreeManager } from '../../lib/treesitter/manager.ts';
import { ActionValidator } from './action.ts';
import { ConditionValidator } from './condition.ts';
import { EffectValidator } from './effect.ts';
import { PrincipalValidator } from './principal.ts';
import { ResourceValidator } from './resource.ts';
import { SidValidator } from './sid.ts';
import { createDiagnostic } from './utils.ts';

export async function diagnosticsHandler(document: TextDocument, treeManager: TreeManager, connection: Connection) {
  const handler = treeManager.getLanguageHandler(document.uri);
  if (!handler) return;

  let diagnostics: Array<Diagnostic> = [];
  const policyDocuments = handler.getAllPolicyDocuments(document.uri);
  for (const policyDocument of policyDocuments) {
    if (policyDocument.policyFormat === 'standard') {
      diagnostics = diagnostics.concat(await handleStandardDiagnostics(policyDocument));
    } else if (policyDocument.policyFormat === 'hcl-block') {
      diagnostics = diagnostics.concat(await handleHclBlockDiagnostics(policyDocument));
    }
  }
  connection.console.log(
    `Publishing diagnostics for uri: ${document.uri}: ${policyDocuments.length} policy documents, ${diagnostics.length} diagnostics`,
  );
  await connection.sendDiagnostics({
    uri: document.uri,
    diagnostics,
  });
}

async function handleStandardDiagnostics(policyDocument: PolicyDocumentNode): Promise<Array<Diagnostic>> {
  let diagnostics: Array<Diagnostic> = [];
  const sidValidator = new SidValidator();
  const effectValidator = new EffectValidator();
  const principalValidator = new PrincipalValidator();
  const actionValidator = new ActionValidator();
  const resourceValidator = new ResourceValidator();
  const conditionValidator = new ConditionValidator();
  for (const statement of policyDocument.statements) {
    const isResourcePolicy = statement.entries.some((e) => e.key === 'Principal' || e.key === 'NotPrincipal');
    for (const entry of statement.entries) {
      if (entry.key === 'Sid') {
        diagnostics = diagnostics.concat(sidValidator.validate(entry, isResourcePolicy));
      } else if (entry.key === 'Effect') {
        diagnostics = diagnostics.concat(effectValidator.validate(entry));
      } else if (entry.key === 'Principal' || entry.key === 'NotPrincipal') {
        diagnostics = diagnostics.concat(principalValidator.validate(entry));
      } else if (entry.key === 'Action' || entry.key === 'NotAction') {
        diagnostics = diagnostics.concat(actionValidator.validate(entry));
      } else if (entry.key === 'Resource' || entry.key === 'NotResource') {
        diagnostics = diagnostics.concat(resourceValidator.validate(entry));
      } else if (entry.key === 'Condition') {
        diagnostics = diagnostics.concat(conditionValidator.validate(entry));
      } else {
        diagnostics.push(createDiagnostic(`Unrecognized entry "${entry.key}" in statement`, entry.keyRange));
      }
    }

    if (!effectValidator.isValidated()) {
      diagnostics.push(createDiagnostic(`Missing required "Effect" entry in statement`, statement.range));
    }
    if (!actionValidator.isValidated()) {
      diagnostics.push(
        createDiagnostic(`Missing required "Action" or "NotAction" entry in statement`, statement.range),
      );
    }
    if (!resourceValidator.isValidated() && !principalValidator.isValidated()) {
      diagnostics.push(
        createDiagnostic(
          `Missing required "Resource"/"NotResource" or "Principal"/"NotPrincipal" entry in statement`,
          statement.range,
        ),
      );
    }
    [sidValidator, effectValidator, principalValidator, actionValidator, resourceValidator, conditionValidator].forEach(
      (x) => {
        x.resetForStatement();
      },
    );
  }
  return diagnostics;
}

async function handleHclBlockDiagnostics(policyDocument: PolicyDocumentNode): Promise<Array<Diagnostic>> {
  let diagnostics: Array<Diagnostic> = [];
  const sidValidator = new SidValidator();
  const effectValidator = new EffectValidator();
  const principalValidator = new PrincipalValidator();
  const actionValidator = new ActionValidator();
  const resourceValidator = new ResourceValidator();
  const conditionValidator = new ConditionValidator();
  for (const statement of policyDocument.statements) {
    const isResourcePolicy = statement.entries.some((e) => e.key === 'principals' || e.key === 'not_principals');
    for (const entry of statement.entries) {
      if (entry.key === 'sid') {
        diagnostics = diagnostics.concat(sidValidator.validate(entry, isResourcePolicy));
      } else if (entry.key === 'effect') {
        diagnostics = diagnostics.concat(effectValidator.validate(entry));
      } else if (entry.key === 'principals' || entry.key === 'not_principals') {
        diagnostics = diagnostics.concat(principalValidator.validate(entry));
      } else if (entry.key === 'actions' || entry.key === 'not_actions') {
        diagnostics = diagnostics.concat(actionValidator.validate(entry));
      } else if (entry.key === 'resources' || entry.key === 'not_resources') {
        diagnostics = diagnostics.concat(resourceValidator.validate(entry));
      } else if (entry.key === 'condition') {
        diagnostics = diagnostics.concat(conditionValidator.validate(entry));
      } else {
        diagnostics.push(createDiagnostic(`Unrecognized entry "${entry.key}" in statement`, entry.keyRange));
      }
    }

    if (!effectValidator.isValidated()) {
      diagnostics.push(createDiagnostic(`Missing required "effect" entry in statement`, statement.range));
    }
    if (!actionValidator.isValidated()) {
      diagnostics.push(
        createDiagnostic(`Missing required "actions" or "not_actions" entry in statement`, statement.range),
      );
    }
    if (!resourceValidator.isValidated() && !principalValidator.isValidated()) {
      diagnostics.push(
        createDiagnostic(
          `Missing required "resources"/"not_resources" or "principals"/"not_principals" entry in statement`,
          statement.range,
        ),
      );
    }
    [sidValidator, effectValidator, principalValidator, actionValidator, resourceValidator, conditionValidator].forEach(
      (x) => {
        x.resetForStatement();
      },
    );
  }
  return diagnostics;
}
