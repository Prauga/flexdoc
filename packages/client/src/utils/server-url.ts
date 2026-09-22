import type { Server } from '../types/openapi';

export function resolveServerUrl(server: Server): string {
  let url = server.url;
  for (const [name, variable] of Object.entries(server.variables || {})) {
    url = url.split(`{${name}}`).join(variable.default);
  }
  return url;
}

function normalizedServer(url: string): string {
  return url.replace(/\/+$/, '');
}

export function requestUsesServer(requestUrl: string, serverUrl: string): boolean {
  const server = normalizedServer(serverUrl);
  if (!server) return false;
  return requestUrl === server || requestUrl.startsWith(`${server}/`) || requestUrl.startsWith(`${server}?`);
}

function serverPathname(serverUrl: string): string {
  try {
    const path = new URL(serverUrl).pathname.replace(/\/+$/, '');
    return path === '/' ? '' : path;
  } catch {
    return '';
  }
}

function serverOrigin(serverUrl: string): string {
  try {
    return new URL(serverUrl).origin;
  } catch {
    return '';
  }
}

/** Append a request suffix to the next server without repeating a base path the suffix already starts with. */
function joinServerAndSuffix(nextServer: string, suffix: string): string {
  const path = serverPathname(nextServer);
  if (path && (suffix === path || suffix.startsWith(`${path}/`))) {
    const origin = serverOrigin(nextServer);
    if (origin) return `${origin}${suffix}`;
  }
  return `${nextServer}${suffix}`;
}

export function replaceRequestServer(requestUrl: string, currentServerUrl: string, nextServerUrl: string): string {
  const nextServer = normalizedServer(nextServerUrl);
  if (!nextServer) return requestUrl;

  const currentServer = normalizedServer(currentServerUrl);
  if (currentServer && requestUsesServer(requestUrl, currentServer)) {
    return joinServerAndSuffix(nextServer, requestUrl.slice(currentServer.length));
  }

  try {
    const current = new URL(requestUrl);
    const suffix = `${current.pathname === '/' ? '' : current.pathname}${current.search}${current.hash}`;
    return joinServerAndSuffix(nextServer, suffix);
  } catch {
    return nextServer;
  }
}