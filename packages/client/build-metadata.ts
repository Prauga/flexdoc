import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const jsReleaseCommit = process.env.GITHUB_EVENT_NAME === 'release' && process.env.GITHUB_REF_NAME?.startsWith('js/v')
  ? process.env.GITHUB_SHA
  : undefined;
const commit = process.env.FLEXDOC_BUILD_REVISION || jsReleaseCommit || 'unknown';
const sourceDate = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : commit === 'unknown' ? 'unknown' : git(['show', '-s', '--format=%cI', commit]);

export const flexDocBuildInfo = {
  version: packageJson.version,
  commit,
  sourceDate,
} as const;
