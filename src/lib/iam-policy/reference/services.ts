import { readFileSync } from 'node:fs';
import { type ArnParts, arnMatches, parseArn } from '../arn.ts';
import type { Action, ConditionKey, GlobalConditionKey, ResourceDef, ServiceData } from './types.ts';

export class ServiceReference {
  static #serviceDataMap: Record<string, ServiceData> = {};
  static #allActions: Array<string>;
  static #allServices: Array<string>;
  static #servicePrincipals: Array<string>;
  static #globalConditionKeys: Array<GlobalConditionKey>;

  static getServiceData(service: string): ServiceData | undefined {
    if (!ServiceReference.#serviceDataMap[service]) {
      try {
        ServiceReference.#serviceDataMap[service] = JSON.parse(
          readFileSync(`${import.meta.dirname}/../../../data/servicereference/services/${service}.json`, 'utf-8'),
        );
      } catch {
        return undefined;
      }
    }
    return ServiceReference.#serviceDataMap[service];
  }

  static getServicePrincipals(): Array<string> {
    if (!ServiceReference.#servicePrincipals) {
      try {
        ServiceReference.#servicePrincipals = JSON.parse(
          readFileSync(`${import.meta.dirname}/../../../data/servicereference/service-principals.json`, 'utf-8'),
        );
      } catch {
        return [];
      }
    }
    return ServiceReference.#servicePrincipals;
  }

  static getAllActions(): Array<string> {
    if (!ServiceReference.#allActions) {
      try {
        ServiceReference.#allActions = JSON.parse(
          readFileSync(`${import.meta.dirname}/../../../data/servicereference/actions.json`, 'utf-8'),
        );
      } catch {
        return [];
      }
    }
    return ServiceReference.#allActions;
  }

  static getAllServices(): Array<string> {
    if (!ServiceReference.#allServices) {
      try {
        ServiceReference.#allServices = JSON.parse(
          readFileSync(`${import.meta.dirname}/../../../data/servicereference/services.json`, 'utf-8'),
        );
      } catch {
        return [];
      }
    }
    return ServiceReference.#allServices;
  }

  static getActionsForService(service: string): Array<Action> {
    const serviceData = ServiceReference.getServiceData(service);
    if (!serviceData) return [];
    return Object.entries(serviceData.actions).map(([actionName, action]) => {
      if (!action.name) action.name = `${service}:${actionName}`;
      return action;
    });
  }

  static getConditionKeysForActions(actions: string[]): Array<{ name: string; types: string[] }> {
    const keys = new Map<string, string[]>();
    for (const action of actions) {
      const [service, actionName] = action.split(':');
      const serviceData = ServiceReference.getServiceData(service);
      if (!serviceData) continue;
      const actionDef = serviceData.actions[actionName];
      if (actionDef?.conditionKeys) {
        for (const keyName of actionDef.conditionKeys) {
          if (!keys.has(keyName)) {
            const keyDef = serviceData.conditionKeys[keyName];
            keys.set(keyName, keyDef?.types ?? []);
          }
        }
      }
    }
    const sorted = [...keys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([name, types]) => ({ name, types }));
  }

  static getGlobalConditionKeys(): Array<GlobalConditionKey> {
    if (!ServiceReference.#globalConditionKeys) {
      try {
        ServiceReference.#globalConditionKeys = JSON.parse(
          readFileSync(`${import.meta.dirname}/../../../data/condition-keys/global.json`, 'utf-8'),
        );
      } catch {
        return [];
      }
    }
    return ServiceReference.#globalConditionKeys;
  }

  static getAction(action: string): Action | undefined {
    const serviceName = action.split(':')[0];
    const actionName = action.split(':')[1];
    return ServiceReference.getServiceData(serviceName)?.actions[actionName];
  }

  static getConditionKey(service: string, keyName: string): ConditionKey | undefined {
    return ServiceReference.getServiceData(service)?.conditionKeys[keyName];
  }

  static getResources(arn: ArnParts): ResourceDef[] {
    const serviceData = ServiceReference.getServiceData(arn.service);
    if (!serviceData) return [];
    const matches: ResourceDef[] = [];
    for (const resource of serviceData.resources) {
      for (const format of resource.arnFormats) {
        const templateArn = parseArn(format);
        if (templateArn && arnMatches(arn, templateArn)) {
          matches.push(resource);
          break;
        }
      }
    }
    return matches;
  }

  static getResourcesForActions(actions: string[]) {
    const resources = new Map<string, { service: string; name: string; arn: string; conditionKeys: Array<string> }>();
    for (const action of actions) {
      const [service, actionName] = action.split(':');
      const serviceData = ServiceReference.getServiceData(service);
      if (!serviceData) continue;
      const actionDef = serviceData.actions[actionName];
      if (!actionDef?.resources) continue;
      for (const actionResource of actionDef.resources) {
        const resourceDef = serviceData.resources.find((r) => r.name === actionResource.name);
        if (resourceDef) {
          for (const arn of resourceDef.arnFormats) {
            resources.set(arn, {
              service,
              name: resourceDef.name,
              arn,
              conditionKeys: resourceDef.conditionKeys,
            });
          }
        }
      }
    }
    return resources;
  }
}
