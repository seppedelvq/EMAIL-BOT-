import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  devIndicators:false,
  logging: {
    incomingRequests: false,
    fetches: { fullUrl: false },
    browserToTerminal: false,
    serverFunctions: false,
  },
  webpack(config, { isServer }) {
    // Keep runtime optional imports in the linked library on Node's resolver.
    if (isServer)
      config.externals.push({ '@petter100/emai': 'commonjs @petter100/emai' });
    return config;
  },
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': [
      '**/.env*',
      '**/.assistant-data/**',
      '**/.git/**',
      '**/tests/**',
      '**/docs/**',
    ],
  },
  outputFileTracingRoot: resolve(process.cwd(), '..'),
  turbopack: { root: resolve(process.cwd(), '..') },
  serverExternalPackages: [
    '@petter100/emai',
    'googleapis',
    'ollama',
    'openai',
    'better-sqlite3',
    'imapflow',
    'mailparser',
    'nodemailer',
    '@google/generative-ai',
  ],
};

export default nextConfig;
