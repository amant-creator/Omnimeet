'use strict';

/**
 * Validates required environment variables at server startup.
 * Call require('./lib/env') at the top of server.js so the
 * process fails fast with a clear error rather than silently
 * misbehaving at runtime.
 */

const isProd = process.env.NODE_ENV === 'production';

const REQUIRED_IN_PROD = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'ALLOWED_ORIGINS',
];

const RECOMMENDED = [
  'PORT',
];

const missing = isProd
  ? REQUIRED_IN_PROD.filter((k) => !process.env[k])
  : [];

if (missing.length > 0) {
  console.error(
    '\n❌  Missing required environment variables:\n' +
    missing.map((k) => `   • ${k}`).join('\n') +
    '\n\nCopy .env.example → .env.local and fill in the values.\n'
  );
  process.exit(1);
}

const missingRecommended = RECOMMENDED.filter((k) => !process.env[k]);
if (missingRecommended.length > 0 && isProd) {
  console.warn(
    '[env] Warning: recommended env vars not set: ' + missingRecommended.join(', ')
  );
}

// Validate NEXTAUTH_SECRET length in production (should be ≥32 chars)
if (isProd && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
  console.error('❌  NEXTAUTH_SECRET must be at least 32 characters long in production.');
  process.exit(1);
}

if (!isProd) {
  // In dev, set a default secret if not provided so the dev server just works
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = 'dev-only-secret-do-not-use-in-production';
  }
  if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = `http://localhost:${process.env.PORT || 3000}`;
  }
}

module.exports = {};
