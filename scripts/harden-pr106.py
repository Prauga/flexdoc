from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing pattern in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))

replace(
    'packages/client/src/utils/api-client-execution.ts',
    "  const preferHostExecution = options.preferHostExecution ?? requestPreference ?? serverPreference ?? true;\n",
    "  const preferHostExecution = serverPreference === false\n    ? false\n    : options.preferHostExecution ?? requestPreference ?? serverPreference ?? true;\n",
)

p = Path('packages/client/src/utils/api-client-host-preference.test.ts')
s = p.read_text()
s = s.replace(
    "  it('lets a saved request prefer the API host over a browser-preferred server policy', async () => {",
    "  it('treats a browser-preferred server policy as a ceiling over saved request preference', async () => {",
    1,
)
s = s.replace(
    "    expect(calls).toEqual(['/docs/__flexdoc/execute']);\n    expect(outcome.response?.transport).toBe('api-host');\n  });\n\n  it('keeps explicit caller policy above saved request preference and still forces host-only requirements', async () => {",
    "    expect(calls).toEqual(['https://api.example.test/health']);\n    expect(outcome.response?.transport).toBe('browser');\n  });\n\n  it('keeps an explicit server false above caller and saved-request preferences while still forcing host-only requirements', async () => {",
    1,
)
s = s.replace(
    "      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [] },\n      preferHostExecution: false,",
    "      hostExecution: { available: true, endpoint: '/docs/__flexdoc/execute', capabilities: [], preferHostExecution: false },\n      preferHostExecution: true,",
    1,
)
p.write_text(s)
