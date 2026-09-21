#!/usr/bin/env node
/**
 * Collect each replica's observation export and merge them into one fleet view.
 *
 * Usage (from this directory, with the Compose stack running):
 *   npm run merge-observations
 */
const { mergeFleetObservations } = require('./index.js');

const urls = (
  process.env.FLEET_OBSERVATION_URLS ||
  'http://127.0.0.1:3001/__fleet/observation,http://127.0.0.1:3002/__fleet/observation,http://127.0.0.1:3003/__fleet/observation'
).split(',');

mergeFleetObservations(urls)
  .then((fleet) => {
    console.log(JSON.stringify(fleet, null, 2));
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
