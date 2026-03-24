import { ServiceReference } from './reference/services.ts';

export const principalTypes = {
  aws: {
    value: 'AWS',
    description: 'An AWS account root user, IAM user, or IAM role.',
    patterns: [
      `*`,
      `\${Account}`,
      `arn:\${Partition}:iam::\${Account}:root`,
      `arn:\${Partition}:iam::\${Account}:role/\${RoleName}`,
      `arn:\${Partition}:sts::\${Account}:assumed-role/\${RoleName}/\${RoleSessionName}`,
      `arn:\${Partition}:iam::\${Account}:user/\${UserName}`,
      `arn:\${Partition}:iam::\${Account}:federated-user/\${UserName}`,
    ],
  },
  canonicalUser: {
    value: 'CanonicalUser',
    description: 'An Amazon S3 canonical user ID.',
  },
  federated: {
    value: 'Federated',
    description: 'A SAML provider or an OpenID Connect provider.',
    patterns: [
      'cognito-identity.amazonaws.com',
      'www.amazon.com',
      'graph.facebook.com',
      'accounts.google.com',
      `arn:\${Partition}:iam::\${Account}:oidc-provider/\${OidcProviderUrl}`,
      `arn:\${Partition}:iam::\${Account}:saml-provider/\${SamlProviderName}`,
    ],
  },
  service: {
    value: 'Service',
    description: 'An AWS service principal.',
    patterns: ServiceReference.getServicePrincipals(),
  },
} as const;
