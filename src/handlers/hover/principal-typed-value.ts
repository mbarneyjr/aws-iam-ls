import { type Hover, MarkupKind } from 'vscode-languageserver';
import type {
  PrincipalBlockIdentifierLocation,
  PrincipalTypedValueLocation,
} from '../../lib/iam-policy/location.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';

export function handlePrincipalTypedValueHover(
  location: PrincipalTypedValueLocation | PrincipalBlockIdentifierLocation,
): Hover | null {
  if (location.value === '*') {
    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value: '**All principals** of this type.',
      },
    };
  }

  const principalType = location.principalType;

  if (principalType === 'Service') {
    const principals = ServiceReference.getServicePrincipals();
    if (principals.includes(location.value)) {
      const serviceName = location.value.split('.')[0];
      return {
        range: location.range,
        contents: {
          kind: MarkupKind.Markdown,
          value: `**AWS service principal**\n\n\`${location.value}\` — allows the \`${serviceName}\` service to assume this role or access this resource.`,
        },
      };
    }
  }

  if (principalType === 'AWS') {
    if (/^\d{12}$/.test(location.value)) {
      return {
        range: location.range,
        contents: {
          kind: MarkupKind.Markdown,
          value: `**AWS account**\n\nGrants access to the root user and all IAM identities in account \`${location.value}\`.`,
        },
      };
    }

    if (location.value.startsWith('arn:')) {
      const parts = location.value.split(':');
      const resource = parts.slice(5).join(':');
      if (resource.startsWith('root')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**AWS account root user**\n\nGrants access to the root user of this account. Equivalent to specifying the account ID.`,
          },
        };
      }
      if (resource.startsWith('role/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**IAM role**\n\n\`${resource}\`\n\nAny identity that assumes this role will have the permissions granted by this statement.`,
          },
        };
      }
      if (resource.startsWith('user/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**IAM user**\n\n\`${resource}\``,
          },
        };
      }
      if (resource.startsWith('assumed-role/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**Assumed role session**\n\n\`${resource}\``,
          },
        };
      }
    }
  }

  if (principalType === 'Federated') {
    if (location.value.startsWith('arn:')) {
      const resource = location.value.split(':').slice(5).join(':');
      if (resource.startsWith('oidc-provider/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**OIDC identity provider**\n\n\`${resource}\``,
          },
        };
      }
      if (resource.startsWith('saml-provider/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: `**SAML identity provider**\n\n\`${resource}\``,
          },
        };
      }
    }

    const knownProviders: Record<string, string> = {
      'cognito-identity.amazonaws.com': 'Amazon Cognito identity pool',
      'www.amazon.com': 'Login with Amazon',
      'accounts.google.com': 'Google',
      'graph.facebook.com': 'Facebook',
    };
    const description = knownProviders[location.value];
    if (description) {
      return {
        range: location.range,
        contents: {
          kind: MarkupKind.Markdown,
          value: `**Federated identity provider**\n\n${description}`,
        },
      };
    }
  }

  return null;
}
