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

const commit = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
const sourceDate = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : git(['show', '-s', '--format=%cI', commit]);

export const flexDocBuildInfo = {
  version: packageJson.version,
  commit,
  sourceDate,
  contractVersion: '1',
  repository: 'https://github.com/Prauga/flexdoc',
} as const;
