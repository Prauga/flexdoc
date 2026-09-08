import { createHash } from 'crypto';

/** Cached FlexDoc HTML page and its strong entity tag. */
export interface CachedFlexDocPage {
  /** Complete rendered FlexDoc HTML document. */
  body: string;
  /** Strong ETag derived from `body` and suitable for an HTTP `ETag` header. */
  etag: string;
}

/**
 * Compute the strong ETag used for a rendered FlexDoc HTML page.
 * @param body Complete HTML response body.
 * @returns Quoted SHA-256 Base64URL entity tag.
 */
export function flexDocPageEtag(body: string): string {
  const digest = createHash('sha256').update(body).digest('base64url');
  return `"${digest}"`;
}

/**
 * Test an incoming `If-None-Match` value against a FlexDoc page ETag.
 * @param value Raw header value as exposed by Node frameworks, including repeated-header arrays.
 * @param etag Strong ETag generated for the current page.
 * @returns `true` for wildcard, strong, or weak matches that should produce HTTP 304.
 */
export function matchesFlexDocEtag(
  value: string | string[] | undefined,
  etag: string,
): boolean {
  if (!value) return false;
  const header = Array.isArray(value) ? value.join(',') : value;
  return header
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate === etag || candidate === `W/${etag}`);
}

/**
 * Create a lazy page renderer that memoizes the first successful HTML/ETag result.
 *
 * Concurrent callers share the same pending render. A failed render clears the cache so
 * a later request can retry; successful pages remain cached for the lifetime of the closure.
 *
 * @param render Function that synchronously or asynchronously produces the FlexDoc HTML body.
 * @returns Async getter for the cached page and ETag.
 */
export function createCachedFlexDocPage(
  render: () => string | Promise<string>,
): () => Promise<CachedFlexDocPage> {
  let pending: Promise<CachedFlexDocPage> | null = null;

  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(render)
        .then((body) => ({ body, etag: flexDocPageEtag(body) }))
        .catch((error) => {
          pending = null;
          throw error;
        });
    }
    return pending;
  };
}
