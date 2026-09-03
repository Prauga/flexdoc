import { FlexDocModuleOptions } from './interfaces';
import { generateFlexDocHTML } from './template';
import { getRendererAssets } from './renderer-assets';
import { authorizeFlexDocRequest, FlexDocAuthOptions } from './auth';
import * as http from 'http';
import * as https from 'https';

interface AppWithUse {
  use: (
    path: string,
    handler: (req: any, res: any, next?: any) => void | Promise<void>
  ) => void;
}

function createAuthMiddleware(authOptions: FlexDocAuthOptions) {
  return (req: any, res: any, next: any) => {
    const decision = authorizeFlexDocRequest(req.headers.authorization, authOptions);
    if (decision.authorized) return next();

    res.statusCode = 401;
    if (decision.challenge) res.setHeader('WWW-Authenticate', decision.challenge);
    return res.end(decision.message || 'Authentication required');
  };
}

function fetchJson(urlString: string, redirectsRemaining = 3): Promise<any> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      reject(new Error(`Invalid OpenAPI spec URL: ${urlString}`));
      return;
    }

    const client =
      url.protocol === 'https:' ? https : url.protocol === 'http:' ? http : null;
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
        fetchJson(new URL(location, url).toString(), redirectsRemaining - 1).then(
          resolve,
          reject
        );
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Failed to load OpenAPI spec: HTTP ${statusCode || 'unknown'}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
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
  const rendererBasePath = `${normalizedPath}/__flexdoc`;

  // Register auth at the documentation root first so it also protects the
  // renderer assets mounted beneath the same path.
  if (flexDocOptions?.auth) {
    app.use(normalizedPath, createAuthMiddleware(flexDocOptions.auth));
  }

  app.use(`${rendererBasePath}/renderer.js`, (_req: any, res: any) => {
    try {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(getRendererAssets().javascript);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.message : 'Renderer asset unavailable');
    }
  });

  app.use(`${rendererBasePath}/renderer.css`, (_req: any, res: any) => {
    try {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(getRendererAssets().css);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.message : 'Renderer asset unavailable');
    }
  });

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
      const rendererAssets = getRendererAssets();
      const html = generateFlexDocHTML(resolvedSpec, {
        ...(flexDocOptions || {}),
        rendererBasePath,
        rendererVersion: rendererAssets.version,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
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
