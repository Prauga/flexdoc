#!/usr/bin/env node
import { runFlexDocCli } from '../src/entry.js';

runFlexDocCli(process.argv.slice(2)).then((exitCode) => {
  if (exitCode) process.exitCode = exitCode;
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`flexdoc: ${message}`);
  process.exitCode = 1;
});
