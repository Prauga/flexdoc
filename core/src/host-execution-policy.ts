/** HTTP schemes permitted by FlexDoc native host execution. */
export type HostExecutionAllowedProtocol = 'http:' | 'https:';

/** Redirect behavior required by the native host-execution security boundary. */
export type HostExecutionRedirectPolicy = 'same-origin-only';

/** Handling of userinfo embedded directly in an outbound target URL. */
export type HostExecutionEmbeddedCredentialsPolicy = 'deny';

/** Runtime address checks required after hostname parsing and DNS resolution. */
export type HostExecutionResolvedAddressPolicy = 'deny-link-local-and-cloud-metadata';

/** Portable input used to construct the canonical host-execution target policy. */
export interface HostExecutionTargetPolicyInput {
  /** Exact HTTP(S) origins that outbound host execution may target. */
  allowedOrigins: readonly string[];
}

/**
 * Framework-neutral host-execution target policy.
 *
 * The policy intentionally describes security semantics without owning DNS or
 * socket behavior. Native runtimes remain responsible for resolving hostnames,
 * rejecting forbidden resolved addresses, pinning connections as appropriate,
 * and revalidating redirect hops.
 */
export interface HostExecutionTargetPolicy {
  /** Normalized, deduplicated exact HTTP(S) origins. */
  allowedOrigins: readonly string[];
  /** Schemes accepted for outbound host execution. */
  allowedProtocols: readonly HostExecutionAllowedProtocol[];
  /** Redirect boundary enforced by native transports. */
  redirectPolicy: HostExecutionRedirectPolicy;
  /** Whether URL-embedded username/password material is accepted. */
  embeddedCredentialsPolicy: HostExecutionEmbeddedCredentialsPolicy;
  /** Address classes native transports must reject before connecting. */
  resolvedAddressPolicy: HostExecutionResolvedAddressPolicy;
}

/** Canonical non-origin invariants shared by backend-native execution runtimes. */
export const HOST_EXECUTION_TARGET_POLICY_INVARIANTS = Object.freeze({
  allowedProtocols: Object.freeze(['http:', 'https:'] as const),
  redirectPolicy: 'same-origin-only' as const,
  embeddedCredentialsPolicy: 'deny' as const,
  resolvedAddressPolicy: 'deny-link-local-and-cloud-metadata' as const,
});

/**
 * Normalize one configured target to an exact HTTP(S) origin.
 *
 * Paths, query strings, and fragments are intentionally discarded. Embedded
 * credentials are represented by the separate fail-closed policy invariant and
 * must still be rejected by the runtime when validating an actual target URL.
 */
export function normalizeHostExecutionOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Normalize and deduplicate a collection of exact host-execution origins. */
export function normalizeHostExecutionAllowedOrigins(values: readonly string[]): string[] {
  const origins = new Set<string>();
  for (const value of values) {
    const origin = normalizeHostExecutionOrigin(value);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

/** Create the canonical portable target-policy representation. */
export function createHostExecutionTargetPolicy(input: HostExecutionTargetPolicyInput): HostExecutionTargetPolicy {
  return {
    allowedOrigins: normalizeHostExecutionAllowedOrigins(input.allowedOrigins),
    allowedProtocols: HOST_EXECUTION_TARGET_POLICY_INVARIANTS.allowedProtocols,
    redirectPolicy: HOST_EXECUTION_TARGET_POLICY_INVARIANTS.redirectPolicy,
    embeddedCredentialsPolicy: HOST_EXECUTION_TARGET_POLICY_INVARIANTS.embeddedCredentialsPolicy,
    resolvedAddressPolicy: HOST_EXECUTION_TARGET_POLICY_INVARIANTS.resolvedAddressPolicy,
  };
}

/** Return whether a target's exact normalized origin is present in the policy. */
export function isHostExecutionOriginAllowed(target: string | URL, policy: HostExecutionTargetPolicy): boolean {
  try {
    const url = typeof target === 'string' ? new URL(target) : target;
    if (!policy.allowedProtocols.includes(url.protocol as HostExecutionAllowedProtocol)) return false;
    return policy.allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
}
