import type { CursorContext } from '../treesitter/base.ts';

export type StatementKeyLocation = { type: 'statement-key'; partial: string };
export type StatementBlockLocation = { type: 'statement-block'; partial: string };
export type EffectValueLocation = { type: 'effect-value'; partial: string };
export type ActionValueLocation = { type: 'action-value'; partial: string };
export type ResourceValueLocation = { type: 'resource-value'; partial: string };
export type PrincipalValueLocation = { type: 'principal-value'; partial: string };
export type PrincipalTypeLocation = { type: 'principal-type'; partial: string };
export type PrincipalBlockLocation = { type: 'principal-block'; partial: string };
export type PrincipalBlockTypeLocation = { type: 'principal-block-type'; partial: string };
export type PrincipalBlockIdentifierLocation = {
  type: 'principal-block-identifier';
  principalType: string | null;
  partial: string;
};
export type PrincipalTypedValueLocation = { type: 'principal-typed-value'; principalType: string; partial: string };
export type ConditionBlockLocation = { type: 'condition-block'; partial: string };
export type ConditionOperatorLocation = { type: 'condition-operator'; partial: string };
export type ConditionKeyLocation = { type: 'condition-key'; operator: string; partial: string };
export type ConditionValueLocation = { type: 'condition-value'; operator: string; key: string; partial: string };
export type UnknownLocation = { type: 'unknown' };

export type PolicyLocation =
  | StatementKeyLocation
  | StatementBlockLocation
  | EffectValueLocation
  | ActionValueLocation
  | ResourceValueLocation
  | PrincipalValueLocation
  | PrincipalTypeLocation
  | PrincipalBlockLocation
  | PrincipalBlockTypeLocation
  | PrincipalBlockIdentifierLocation
  | PrincipalTypedValueLocation
  | ConditionBlockLocation
  | ConditionOperatorLocation
  | ConditionKeyLocation
  | ConditionValueLocation
  | UnknownLocation;

const snakeToPascal: Record<string, string> = {
  sid: 'Sid',
  effect: 'Effect',
  principals: 'Principal',
  not_principals: 'NotPrincipal',
  actions: 'Action',
  not_actions: 'NotAction',
  resources: 'Resource',
  not_resources: 'NotResource',
  condition: 'Condition',
};

const cfnIntrinsicPattern = /^(Fn::|Ref$)/;

export function resolvePolicyLocation(context: CursorContext): PolicyLocation {
  const isHclBlock = context.policyFormat === 'hcl-block';
  const keys = context.keys.filter((key) => !cfnIntrinsicPattern.test(key));
  const statementKey = isHclBlock ? (snakeToPascal[keys[0]] ?? keys[0]) : keys[0];

  if (keys.length === 0 && context.role === 'key') {
    if (isHclBlock) return { type: 'statement-block', partial: context.partial };
    return { type: 'statement-key', partial: context.partial };
  }

  if (keys.length === 1 && context.role === 'value') {
    if (statementKey === 'Effect') return { type: 'effect-value', partial: context.partial };
    if (statementKey === 'Action' || statementKey === 'NotAction')
      return { type: 'action-value', partial: context.partial };
    if (statementKey === 'Resource' || statementKey === 'NotResource')
      return { type: 'resource-value', partial: context.partial };
    if (statementKey === 'Principal' || statementKey === 'NotPrincipal')
      return { type: 'principal-value', partial: context.partial };
    if (statementKey === 'Condition') return { type: 'condition-operator', partial: context.partial };
  }

  if (keys.length === 1 && context.role === 'key') {
    if (statementKey === 'Principal' || statementKey === 'NotPrincipal') {
      if (isHclBlock) {
        return { type: 'principal-block', partial: context.partial };
      }
      return { type: 'principal-type', partial: context.partial };
    }
    if (statementKey === 'Condition') {
      if (isHclBlock) return { type: 'condition-block', partial: context.partial };
      return { type: 'condition-operator', partial: context.partial };
    }
  }

  if ((keys.length === 2 || keys.length === 3) && context.role === 'value') {
    if (statementKey === 'Principal' || statementKey === 'NotPrincipal') {
      if (isHclBlock && keys[1] === 'type') {
        return { type: 'principal-block-type', partial: context.partial };
      }
      if (isHclBlock && keys[1] === 'identifiers') {
        return { type: 'principal-block-identifier', principalType: keys[2] ?? null, partial: context.partial };
      }
      if (keys.length === 2) {
        return { type: 'principal-typed-value', principalType: keys[1], partial: context.partial };
      }
    }
  }

  if (keys.length === 2 && context.role === 'value') {
    if (statementKey === 'Condition' && isHclBlock && keys[1] === 'test') {
      return { type: 'condition-operator', partial: context.partial };
    }
    if (statementKey === 'Condition' && isHclBlock && keys[1] === 'variable') {
      return { type: 'condition-key', operator: '', partial: context.partial };
    }
    if (statementKey === 'Condition' && !isHclBlock) {
      return { type: 'condition-key', operator: keys[1], partial: context.partial };
    }
  }

  if (keys.length === 2 && context.role === 'key') {
    if (statementKey === 'Condition') {
      return { type: 'condition-key', operator: keys[1], partial: context.partial };
    }
  }

  if (keys.length === 3 && context.role === 'value') {
    if (statementKey === 'Condition') {
      return { type: 'condition-value', operator: keys[1], key: keys[2], partial: context.partial };
    }
  }

  return { type: 'unknown' };
}
