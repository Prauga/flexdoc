import type { FlexDocHostExecutionPublicOptions } from '../types/options';
import type { HttpRequestDraft } from './http-client';

/** Shown when a scope change cannot be confirmed against the API-host jar. Contains no cookie or request data. */
export const API_HOST_COOKIE_JAR_CLEAR_WARNING =
  'Credential storage changed, but the API-host cookie jar could not be confirmed cleared. It may still hold session cookies until it expires.';

/** Drop a session cookie-jar selection so a cleared jar is not shown as populated. */
export function withoutSessionCookieJar(draft: HttpRequestDraft): HttpRequestDraft {
  if (draft.hostExecution?.cookieJar !== 'session') return draft;
  const hostExecution = { ...draft.hostExecution };
  delete hostExecution.cookieJar;
  return { ...draft, hostExecution: Object.keys(hostExecution).length ? hostExecution : undefined };
}

/**
 * Endpoint for a credential-scope jar clear, or null when the host does not advertise one.
 * The clear is a same-origin documentation request. It must not carry target URLs, request auth, or bodies.
 */
export function apiHostCookieJarClearTarget(host: FlexDocHostExecutionPublicOptions | undefined): string | null {
  if (host?.available !== true) return null;
  if (!(host.capabilities || []).includes('cookies')) return null;
  const endpoint = host.cookiesEndpoint?.trim();
  return endpoint || null;
}

/**
 * Ask the API host to drop the documentation session's cookie jar.
 * Returns a non-secret warning when the clear cannot be confirmed, and null when there is nothing to clear or the clear succeeded.
 * The response body is never read, because it can list cookie names from the jar.
 */
export async function clearApiHostCookieJar(
  host: FlexDocHostExecutionPublicOptions | undefined,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  const endpoint = apiHostCookieJarClearTarget(host);
  if (!endpoint || typeof fetcher !== 'function') return null;
  try {
    const response = await fetcher(endpoint, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1' },
    });
    return response.ok ? null : API_HOST_COOKIE_JAR_CLEAR_WARNING;
  } catch {
    return API_HOST_COOKIE_JAR_CLEAR_WARNING;
  }
}
