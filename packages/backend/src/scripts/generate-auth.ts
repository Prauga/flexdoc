#!/usr/bin/env node

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Generate a deterministic password based on username and secret
 * @param username The username to generate a password for
 * @param secret The secret key used for generation
 * @returns A secure password
 */
function generatePassword(username: string, secret: string): string {
  // Create a HMAC using the secret and username
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(username);

  // Get digest in base64 and take first 12 chars
  const hash = hmac.digest('base64');
  const basePassword = hash.substring(0, 12);

  // Ensure password has at least one uppercase, lowercase, number, and special char
  // by adding specific characters if needed
  let password = basePassword;
  if (!/[A-Z]/.test(password)) password += 'A';
  if (!/[a-z]/.test(password)) password += 'a';
  if (!/[0-9]/.test(password)) password += '1';
  if (!/[^A-Za-z0-9]/.test(password)) password += '!';

  return password;
}

/**
 * Generate a JWT token
 * @param expiry Expiry time in days
 * @param secret The secret key used for signing
 * @returns A JWT token
 */
function generateToken(expiry: number, secret: string): string {
  const payload = {
    iss: 'flexdoc',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiry * 24 * 60 * 60,
  };

  return jwt.sign(payload, secret);
}

// Parse command line arguments
yargs(hideBin(process.argv))
  .command(
    'basic',
    'Generate a password for basic authentication',
    {
      username: {
        description: 'Username to generate password for',
        demandOption: true,
        type: 'string',
      },
      secret: {
        description: 'Secret key used for generation',
        demandOption: true,
        type: 'string',
      },
    },
    (argv) => {
      const password = generatePassword(argv.username, argv.secret);
      console.log(`\nCredentials for user "${argv.username}":`);
      console.log(`Username: ${argv.username}`);
      console.log(`Password: ${password}\n`);
      console.log(`These credentials can be used with Basic Authentication.\n`);
    }
  )
  .command(
    'bearer',
    'Generate a JWT token for bearer authentication',
    {
      expiry: {
        description: 'Token expiry in days',
        default: 30,
        type: 'number',
      },
      secret: {
        description: 'Secret key used for signing',
        demandOption: true,
        type: 'string',
      },
    },
    (argv) => {
      const token = generateToken(argv.expiry, argv.secret);
      console.log(`\nBearer token (valid for ${argv.expiry} days):`);
      console.log(token);
      console.log(`\nUse this token with Bearer Authentication.\n`);
    }
  )
  .demandCommand(1, 'You must specify a command: basic or bearer')
  .help()
  .parse();
