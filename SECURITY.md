# Security Policy

FlexDoc runs inside your backend. The renderer is served by your application, and host execution issues outbound requests from your service's network position. That makes the security boundary part of the product rather than a deployment detail, and it is why this policy states what is in scope, what is deliberately out of scope, and what a report can expect in return.

## Reporting a vulnerability

**Report privately through GitHub Security Advisories:** open the [Security tab](https://github.com/Prauga/flexdoc/security/advisories/new) and choose *Report a vulnerability*. This creates a private advisory visible only to you and the maintainers.

**Do not open a public issue, pull request, or discussion for a suspected vulnerability.** A public report starts a disclosure clock that nobody chose.

A useful report includes the affected package and version, the adapter and runtime, the configuration relevant to the finding — particularly the host-execution policy if execution is involved — and the smallest reproduction you can construct. A proof of concept is welcome but not required; a clear description of the mechanism is worth more than a working exploit.

## What to expect

FlexDoc is maintained by a small team, and these targets are set to be kept rather than to sound impressive.

| Stage | Target |
|---|---|
| Acknowledgement that the report was received | 5 business days |
| Initial assessment: accepted, needs information, or declined with reasons | 14 calendar days |
| Fix released — critical | 14 calendar days from acceptance |
| Fix released — high | 30 calendar days from acceptance |
| Fix released — moderate and low | Next scheduled release, typically within 90 days |

Fixes publish as a coordinated release across the affected package lines, followed by a public advisory with a CVE where one applies. Reporters are credited by name or handle unless they ask not to be. If a fix will miss its target, you will be told before the date rather than after it.

Disclosure is coordinated: the advisory publishes once a fix is available, or 90 days after acceptance, whichever comes first. If a vulnerability is being exploited, that timeline shortens to whatever is actually safe.

## Supported versions

Security fixes land on the most recent published minor of each package line. Older minors do not receive backports.

| Package line | Supported |
|---|---|
| `@prauga/flexdoc-client`, `@prauga/flexdoc-backend` | 3.4.x |
| `@prauga/flexdoc-core` | 0.5.x |
| `@prauga/flexdoc-cli` | 0.7.x |
| `prauga-flexdoc` (Python) | 0.9.x |
| Java / JVM / JAX-RS / Spring | 0.10.x |
| `Prauga.FlexDoc.AspNetCore` | 0.7.x |
| `prauga-flexdoc-host-execution` (Rust) | 0.2.x |
| `prauga-flexdoc-axum` | 0.6.x |
| `prauga-flexdoc-actix` | 0.5.x |
| `github.com/prauga/flexdoc/adapters/go` | 0.6.x |
| `prauga-flexdoc` (Ruby), `prauga_flexdoc` (Elixir), `prauga/flexdoc` (PHP) | 0.5.x |

## In scope

- Bypassing the host-execution security boundary: admission control, authentication ordering, destination policy, the request marker, or body limits.
- Server-side request forgery through host execution that the documented destination policy should have prevented.
- Cross-site scripting or content injection from OpenAPI specification content, including specifications crafted to attack the renderer.
- Leaking credentials or environment values beyond the scope the API Client's credential settings promise.
- Secrets or credentials appearing in runner artifacts, observability exports, or history in ways the documentation says they will not.
- Authentication or authorization flaws in any FlexDoc-served route.
- Privilege escalation through an adapter's integration with its framework, including ordering flaws that place FlexDoc ahead of a framework's own security controls.
- Supply-chain integrity problems in published artifacts.

## Out of scope

These are documented design boundaries, not vulnerabilities. If you believe one is wrong, open a normal issue and argue the design — that is a legitimate discussion, just not a security report.

- **API Client scripts are trusted local JavaScript, not a sandbox.** They run with the privileges of the page by design. Script capability is not an escape.
- **Host execution is privileged by construction.** It exists to issue requests from the service's network position. That it can reach internal hosts is the feature; the security control is the operator's destination policy, so a finding needs to show the policy being bypassed rather than enforced.
- **Secrets typed into scripts, collection variables, environment values, or raw headers persist as entered.** The credential scopes cover explicit request, folder, and collection auth fields. This limit is documented; see [`docs/host-execution-operations.md`](docs/host-execution-operations.md).
- **Environment values are always included in runner artifacts.** Artifacts are sensitive by design and should be handled accordingly.
- Findings that require an already-compromised host, an already-privileged operator, or a configuration the documentation explicitly warns against.
- Vulnerable dependencies of the example applications under `examples/`. These demonstrate integration and are not published artifacts. Report them if you like — they get fixed — but they are not treated as product vulnerabilities.
- Missing hardening headers or best-practice findings from automated scanners with no demonstrated impact.

## Security documentation

The security model is documented rather than implied:

- [`docs/host-execution-operations.md`](docs/host-execution-operations.md) — operator security guidance, admission control, and destination policy
- [`docs/host-execution.md`](docs/host-execution.md) — the execution boundary and its controls
- [`docs/host-execution-observability.md`](docs/host-execution-observability.md) — what evidence is emitted and what it deliberately excludes
- [`docs/multi-instance-deployment.md`](docs/multi-instance-deployment.md) — security considerations for horizontally scaled deployments

## Safe harbour

Research conducted in good faith under this policy is welcome. We will not pursue or support legal action against anyone who reports through the private channel above, limits testing to systems they own or are authorised to test, avoids privacy violations and service degradation, and gives us reasonable time to fix an issue before disclosing it.
