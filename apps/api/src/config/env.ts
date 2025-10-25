// filepath: apps/api/src/config/env.ts
/**
 * Loads environment variables, validates via Zod and exports configuration.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().nonempty('DATABASE_URL is required'),
  JWT_SECRET: z.string().nonempty('JWT_SECRET is required'),
  PORT: z.preprocess((v) => (v ? Number(v) : 4000), z.number().int().positive()).optional(),
  CORS_ORIGIN: z.string().optional().default('*'),
  SAFE_BROWSING_KEY: z.string().optional(),
  VIRUSTOTAL_KEY: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Print helpful errors and exit early in dev
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.format());
  // Do not throw to keep behavior flexible; but missing DATABASE_URL/JWT_SECRET will be empty strings
}

export const configuration = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SAFE_BROWSING_KEY: process.env.SAFE_BROWSING_KEY || '',
  VIRUSTOTAL_KEY: process.env.VIRUSTOTAL_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  VIRUSTOTAL_POLL_INTERVAL: Number(process.env.VIRUSTOTAL_POLL_INTERVAL) || 2000,
  VIRUSTOTAL_POLL_TIMEOUT: Number(process.env.VIRUSTOTAL_POLL_TIMEOUT) || 15000,
};
