import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

/** Server-side authentication configuration protecting FlexDoc documentation routes. */
export interface FlexDocAuthOptions {
  /** Server-only secret used to derive Basic passwords or verify bearer JWT signatures. */ secretKey: string;
  /** Authentication mode enforced for the documentation mount. */ type: 'basic' | 'bearer';
}

/** Result of evaluating one documentation-route Authorization header. */
export interface FlexDocAuthDecision {
  /** Whether the request may continue. */ authorized: boolean;
  /** Optional `WWW-Authenticate` challenge returned for denied requests. */ challenge?: string;
  /** Optional human-readable denial message. */ message?: string;
}

/**
 * Derive the deterministic Basic-auth password accepted for a username.
 * @param username Username supplied by the documentation viewer.
 * @param secret Server-only FlexDoc auth secret.
 * @returns Deterministic password derived with HMAC-SHA256 and minimum character-class coverage.
 */
export function generateFlexDocPassword(username: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(username);
  const hash = hmac.digest('base64');
  const basePassword = hash.substring(0, 12);

  let password = basePassword;
  if (!/[A-Z]/.test(password)) password += 'A';
  if (!/[a-z]/.test(password)) password += 'a';
  if (!/[0-9]/.test(password)) password += '1';
  if (!/[^A-Za-z0-9]/.test(password)) password += '!';
  return password;
}

/**
 * Authorize one request against FlexDoc's Basic or bearer-token documentation protection.
 * @param authHeader Raw HTTP `Authorization` header.
 * @param authOptions Authentication mode and server-only secret.
 * @returns Authorization decision including the challenge/message to emit when denied.
 */
export function authorizeFlexDocRequest(
  authHeader: string | undefined,
  authOptions: FlexDocAuthOptions,
): FlexDocAuthDecision {
  const { type, secretKey } = authOptions;

  if (type === 'basic') {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return { authorized: false, challenge: 'Basic', message: 'Authentication required' };
    }

    const credentials = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('ascii');
    const separatorIndex = credentials.indexOf(':');
    const username = separatorIndex === -1 ? credentials : credentials.slice(0, separatorIndex);
    const password = separatorIndex === -1 ? '' : credentials.slice(separatorIndex + 1);

    if (password !== generateFlexDocPassword(username, secretKey)) {
      return { authorized: false, challenge: 'Basic', message: 'Invalid credentials' };
    }

    return { authorized: true };
  }

  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length);
  } else if (authHeader?.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('ascii');
    const separatorIndex = credentials.indexOf(':');
    token = separatorIndex === -1 ? undefined : credentials.slice(separatorIndex + 1);
  }

  if (token) {
    try {
      jwt.verify(token, secretKey);
      return { authorized: true };
    } catch {
      return {
        authorized: false,
        challenge: 'Basic realm="Enter token as password"',
        message: 'Invalid or expired token',
      };
    }
  }

  return {
    authorized: false,
    challenge: 'Basic realm="Enter token as password"',
    message: 'Authentication required',
  };
}
