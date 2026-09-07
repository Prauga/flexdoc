export function operationHashId(path: string, method: string): string {
  const encodedPath = encodeURIComponent(path).replace(/%/g, '~');
  return `${method.trim().toLowerCase()}-${encodedPath}`;
}

export function legacyOperationHashId(path: string, method: string): string {
  return `${method.trim().toLowerCase()}-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
