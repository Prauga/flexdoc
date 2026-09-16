type HostPreflightFetcher = typeof globalThis.fetch;
const successfulHostPreflights = new Set<string>();

function preflightMessage(status: number): string {
  if (status === 401) return 'API-host execute route preflight was unauthorized. Check documentation authentication for the execute path.';
  if (status === 403) return 'API-host execute route preflight was rejected. Check CSRF, same-origin, and authorization middleware for the execute path.';
  if (status === 404 || status === 405) return `API-host execute route preflight returned HTTP ${status}. Check the execute path and middleware mount order.`;
  if (status === 400) return 'API-host execute route returned HTTP 400 before FlexDoc validated the probe. Check CSRF and request-body middleware for the execute path.';
  return `API-host execute route preflight returned HTTP ${status}. Check authentication, CSRF, and middleware configuration.`;
}

/**
 * Probe the advertised API-host execute route without executing a target request.
 * A valid FlexDoc route rejects the deliberately empty canonical envelope with a FlexDoc 400.
 * Successful probes using the real browser fetch implementation are cached for the page lifetime.
 */
export async function preflightApiClientHostExecution(
  endpoint: string,
  fetcher: HostPreflightFetcher = globalThis.fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  const cache = fetcher === globalThis.fetch;
  if (cache && successfulHostPreflights.has(endpoint)) return null;
  if (!fetcher) return 'API-host execute route preflight could not run because Fetch is unavailable.';
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
      body: '{}',
      ...(signal ? { signal } : {}),
    });
    const raw = await response.text();
    let flexDocError = '';
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as { error?: unknown }).error === 'string') flexDocError = (parsed as { error: string }).error;
    } catch { /* middleware HTML/text is diagnosed below */ }
    const reachable = response.status === 429 || (response.status === 400 && /host execution/i.test(flexDocError));
    if (reachable) {
      if (cache) successfulHostPreflights.add(endpoint);
      return null;
    }
    if (response.redirected) return 'API-host execute route preflight was redirected. Check authentication middleware for the execute path.';
    if (response.ok) return 'API-host execute route preflight returned an unexpected success response. Check middleware routing for the execute path.';
    return preflightMessage(response.status);
  } catch {
    if (signal?.aborted) return null;
    return 'API-host execute route preflight could not reach the advertised endpoint. Check the execute path and documentation middleware.';
  }
}
