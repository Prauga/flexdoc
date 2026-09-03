import * as jwt from 'jsonwebtoken';
import {
  authorizeFlexDocRequest,
  generateFlexDocPassword,
} from './auth';

describe('FlexDoc route auth', () => {
  it('validates generated basic-auth credentials', () => {
    const secretKey = 'basic-secret';
    const username = 'alice';
    const password = generateFlexDocPassword(username, secretKey);
    const header = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    expect(authorizeFlexDocRequest(undefined, { type: 'basic', secretKey })).toEqual(
      expect.objectContaining({ authorized: false, challenge: 'Basic' }),
    );
    expect(authorizeFlexDocRequest(header, { type: 'basic', secretKey })).toEqual({ authorized: true });
  });

  it('validates bearer tokens and preserves the password-field fallback', () => {
    const secretKey = 'bearer-secret';
    const token = jwt.sign({ sub: 'docs-user' }, secretKey);
    const bearer = `Bearer ${token}`;
    const basicFallback = `Basic ${Buffer.from(`token:${token}`).toString('base64')}`;

    expect(authorizeFlexDocRequest(bearer, { type: 'bearer', secretKey })).toEqual({ authorized: true });
    expect(authorizeFlexDocRequest(basicFallback, { type: 'bearer', secretKey })).toEqual({ authorized: true });
    expect(authorizeFlexDocRequest('Bearer invalid', { type: 'bearer', secretKey })).toEqual(
      expect.objectContaining({ authorized: false, message: 'Invalid or expired token' }),
    );
  });
});
