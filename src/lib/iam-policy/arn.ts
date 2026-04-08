export type ArnParts = {
  partition: string;
  service: string;
  region: string;
  account: string;
  resource: string;
};

/**
 * Parse an ARN string into its structural components.
 * Returns null if the string is not a valid ARN structure (fewer than 6 colon-separated segments).
 * Everything after the 5th colon is treated as the resource portion.
 */
export function parseArn(arn: string): ArnParts | null {
  const segments = arn.split(':');
  if (segments.length < 6) return null;
  if (segments[0] !== 'arn') return null;

  return {
    partition: segments[1],
    service: segments[2],
    region: segments[3],
    account: segments[4],
    resource: segments.slice(5).join(':'),
  };
}

const placeholderPattern = /\$\{[^}]+\}/;

/**
 * Check if two ARN tokens match. A token matches if:
 * - Either is a wildcard (`*`) or contains `?`
 * - Either is a placeholder (`${...}`)
 * - Both are empty (valid for region/account in some ARNs)
 * - They are literally equal
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === '*' || b === '*') return true;
  if (a.includes('?') || b.includes('?')) return true;
  // Placeholders expect a value — don't match empty strings
  if (a !== '' && b !== '' && (placeholderPattern.test(a) || placeholderPattern.test(b))) return true;
  return false;
}

/**
 * Tokenize a resource string by splitting on both `:` and `/` delimiters.
 * Preserves the delimiter as a separate token so structural comparison
 * handles both `function:name` and `role/name` patterns.
 */
function tokenizeResource(resource: string): string[] {
  return resource.split(/(?<=[:\/])|(?=[:\/])/);
}

/**
 * Check if the resource portion of a user ARN matches a template resource pattern.
 * Splits on `:` and `/` and compares tokens positionally.
 */
function resourceMatches(userResource: string, templateResource: string): boolean {
  const userTokens = tokenizeResource(userResource);
  const templateTokens = tokenizeResource(templateResource);

  if (userTokens.length !== templateTokens.length) {
    // A trailing `*` in the user ARN can match multiple template tokens
    if (userTokens.length < templateTokens.length && userTokens[userTokens.length - 1] === '*') {
      return userTokens.slice(0, -1).every((token, i) => tokensMatch(token, templateTokens[i]));
    }
    return false;
  }

  return userTokens.every((token, i) => tokensMatch(token, templateTokens[i]));
}

/**
 * Check if a parsed user ARN matches a parsed template ARN.
 */
export function arnMatches(userArn: ArnParts, templateArn: ArnParts): boolean {
  if (!tokensMatch(userArn.partition, templateArn.partition)) return false;
  if (!tokensMatch(userArn.service, templateArn.service)) return false;
  if (!tokensMatch(userArn.region, templateArn.region)) return false;
  if (!tokensMatch(userArn.account, templateArn.account)) return false;
  return resourceMatches(userArn.resource, templateArn.resource);
}
