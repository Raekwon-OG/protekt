// filepath: apps/api/src/index.ts
/**
 * Entrypoint: loads env and starts the HTTP server.
 */
import './config/env';
import app from './server';
import { configuration } from './config/env';
import { logger } from './utils/jwt';

const port = configuration.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Protekt API listening on port ${port}`);
});

const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
