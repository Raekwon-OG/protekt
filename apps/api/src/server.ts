// filepath: apps/api/src/server.ts
/**
 * Express app setup: middleware, routes and error handling.
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { configuration } from './config/env';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import orgsRoutes from './routes/orgs.routes';
import securityRoutes from './routes/security.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(cors({ origin: configuration.CORS_ORIGIN === '*' ? true : configuration.CORS_ORIGIN }));
app.use(express.json());
app.use(authMiddleware);

// Mount API routers
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/health', healthRoutes);

// Basic 404
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not Found' } });
});

// Basic error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';
  res.status(status).json({ error: { message } });
});

export default app;
