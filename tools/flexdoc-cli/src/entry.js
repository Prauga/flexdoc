import { runCli as runSiteCli } from './cli.js';
import { runRunnerCli } from './runner.js';
import { runValidationCli } from './validation.js';

export const HELP = `FlexDoc CLI\n\nUsage:\n  flexdoc build <openapi> [--out <dir>] [--base-path <path>] [--title <title>] [--force]\n  flexdoc serve <openapi> [--host <host>] [--port <port>] [--base-path <path>] [--title <title>] [--watch]\n  flexdoc validate <runtime-intelligence-url> [--json] [--header <name:value>] [--bearer <token> | --basic <user:password>] [--fail-on <error|warning|info>]\n  flexdoc run <artifact.json> [--host <docs-url>] [--json] [--report <file>] [--stop-on-failure] [--header <name:value>] [--bearer <token> | --basic <user:password>]\n\nBuild/serve input may be a local .json/.yaml/.yml file or an http(s) URL.\nValidation consumes a Node FlexDoc 3.1 <docsPath>/__flexdoc/runtime endpoint and uses the backend-produced validation result.\nRunner consumes a portable FlexDoc workspace artifact and executes the existing request/script/collection model outside the browser.\n`;

/**
 * Dispatch the top-level FlexDoc CLI command.
 * @param {string[]} argv Arguments excluding the Node executable and CLI script path.
 * @returns {Promise<number>} Process exit code for build, serve, contract validation, or headless execution.
 */
export async function runFlexDocCli(argv) {
  if (!argv.length) {
    console.log(HELP);
    return 0;
  }
  if (argv[0] === 'validate') return runValidationCli(argv.slice(1));
  if (argv[0] === 'run') return runRunnerCli(argv.slice(1));
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  await runSiteCli(argv);
  return 0;
}
