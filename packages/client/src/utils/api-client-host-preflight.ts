import { useEffect, useState } from 'react';

type HostPreflightFetcher = typeof globalThis.fetch;
const hostPreflights = new Map<string, Promise<string | null>>();

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
 */
export async function preflightApiClientHostExecution(endpoint: string, fetcher: HostPreflightFetcher = globalThis.fetch): Promise<string | null> {
  if (!fetcher) return 'API-host execute route preflight could not run because Fetch is unavailable.';
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const raw = await response.text();
    let flexDocError = '';
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as { error?: unknown }).error === 'string') flexDocError = (parsed as { error: string }).error;
    } catch { /* middleware HTML/text is diagnosed below */ }
    if (response.status === 429) return null;
    if (response.status === 400 && /host execution/i.test(flexDocError)) return null;
    if (response.redirected) return 'API-host execute route preflight was redirected. Check authentication middleware for the execute path.';
    if (response.ok) return 'API-host execute route preflight returned an unexpected success response. Check middleware routing for the execute path.';
    return preflightMessage(response.status);
  } catch {
    return 'API-host execute route preflight could not reach the advertised endpoint. Check the execute path and documentation middleware.';
  }
}

/** Run one shared preflight per advertised endpoint for interactive browser surfaces. */
export function useApiClientHostExecutionPreflight(endpoint?: string): string | null {
  const [result, setResult] = useState<{ endpoint: string; warning: string | null }>({ endpoint: '', warning: null });
  useEffect(() => {
    let active = true;
    if (!endpoint) return () => { active = false; };
    let pending = hostPreflights.get(endpoint);
    if (!pending) {
      pending = preflightApiClientHostExecution(endpoint);
      hostPreflights.set(endpoint, pending);
      void pending.then((warning) => { if (warning && hostPreflights.get(endpoint) === pending) hostPreflights.delete(endpoint); });
    }
    void pending.then((warning) => { if (active) setResult({ endpoint, warning }); });
    return () => { active = false; };
  }, [endpoint]);
  return endpoint && result.endpoint === endpoint ? result.warning : null;
}
