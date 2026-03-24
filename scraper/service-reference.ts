import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawReference, ServiceData, Services } from '../src/lib/iam-policy/reference/types.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const AWS_SERVICEREFERENCE_ENDPOINT = 'https://servicereference.us-east-1.amazonaws.com';
const SERVICE_REF_DIR = join(DATA_DIR, 'servicereference');
const SERVICES_DIR = join(SERVICE_REF_DIR, 'services');

export async function run() {
  if (!existsSync(SERVICES_DIR)) mkdirSync(SERVICES_DIR, { recursive: true });

  const references: Services = await fetch(AWS_SERVICEREFERENCE_ENDPOINT).then((x) => x.json());
  let processed = 0;

  const actions: Array<string> = [];
  const services: Array<string> = [];

  for (const reference of references) {
    const raw: RawReference = await fetch(reference.url).then((x) => x.json());

    const serviceData: ServiceData = {
      name: raw.Name,
      actions: {},
      resources: (raw.Resources ?? []).map((r) => ({
        name: r.Name,
        arnFormats: r.ARNFormats,
        conditionKeys: r.ConditionKeys ?? [],
      })),
      conditionKeys: {},
    };

    for (const action of raw.Actions) {
      actions.push(`${reference.service}:${action.Name}`);
      serviceData.actions[action.Name] = {
        conditionKeys: action.ActionConditionKeys ?? [],
        resources: (action.Resources ?? []).map((r) => ({ name: r.Name })),
      };
    }

    for (const key of raw.ConditionKeys ?? []) {
      serviceData.conditionKeys[key.Name] = {
        types: key.Types,
      };
    }

    services.push(reference.service);

    writeFileSync(join(SERVICES_DIR, `${reference.service}.json`), JSON.stringify(serviceData));
    processed++;
    process.stdout.write(`Processed ${processed} services\r`);
  }
  writeFileSync(join(SERVICE_REF_DIR, 'actions.json'), JSON.stringify(actions));
  writeFileSync(join(SERVICE_REF_DIR, 'services.json'), JSON.stringify(services));
  console.log(`Processed ${processed} services`);
}
