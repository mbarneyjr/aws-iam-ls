import { readFileSync } from 'node:fs';
import type { Action, ConditionKey, GlobalConditionKey, ServiceData } from './types.ts';

export class ServiceReference {
  static #serviceDataMap: Record<string, ServiceData> = {};
  static #allActions: Array<string>;
  static #allServices: Array<string>;
  static #servicePrincipals: Array<string>;
  static #globalConditionKeys: Array<GlobalConditionKey>;

  static getServiceData(service: string): ServiceData {
    if (!ServiceReference.#serviceDataMap[service]) {
      ServiceReference.#serviceDataMap[service] = JSON.parse(
        readFileSync(`${import.meta.dirname}/../../../data/servicereference/services/${service}.json`, 'utf-8'),
      );
    }
    return ServiceReference.#serviceDataMap[service];
  }

  static getServicePrincipals() {
    if (!ServiceReference.#servicePrincipals) {
      ServiceReference.#servicePrincipals = JSON.parse(
        readFileSync(`${import.meta.dirname}/../../../data/servicereference/service-principals.json`, 'utf-8'),
      );
    }
    return ServiceReference.#servicePrincipals;
  }

  static getAllActions(): Array<string> {
    if (!ServiceReference.#allActions) {
      ServiceReference.#allActions = JSON.parse(
        readFileSync(`${import.meta.dirname}/../../../data/servicereference/actions.json`, 'utf-8'),
      );
    }
    return ServiceReference.#allActions;
  }

  static getAllServices(): Array<string> {
    if (!ServiceReference.#allServices) {
      ServiceReference.#allServices = JSON.parse(
        readFileSync(`${import.meta.dirname}/../../../data/servicereference/services.json`, 'utf-8'),
      );
    }
    return ServiceReference.#allServices;
  }

  static getActionsForService(service: string): Array<string> {
    return Object.keys(ServiceReference.getServiceData(service).actions);
  }

  static getConditionKeysForActions(actions: string[]): Array<{ name: string; types: string[] }> {
    const keys = new Map<string, string[]>();
    for (const action of actions) {
      const [service, actionName] = action.split(':');
      const serviceData = ServiceReference.getServiceData(service);
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
      ServiceReference.#globalConditionKeys = JSON.parse(
        readFileSync(`${import.meta.dirname}/../../../data/condition-keys/global.json`, 'utf-8'),
      );
    }
    return ServiceReference.#globalConditionKeys;
  }

  static getAction(service: string, actionName: string): Action | undefined {
    try {
      return ServiceReference.getServiceData(service).actions[actionName];
    } catch {
      return undefined;
    }
  }

  static getConditionKey(service: string, keyName: string): ConditionKey | undefined {
    try {
      return ServiceReference.getServiceData(service).conditionKeys[keyName];
    } catch {
      return undefined;
    }
  }

  static getArnsForActions(actions: string[]): Array<string> {
    const arns = new Set<string>();
    for (const action of actions) {
      const [service, actionName] = action.split(':');
      const serviceData = ServiceReference.getServiceData(service);
      const actionDef = serviceData.actions[actionName];
      if (!actionDef?.resources) continue;
      for (const actionResource of actionDef.resources) {
        const resourceDef = serviceData.resources.find((r) => r.name === actionResource.name);
        if (resourceDef) {
          for (const arn of resourceDef.arnFormats) {
            arns.add(arn);
          }
        }
      }
    }
    return [...arns].sort();
  }

  static getArnsForService(service: string): Array<string> {
    const arns = [];
    for (const resource of ServiceReference.getServiceData(service).resources) {
      for (const arnFormat of resource.arnFormats) {
        arns.push(arnFormat);
      }
    }
    return arns;
  }
}
