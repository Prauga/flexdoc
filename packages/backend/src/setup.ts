import { FlexDocModuleOptions, FlexDocOptions } from './interfaces';
import { generateFlexDocHTML } from './template';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// Using a more generic type to avoid version conflicts
interface AppWithUse {
  use: (
    path: string,
    handler: (req: any, res: any, next?: any) => void
  ) => void;
}

/**
 * Generate a deterministic password based on username and secret
 * Similar to the CLI tool but embedded in the middleware
 */
function generatePassword(username: string, secret: string): string {
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
 * Authentication middleware for FlexDoc
 */
function createAuthMiddleware(authOptions: {
  secretKey: string;
  type: 'basic' | 'bearer';
}) {
  return (req: any, res: any, next: any) => {
    if (!authOptions) {
      // No authentication required
      return next();
    }

    const { type, secretKey } = authOptions;

    if (type === 'basic') {
      // Basic authentication
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.end('Authentication required');
      }

      // Extract credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString(
        'ascii'
      );
      const [username, password] = credentials.split(':');

      // Generate the expected password for this username
      const expectedPassword = generatePassword(username, secretKey);

      if (password !== expectedPassword) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.end('Invalid credentials');
      }

      return next();
    }

    if (type === 'bearer') {
      // Bearer token authentication
      const authHeader = req.headers.authorization;

      // First check for Bearer token
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          // Verify the JWT token
          jwt.verify(token, secretKey);
          return next();
        } catch (err) {
          res.statusCode = 401;
          res.setHeader(
            'WWW-Authenticate',
            'Basic realm="Enter token as password"'
          );
          return res.end('Invalid or expired token');
        }
      }

      // If no Bearer token, check for Basic auth that might contain the token
      if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString(
          'ascii'
        );
        // For Bearer auth via Basic dialog, we expect username to be "token" and password to be the actual token
        const [username, token] = credentials.split(':');

        try {
          // Verify the JWT token (provided as password)
          jwt.verify(token, secretKey);
          return next();
        } catch (err) {
          res.statusCode = 401;
          res.setHeader(
            'WWW-Authenticate',
            'Basic realm="Enter token as password"'
          );
          return res.end('Invalid or expired token');
        }
      }

      // If no auth header is present, prompt for Basic auth
      res.statusCode = 401;
      res.setHeader(
        'WWW-Authenticate',
        'Basic realm="Enter token as password"'
      );
      return res.end('Authentication required');
    }

    // If we reach here, auth type is not supported
    return next();
  };
}

export function setupFlexDoc(
  app: AppWithUse,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>
): void {
  const { spec, specUrl, options: flexDocOptions } = options;

  // Ensure path starts with a forward slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Apply auth middleware if configured
  if (flexDocOptions?.auth) {
    app.use(normalizedPath, createAuthMiddleware(flexDocOptions.auth));
  }

  app.use(normalizedPath, (req: any, res: any) => {
    const html = generateFlexDocHTML(spec || null, {
      ...flexDocOptions,
      specUrl,
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });
}

