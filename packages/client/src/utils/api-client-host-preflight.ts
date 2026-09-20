type HostDiagnosticFetcher = typeof globalThis.fetch;

const confirmedHostExecuteRoutes = new Set<string>();
const HOST_ROUTE = 'API-host execute route';
const EXECUTE_PATH = 'the execute path';

function diagnostic(result: string, guidance: string): string {
  return `${HOST_ROUTE} diagnostic ${result}. Check ${guidance}.`;
}

function diagnosticMessage(status: number, allow: string | null): string {
  if (status === 401) return diagnostic('was unauthorized', `documentation authentication for ${EXECUTE_PATH}`);
  if (status === 403) return diagnostic('was rejected', `CSRF, same-origin, and authorization middleware for ${EXECUTE_PATH}`);
  if (status === 404 || status === 501 || (status === 405 && (!allow || !/\bPOST\b/i.test(allow)))) {
    return `${HOST_ROUTE} is not available at the configured endpoint. Deploy the FlexDoc execute route or update the API-host URL.`;
  }
  if (status === 400) return `${HOST_ROUTE} returned HTTP 400 before FlexDoc validated the diagnostic probe. Check CSRF and request-body middleware for ${EXECUTE_PATH}.`;
  return diagnostic(`returned HTTP ${status}`, 'authentication, CSRF, and middleware configuration');
}

/**
 * Diagnose an API-host execution failure without sending the failed target request or its credentials.
 * Call this only after an actual API-host request failed. The deliberately empty envelope can prove
 * that the advertised execute route is mounted while keeping target URL, headers, body, and secrets out
 * of the diagnostic request. A recognized route is cached for the page lifetime when using browser fetch.
 */
export async function diagnoseApiClientHostExecutionFailure(
  endpoint: string,
  fetcher: HostDiagnosticFetcher = globalThis.fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  const normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint || !fetcher || signal?.aborted) return null;

  const cache = fetcher === globalThis.fetch;
  if (cache && confirmedHostExecuteRoutes.has(normalizedEndpoint)) return null;

  try {
    const response = await fetcher(normalizedEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-FlexDoc-Execute': '1', 'Content-Type': 'application/json' },
      body: '{}',
      signal,
    });
    if (signal?.aborted) return null;

    const raw = await response.text();
    let flexDocError = '';
    try {
      const parsed: { error?: unknown } = raw ? JSON.parse(raw) : {};
      if (typeof parsed.error === 'string') flexDocError = parsed.error;
    } catch { /* middleware HTML/text is diagnosed below */ }

    const reachable = response.status === 429 || (response.status === 400 && /host execution/i.test(flexDocError));
    if (reachable) {
      if (cache) confirmedHostExecuteRoutes.add(normalizedEndpoint);
      return null;
    }
    if (response.redirected) return diagnostic('was redirected', `authentication middleware for ${EXECUTE_PATH}`);
    if (response.ok) return `${HOST_ROUTE} accepted the deliberately invalid diagnostic request. Verify that the configured endpoint is FlexDoc's hardened execute route.`;

    return diagnosticMessage(response.status, response.headers.get('Allow'));
  } catch {
    // Diagnostics are supplemental. A probe failure must never replace the original execution error.
    return null;
  }
}
