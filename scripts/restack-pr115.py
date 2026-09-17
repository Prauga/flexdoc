from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing guarded pattern in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))

replace(
    'packages/client/src/components/ApiClient.tsx',
    """    try {\n      if (transportMode !== 'browser' && hostExecution?.available) {\n        const warning = await preflightApiClientHostExecution(hostExecution.endpoint, globalThis.fetch, controller.signal);\n        if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }\n        if (warning) { setError(warning); return; }\n      }\n      onExecutionStart?.();\n      const outcome = await executeApiClientRequest({\n""",
    """    try {\n      onExecutionStart?.();\n      const outcome = await executeApiClientRequest({\n""",
)
replace(
    'packages/client/src/components/ApiClient.tsx',
    """      if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }\n      setError(outcome.error || null);\n""",
    """      if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }\n      let executionError = outcome.error || null;\n      if (executionError && transportMode !== 'browser' && hostExecution?.available) {\n        const warning = await preflightApiClientHostExecution(hostExecution.endpoint, globalThis.fetch, controller.signal);\n        if (controller.signal.aborted) { setError(messages?.requestCancelled || 'Request cancelled.'); return; }\n        if (warning) executionError = `${executionError} ${warning}`;\n      }\n      setError(executionError);\n""",
)

replace(
    'packages/client/src/components/RequestPlayground.tsx',
    """    try {\n      if (transportMode !== 'browser' && options?.tryIt?.hostExecution?.available) {\n        const warning = await preflightApiClientHostExecution(options.tryIt.hostExecution.endpoint);\n        if (warning) { setError(warning); return; }\n      }\n      const request = buildRequest(spec, path, method, valuesRef.current);\n""",
    """    try {\n      const request = buildRequest(spec, path, method, valuesRef.current);\n""",
)
replace(
    'packages/client/src/components/RequestPlayground.tsx',
    """      if (outcome.error) setError(outcome.error);\n      if (outcome.response) setResponse(outcome.response);\n""",
    """      let executionError = outcome.error;\n      if (executionError && transportMode !== 'browser' && options?.tryIt?.hostExecution?.available) {\n        const warning = await preflightApiClientHostExecution(options.tryIt.hostExecution.endpoint);\n        if (warning) executionError = `${executionError} ${warning}`;\n      }\n      if (executionError) setError(executionError);\n      if (outcome.response) setResponse(outcome.response);\n""",
)

replace(
    'packages/client/src/utils/api-client-host-preflight.ts',
    """ * Probe the advertised API-host execute route without executing a target request.\n * A valid FlexDoc route rejects the deliberately empty canonical envelope with a FlexDoc 400.\n * Successful probes using the real browser fetch implementation are cached for the page lifetime.\n""",
    """ * Diagnose a failed API-host execution by probing the advertised execute route without a target request.\n * Healthy host executions never pay this extra round trip. A valid FlexDoc route rejects the deliberately\n * empty canonical envelope with a FlexDoc 400; successful diagnostic probes are cached for the page lifetime.\n""",
)

replace(
    'docs/host-execution-operations.md',
    """Before the first interactive API Client or Try It request uses an advertised API-host execute endpoint, FlexDoc sends a harmless same-origin preflight to that endpoint. The probe uses the normal `X-FlexDoc-Execute: 1` marker with an intentionally empty JSON envelope. A correctly mounted FlexDoc route rejects that envelope with its own HTTP 400 validation response; admission-control HTTP 429 also proves the protected route is reachable. The probe never contains a target request, so it cannot create an outbound API call. Successful endpoint probes are reused for the rest of the page lifetime.\n\nWarnings for authentication/authorization rejection, CSRF or body-middleware interception, missing/incorrect route mounts, redirects to login HTML, and transport failures stop that host-routed Send before target execution. Keep the execute route under the same application-owned authentication/authorization boundary as the documentation subtree; do not weaken security middleware simply to silence the preflight.\n""",
    """Healthy API-host execution sends only the real request. If that host-routed request fails before FlexDoc receives a valid execution response, FlexDoc then sends a harmless same-origin diagnostic probe to the advertised execute endpoint. The probe uses the normal `X-FlexDoc-Execute: 1` marker with an intentionally empty JSON envelope. A correctly mounted FlexDoc route rejects that envelope with its own HTTP 400 validation response; admission-control HTTP 429 also proves the protected route is reachable. The probe never contains a target request, so it cannot create an outbound API call. Successful diagnostic probes are reused for the rest of the page lifetime.\n\nWarnings distinguish authentication/authorization rejection, CSRF or body-middleware interception, missing/incorrect route mounts, redirects to login HTML, and transport failures after the real host execution has already failed. Keep the execute route under the same application-owned authentication/authorization boundary as the documentation subtree; do not weaken security middleware simply to silence the diagnostic.\n""",
)

for path in ['e2e/api-client-host-execution.spec.cjs', 'e2e/flexdoc.spec.cjs']:
    p = Path(path)
    text = p.read_text()
    if 'expect(preflightHits).toBe(1);' not in text:
        raise SystemExit(f'missing preflight assertion in {path}')
    p.write_text(text.replace('expect(preflightHits).toBe(1);', 'expect(preflightHits).toBe(0);', 1))

replace(
    'packages/client/src/components/ApiClient.test.tsx',
    """  it('treats capabilities: [] as available basic host transport', async () => {\n    fetchMock.mockResolvedValue({\n      status: 200,\n""",
    """  it('treats capabilities: [] as available basic host transport', async () => {\n    fetchMock.mockResolvedValue({\n      ok: true,\n      status: 200,\n""",
)
