export type ProviderErrorCategory =
  | 'authentication'
  | 'model_unavailable'
  | 'quota'
  | 'rate_limit'
  | 'transport'
  | 'unknown';

export interface NormalizedProviderError {
  category: ProviderErrorCategory;
  message: string;
}

const MAX_PROVIDER_ERROR_LENGTH = 800;

export function normalizeProviderError(
  rawMessage: string,
  providerDisplayName: string,
): NormalizedProviderError {
  const message = boundProviderError(rawMessage);
  const provider = providerDisplayName.trim() || 'Provider';

  if (isAlreadyActionable(message)) {
    return { category: classifyProviderError(message), message };
  }

  const category = classifyProviderError(message);
  switch (category) {
    case 'authentication':
      return {
        category,
        message: `${provider} authentication failed: invalid or expired credentials. Log in to ${provider} again, then retry.`,
      };
    case 'quota':
      return {
        category,
        message: `${provider} quota or credits are exhausted. Check the provider plan and billing, then retry.`,
      };
    case 'rate_limit':
      return {
        category,
        message: `${provider} rate limit reached. Wait a moment, then retry.`,
      };
    case 'model_unavailable':
      return {
        category,
        message: `The selected ${provider} model is unavailable for this account or plan. Choose another model, then retry.`,
      };
    case 'transport':
      return {
        category,
        message: `${provider} connection closed unexpectedly. Retry the message; Grimoire will reconnect the provider runtime.`,
      };
    default:
      return { category, message };
  }
}

export function classifyProviderError(message: string): ProviderErrorCategory {
  const normalized = message.toLowerCase();

  if (
    /\b401\b|unauthori[sz]ed|invalid[_ -]?api[_ -]?key|invalid[_ -]?key|api[_ -]?key[^\n]*(invalid|expired)|authentication failed|login required|not logged in|token expired/.test(normalized)
  ) {
    return 'authentication';
  }
  if (/insufficient[_ -]?quota|quota (exceeded|exhausted)|credits? (exhausted|depleted)|billing limit/.test(normalized)) {
    return 'quota';
  }
  if (/\b429\b|rate[_ -]?limit|too many requests/.test(normalized)) {
    return 'rate_limit';
  }
  if (/not supported model|model[^\n]*(not available|unavailable|not found|not allowed)|unsupported model/.test(normalized)) {
    return 'model_unavailable';
  }
  if (/json-rpc input closed|transport closed|connection closed unexpectedly|broken pipe|econnreset/.test(normalized)) {
    return 'transport';
  }

  return 'unknown';
}

function isAlreadyActionable(message: string): boolean {
  return /grimoire (switched|will reconnect)|run `[^`]+ auth login`|log in to [^\n]+ again|choose another model|check the provider plan|retry the message/i.test(message);
}

function boundProviderError(message: string): string {
  const normalized = message.trim() || 'Unknown provider error';
  return normalized.length <= MAX_PROVIDER_ERROR_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_PROVIDER_ERROR_LENGTH - 1)}…`;
}
