import { runCli as runSiteCli } from './cli.js';
import { runValidationCli } from './validation.js';

export const HELP = `FlexDoc CLI\n\nUsage:\n  flexdoc build <openapi> [--out <dir>] [--base-path <path>] [--title <title>] [--force]\n  flexdoc serve <openapi> [--host <host>] [--port <port>] [--base-path <path>] [--title <title>] [--watch]\n  flexdoc validate <runtime-intelligence-url> [--json]\n\nBuild/serve input may be a local .json/.yaml/.yml file or an http(s) URL.\nValidation consumes the installed backend's <docsPath>/__flexdoc/runtime endpoint.\n`;

export async function runFlexDocCli(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  if (argv[0] === 'validate') return runValidationCli(argv.slice(1));
  await runSiteCli(argv);
  return 0;
}
