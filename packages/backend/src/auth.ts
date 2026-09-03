import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface FlexDocAuthOptions {
  secretKey: string;
  type: 'basic' | 'bearer';
}

export interface FlexDocAuthDecision {
  authorized: boolean;
  challenge?: string;
  message?: string;
}

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
