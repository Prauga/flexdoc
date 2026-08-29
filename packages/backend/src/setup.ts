import { FlexDocModuleOptions } from './interfaces';
import { generateFlexDocHTML } from './template';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import * as https from 'https';

// Using a more generic type to avoid version conflicts
interface AppWithUse {
  use: (
    path: string,
    handler: (req: any, res: any, next?: any) => void | Promise<void>
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
    const { type, secretKey } = authOptions;

    if (type === 'basic') {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.end('Authentication required');
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString(
        'ascii'
      );
      const separatorIndex = credentials.indexOf(':');
      const username =
        separatorIndex === -1 ? credentials : credentials.slice(0, separatorIndex);
      const password =
        separatorIndex === -1 ? '' : credentials.slice(separatorIndex + 1);

      const expectedPassword = generatePassword(username, secretKey);

      if (password !== expectedPassword) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.end('Invalid credentials');
      }

      return next();
    }

    if (type === 'bearer') {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
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

      if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString(
          'ascii'
        );
        const separatorIndex = credentials.indexOf(':');
        const token =
          separatorIndex === -1 ? '' : credentials.slice(separatorIndex + 1);

        try {
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

      res.statusCode = 401;
      res.setHeader(
        'WWW-Authenticate',
        'Basic realm="Enter token as password"'
      );
      return res.end('Authentication required');
    }

    return next();
  };
}

function fetchJson(urlString: string, redirectsRemaining = 3): Promise<any> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch (error) {
      reject(new Error(`Invalid OpenAPI spec URL: ${urlString}`));
      return;
    }

    const client = url.protocol === 'https:' ? https : url.protocol === 'http:' ? http : null;
    if (!client) {
      reject(new Error(`Unsupported OpenAPI spec URL protocol: ${url.protocol}`));
      return;
    }

    const request = client.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        if (redirectsRemaining <= 0) {
          reject(new Error('Too many redirects while loading OpenAPI spec'));
          return;
        }
        const redirectedUrl = new URL(location, url).toString();
        fetchJson(redirectedUrl, redirectsRemaining - 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(
          new Error(`Failed to load OpenAPI spec: HTTP ${statusCode || 'unknown'}`)
        );
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(new Error('OpenAPI spec URL did not return valid JSON'));
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(10_000, () => {
      request.destroy(new Error('Timed out while loading OpenAPI spec'));
    });
  });
}

export function setupFlexDoc(
  app: AppWithUse,
  path: string,
  options: Omit<FlexDocModuleOptions, 'path'>
): void {
  const { spec, specUrl, options: flexDocOptions } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (flexDocOptions?.auth) {
    app.use(normalizedPath, createAuthMiddleware(flexDocOptions.auth));
  }

  // Resolve a remote specification once and reuse it for subsequent requests.
  // A rejected promise is cleared so a temporary upstream failure can recover.
  let remoteSpecPromise: Promise<any> | null = null;
  const getSpec = async () => {
    if (spec) return spec;
    if (!specUrl) return null;

    if (!remoteSpecPromise) {
      remoteSpecPromise = fetchJson(specUrl).catch((error) => {
        remoteSpecPromise = null;
        throw error;
      });
    }

    return remoteSpecPromise;
  };

  app.use(normalizedPath, async (_req: any, res: any) => {
    try {
      const resolvedSpec = await getSpec();
      const html = generateFlexDocHTML(resolvedSpec, flexDocOptions || {});
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(
        `Unable to load OpenAPI specification: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  });
}
