import { type Hover, MarkupKind } from 'vscode-languageserver';
import { splitArn } from '../../lib/iam-policy/arn.ts';
import type { PrincipalBlockIdentifierLocation, PrincipalTypedValueLocation } from '../../lib/iam-policy/location.ts';
import {
  formatPrincipalTypedValueDocumentation,
  principalTypedValues,
} from '../../lib/iam-policy/reference/documentation.ts';
import { ServiceReference } from '../../lib/iam-policy/reference/services.ts';

export function handlePrincipalTypedValueHover(
  location: PrincipalTypedValueLocation | PrincipalBlockIdentifierLocation,
): Hover | null {
  if (location.value === '*') {
    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value: formatPrincipalTypedValueDocumentation(principalTypedValues['*']),
      },
    };
  }

  const principalType = location.principalType;

  if (principalType === 'Service') {
    const principals = ServiceReference.getServicePrincipals();
    if (principals.includes(location.value)) {
      return {
        range: location.range,
        contents: {
          kind: MarkupKind.Markdown,
          value: formatPrincipalTypedValueDocumentation(principalTypedValues.Service),
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
          value: formatPrincipalTypedValueDocumentation(principalTypedValues.Account),
        },
      };
    }

    if (location.value.startsWith('arn:')) {
      const parts = splitArn(location.value);
      const resource = parts.slice(5).join(':');
      if (resource.startsWith('root')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.Account),
          },
        };
      }
      if (resource.startsWith('role/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.Role),
          },
        };
      }
      if (resource.startsWith('user/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.User),
          },
        };
      }
      if (resource.startsWith('assumed-role/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.RoleSession),
          },
        };
      }
    }
  }

  if (principalType === 'Federated') {
    if (location.value.startsWith('arn:')) {
      const resource = splitArn(location.value).slice(5).join(':');
      if (resource.startsWith('oidc-provider/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.FederatedOidc),
          },
        };
      }
      if (resource.startsWith('saml-provider/')) {
        return {
          range: location.range,
          contents: {
            kind: MarkupKind.Markdown,
            value: formatPrincipalTypedValueDocumentation(principalTypedValues.FederatedSaml),
          },
        };
      }
    }

    return {
      range: location.range,
      contents: {
        kind: MarkupKind.Markdown,
        value: formatPrincipalTypedValueDocumentation(principalTypedValues.FederatedIdentity),
      },
    };
  }

  return null;
}
