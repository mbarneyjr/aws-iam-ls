import { type Hover, MarkupKind } from 'vscode-languageserver';
import type { ConditionKeyLocation } from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';
import type { GlobalConditionKey } from '../../lib/iam-policy/reference/types.ts';
import { formatConditionKeyDocumentation } from '../completion/condition-key.ts';

const placeholderPattern = /\$\{[^}]+\}/g;

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withPlaceholders = escaped.replace(/\\\$\\\{[^}]+\\\}/g, '.+');
  return new RegExp(`^${withPlaceholders}$`);
}

function findByPattern(keyName: string, globals: GlobalConditionKey[], service: string | undefined) {
  for (const global of globals) {
    if (placeholderPattern.test(global.name) && patternToRegex(global.name).test(keyName)) {
      const conditionKey = service ? ServiceReference.getConditionKey(service, global.name) : undefined;
      return { global, conditionKey };
    }
  }

  if (service) {
    const serviceData = ServiceReference.getServiceData(service);
    if (serviceData) {
      for (const name of Object.keys(serviceData.conditionKeys)) {
        if (placeholderPattern.test(name) && patternToRegex(name).test(keyName)) {
          return { conditionKey: serviceData.conditionKeys[name] };
        }
      }
    }
  }

  return null;
}

export function handleConditionKeyHover(location: ConditionKeyLocation): Hover | null {
  const keyName = location.value;
  if (!keyName) return null;

  const globalKeys = ServiceReference.getGlobalConditionKeys();
  const service = keyName.split(':')[0];

  let global = globalKeys.find((k) => k.name === keyName);
  let conditionKey = service ? ServiceReference.getConditionKey(service, keyName) : undefined;
  if (!global && !conditionKey) {
    const match = findByPattern(keyName, globalKeys, service);
    if (!match) return null;
    global = match.global;
    conditionKey = match.conditionKey;
  }

  const types = conditionKey?.types ?? [];
  const docs = formatConditionKeyDocumentation(types, global, conditionKey);

  return {
    range: location.range,
    contents: {
      kind: MarkupKind.Markdown,
      value: `**${keyName}**\n\n${docs}`,
    },
  };
}
