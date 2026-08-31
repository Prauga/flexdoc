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

export function replaceRequestServer(requestUrl: string, currentServerUrl: string, nextServerUrl: string): string {
  const nextServer = normalizedServer(nextServerUrl);
  if (!nextServer) return requestUrl;

  const currentServer = normalizedServer(currentServerUrl);
  if (currentServer && requestUsesServer(requestUrl, currentServer)) {
    return `${nextServer}${requestUrl.slice(currentServer.length)}`;
  }

  try {
    const current = new URL(requestUrl);
    const suffix = `${current.pathname === '/' ? '' : current.pathname}${current.search}${current.hash}`;
    return `${nextServer}${suffix}`;
  } catch {
    return nextServer;
  }
}