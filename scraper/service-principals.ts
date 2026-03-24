import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const SERVICE_PRINCIPAL_ENDPOINT =
  'https://gist.githubusercontent.com/shortjared/4c1e3fe52bdfa47522cfe5b41e5d6f22/raw/31f1e65ee5ba37ced47ec599ad74220823c02218/list.txt';
const SERVICE_REF_DIR = join(DATA_DIR, 'servicereference');

export async function run() {
  if (!existsSync(SERVICE_REF_DIR)) mkdirSync(SERVICE_REF_DIR, { recursive: true });
  const servicePrincipalResponse = await fetch(SERVICE_PRINCIPAL_ENDPOINT).then((x) => x.text());
  const servicePrincipals = servicePrincipalResponse.split('\n');
  writeFileSync(join(SERVICE_REF_DIR, 'service-principals.json'), JSON.stringify(servicePrincipals));
}
