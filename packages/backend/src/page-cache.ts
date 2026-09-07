import { createHash } from 'crypto';

export interface CachedFlexDocPage {
  body: string;
  etag: string;
}

export function flexDocPageEtag(body: string): string {
  const digest = createHash('sha256').update(body).digest('base64url');
  return `"${digest}"`;
}

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
