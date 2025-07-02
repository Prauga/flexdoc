# FlexDoc Authentication

FlexDoc provides a simple yet secure authentication system to protect your API documentation from unauthorized access. This guide explains how to set up and use authentication in your FlexDoc implementation.

## Authentication Types

FlexDoc supports two authentication methods:

1. **Basic Authentication**: Username and password-based authentication
2. **Bearer Token Authentication**: JWT token-based authentication

Both methods use a single secret key to generate and validate credentials, eliminating the need for a user database.

## Setting Up Authentication

### 1. Configure Authentication in Your Application

In your application module (e.g., `app.module.ts` for NestJS), configure FlexDoc with authentication:

```typescript
import { Module } from '@nestjs/common';
import { FlexDocModule } from '@flexdoc/backend';

@Module({
  imports: [
    FlexDocModule.forRoot({
      path: 'api-docs',
      options: {
        auth: {
          type: 'basic', // or 'bearer'
          secretKey: 'your-strong-secret-key-here', // Use a secure random string
        },
        // Other FlexDoc options...
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Generate Authentication Credentials

FlexDoc includes a CLI tool to generate credentials based on your secret key.

#### For Basic Authentication

Generate a password for a specific username:

```bash
# Using npx directly
npx flexdoc-auth basic --username john.doe --secret your-strong-secret-key-here

# Or using the script in package.json (if added)
npm run docs:auth:basic --- --username john.doe --secret your-strong-secret-key-here
```

This will output:

```
Credentials for user "john.doe":
Username: john.doe
Password: Ab1cD3fGh!jK

These credentials can be used with Basic Authentication.
```

#### For Bearer Token Authentication

Generate a JWT token with an expiry date:

```bash
# Using npx directly
npx flexdoc-auth bearer --expiry 30 --secret your-strong-secret-key-here

# Or using the script in package.json (if added)
npm run docs:auth:bearer --- --expiry 30 --secret your-strong-secret-key-here
```

This will output:

```
Bearer token (valid for 30 days):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmbGV4ZG9jIiwiaWF0IjoxNjI1NjcyMDAwLCJleHAiOjE2MjgyNjQwMDB9.aBcDeFgHiJkLmNoPqRsTuVwXyZ

Use this token with Bearer Authentication.
```

## Adding Authentication Scripts to Your Project

For convenience, you can add these scripts to your project's `package.json`:

```json
"scripts": {
  "docs:auth:basic": "npx flexdoc-auth basic",
  "docs:auth:bearer": "npx flexdoc-auth bearer"
}
```

## How It Works

### Basic Authentication

1. When a user tries to access your documentation, they're prompted for a username and password
2. FlexDoc uses the provided username and your secret key to generate the expected password
3. If the provided password matches the generated one, access is granted

### Bearer Token Authentication

1. You generate a JWT token using your secret key and a specified expiry time
2. Users include this token in the Authorization header when accessing your documentation
3. FlexDoc verifies the token signature using your secret key and checks that it hasn't expired

## Security Considerations

1. **Choose a Strong Secret Key**: Use a long, random string for your secret key
2. **Keep Your Secret Key Safe**: Never commit it to version control; use environment variables
3. **Use HTTPS**: Always serve your documentation over HTTPS to prevent credential theft
4. **Token Expiry**: For bearer tokens, set an appropriate expiry time
5. **Rotate Credentials**: Periodically change your secret key for enhanced security

## Advantages of This Approach

- **No Database Required**: Authentication works without storing user credentials
- **Deterministic**: Same username + secret always yields the same password
- **Stateless**: No sessions to manage
- **Simple**: Easy to set up and maintain

## Example Implementation

See the [NestJS example](../../examples/nestjs) for a complete implementation of FlexDoc with authentication.
