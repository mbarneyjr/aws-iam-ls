type PolicyElement = {
  policyTypes: Array<'identity' | 'resource'>;
  description: string;
  group: string;
  hclKey: string;
};

export const StatementKeys: Record<string, PolicyElement> = {
  Sid: {
    policyTypes: ['identity', 'resource'],
    description: `# Sid

An optional identifier for a policy statement.
Use it as a descriptive label to distinguish statements within a policy.

The \`Sid\` value must be unique within a policy document.
It may only contain ASCII uppercase letters (A-Z), lowercase letters (a-z), and numbers (0-9).

In services that support an \`Id\` element (such as SQS and SNS), the \`Sid\` serves as a sub-ID of the policy document's \`Id\`.
These services may require \`Sid\` and enforce additional uniqueness constraints — consult the service-specific documentation.

> **Note:** The IAM API does not expose the \`Sid\`.
> You cannot retrieve a specific statement by its ID.`,
    hclKey: 'sid',
    group: 'sid',
  },
  Effect: {
    policyTypes: ['identity', 'resource'],
    description: `# Effect

A required element that specifies whether the statement allows or explicitly denies access.
Valid values are \`Allow\` and \`Deny\` (case-sensitive).

By default, access to resources is implicitly denied.
Set \`Effect\` to \`Allow\` to grant access.
Set \`Effect\` to \`Deny\` to explicitly deny access — an explicit deny always overrides any allow.`,
    hclKey: 'effect',
    group: 'effect',
  },
  Principal: {
    policyTypes: ['resource'],
    description: `# Principal

Specifies the principal that is allowed or denied access to a resource.
Required in resource-based policies (e.g. S3 bucket policies, KMS key policies, role trust policies).
Cannot be used in identity-based policies — the principal is implicitly the identity the policy is attached to.

The value can be an AWS account, IAM user, IAM role, federated identity, AWS service, or canonical user:

- **AWS account** — \`{ "AWS": "arn:aws:iam::123456789012:root" }\` or \`{ "AWS": "123456789012" }\`
- **IAM role** — \`{ "AWS": "arn:aws:iam::123456789012:role/role-name" }\`
- **IAM user** — \`{ "AWS": "arn:aws:iam::123456789012:user/user-name" }\`
- **AWS service** — \`{ "Service": "ecs.amazonaws.com" }\`
- **Federated (OIDC/SAML)** — \`{ "Federated": "cognito-identity.amazonaws.com" }\` or a SAML provider ARN
- **Canonical user** — \`{ "CanonicalUser": "64-char-hex-id" }\` (S3-specific, equivalent to an account ID)
- **All principals** — \`"*"\` or \`{ "AWS": "*" }\`

Use arrays to specify multiple principals of the same type.
Multiple principals are evaluated as a logical OR.

> **Warning:** Using \`"Principal": "*"\` with \`"Effect": "Allow"\` grants public access.
> Always scope with a \`Condition\` element unless public access is intended.

> **Note:** IAM resolves role and user ARNs in trust policies to unique principal IDs.
> If you delete and recreate the role or user, the trust relationship breaks.
> Use the \`aws:PrincipalArn\` condition key to avoid this.`,
    group: 'principal',
    hclKey: 'principals',
  },
  NotPrincipal: {
    policyTypes: ['resource'],
    description: `# NotPrincipal

Matches every principal *except* the ones specified.
Must be used with \`"Effect": "Deny"\` — using it with \`"Effect": "Allow"\` is not supported.
Only valid in resource-based policies; not supported in identity-based policies, role trust policies, SCPs, or RCPs.

When specifying an IAM user or role, you must also include the account ARN.
Otherwise the policy may deny access to the entire account.

> **Warning:** Do not use \`NotPrincipal\` with \`Deny\` for principals that have a permissions boundary attached.
> The \`NotPrincipal\` element will always deny those principals regardless of the values specified.

> **Recommended alternative:** Use \`"Principal": "*"\` with a \`Condition\` using \`ArnNotEquals\` on \`aws:PrincipalArn\` (or \`StringNotEquals\` on \`aws:PrincipalServiceName\` for services).
> AWS does not recommend \`NotPrincipal\` for new resource-based policies due to the difficulty of troubleshooting interactions across multiple policy types.`,
    group: 'principal',
    hclKey: 'not_principals',
  },
  Action: {
    policyTypes: ['identity', 'resource'],
    description: `# Action

Specifies the actions that the statement allows or denies.
Each statement must include either \`Action\` or \`NotAction\`.

Actions use the format \`service:action\` (e.g. \`s3:GetObject\`, \`iam:CreateUser\`).
Action names are case-insensitive.
Use an array to specify multiple actions.

Wildcards are supported:
- \`*\` matches any combination of characters (e.g. \`s3:*\` for all S3 actions, \`iam:*AccessKey*\` for all access key actions)
- \`?\` matches any single character`,
    group: 'action',
    hclKey: 'actions',
  },
  NotAction: {
    policyTypes: ['identity', 'resource'],
    description: `# NotAction

Matches every action *except* the ones specified.
Each statement must include either \`Action\` or \`NotAction\`.

With \`"Effect": "Allow"\`, grants access to all applicable actions except those listed.
With \`"Effect": "Deny"\`, denies all applicable actions except those listed.
The \`Resource\` element determines which actions and services are applicable.

> **Warning:** \`NotAction\` with \`"Effect": "Allow"\` can grant more permissions than intended, since it allows all actions not explicitly excluded — including actions in other services.
> Prefer using \`NotAction\` with \`"Effect": "Deny"\` to restrict access while still requiring explicit allows elsewhere.`,
    group: 'action',
    hclKey: 'not_actions',
  },
  Resource: {
    policyTypes: ['identity', 'resource'],
    description: `# Resource

Specifies the object or objects that the statement applies to.
Each statement must include either \`Resource\` or \`NotResource\`.

Resources are identified by ARN (e.g. \`arn:aws:s3:::my-bucket/*\`).
The ARN format varies by service — consult the service documentation for the correct format.
Use an array to specify multiple resources.

Wildcards are supported within ARNs:

- \`*\` matches any combination of characters, including \`/\`
- \`?\` matches any single character
- Wildcards cannot be used in the service segment of an ARN

Some actions do not support resource-level permissions.
In those cases, use \`"Resource": "*"\` to apply the statement to all resources.

Policy variables (e.g. \`\${aws:username}\`) can be used in the resource-specific portion of the ARN.`,
    group: 'resource',
    hclKey: 'resources',
  },
  NotResource: {
    policyTypes: ['identity', 'resource'],
    description: `# NotResource

Matches every resource *except* the ones specified.
Each statement must include either \`Resource\` or \`NotResource\`.

With \`"Effect": "Deny"\`, denies access to all resources except those listed.
With \`"Effect": "Allow"\`, grants access to all resources except those listed.

> **Warning:** \`NotResource\` with \`"Effect": "Allow"\` can grant far more permissions than intended — including actions across other services and resources.
> Never combine \`"Effect": "Allow"\`, \`"Action": "*"\`, and \`NotResource\`, as this grants access to nearly everything in the account.
> Prefer using \`NotResource\` with \`"Effect": "Deny"\`.`,
    group: 'resource',
    hclKey: 'not_resources',
  },
  Condition: {
    policyTypes: ['identity', 'resource'],
    description: `# Condition

An optional element that specifies conditions under which the statement is in effect.

The structure is \`{ "Operator": { "ConditionKey": "Value" } }\`:
- **Condition operator** — the type of comparison (e.g. \`StringEquals\`, \`ArnLike\`, \`IpAddress\`, \`NumericLessThan\`, \`Bool\`, \`Null\`)
- **Condition key** — a value from the request context to evaluate (e.g. \`aws:SourceIp\`, \`s3:prefix\`, \`aws:PrincipalArn\`)
- **Condition value** — the value to compare against

Condition keys are either **global** (prefixed with \`aws:\`, available across all services) or **service-specific** (prefixed with the service namespace).
Condition key names are case-insensitive; values are case-sensitive unless using a case-insensitive operator like \`StringEqualsIgnoreCase\`.

When multiple values are specified for a single key, they are evaluated as **OR**.
When multiple keys or operators are specified, they are evaluated as **AND**.

If a condition key is not present in the request context, it does not match — except when using \`ForAllValues\`, which may return true for a missing key.
Use the \`Null\` condition operator to explicitly check whether a key exists.`,
    hclKey: 'condition',
    group: 'condition',
  },
};
