import * as globalConditionKeys from './global-condition-keys.ts';
import * as serviceDocs from './service-docs.ts';
import * as servicePrincipals from './service-principals.ts';
import * as serviceReference from './service-reference.ts';

await serviceReference.run();
await globalConditionKeys.run();
await serviceDocs.run();
await servicePrincipals.run();
