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
import devicesRoutes from './routes/devices.routes';
import agentRoutes from './routes/agent.routes';
import backupRoutes from './routes/backup.routes';
import swaggerUi from 'swagger-ui-express';

const app = express();

// CORS configuration driven from env
const corsOptions: cors.CorsOptions = {
  origin: configuration.CORS_ORIGIN === '*' ? true : configuration.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  credentials: true,
  preflightContinue: false,
};
app.use(cors(corsOptions));
// Note: explicit app.options registrations can interact poorly with the
// internal router/path-to-regexp in some versions. The `cors` middleware
// already handles preflight when registered via `app.use(cors(...))`.
// Remove the explicit options route to avoid path-to-regexp parsing errors.
app.use(express.json());
app.use(authMiddleware);

// --- Swagger/OpenAPI setup -------------------------------------------------
// Compute server URL priority: SWAGGER_SERVER_URL | API_URL | localhost:PORT
const serverUrl = configuration.SWAGGER_SERVER_URL || configuration.API_URL || `http://localhost:${configuration.PORT}`;

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Protekt API',
    version: '1.0.0',
    description: 'Protekt multi-tenant API documentation',
  },
  servers: [
    {
      url: serverUrl,
      description: 'Runtime server URL (from SWAGGER_SERVER_URL | API_URL | localhost:PORT)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/auth/login': {
      post: {
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] },
            },
          },
        },
        responses: { '200': { description: 'Login successful' }, '401': { description: 'Unauthorized' } },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new user (if implemented)',
        requestBody: { required: true },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/devices': {
      get: { summary: 'List devices (org-scoped)', responses: { '200': { description: 'OK' } } },
      post: { summary: 'Create device', responses: { '201': { description: 'Created' } } },
    },
    '/api/security/scan-url': {
      post: { summary: 'Scan a URL', responses: { '200': { description: 'Scan queued' } } },
    },
    '/api/security/ingest-email': {
      post: { summary: 'Ingest inbound email for scanning', responses: { '200': { description: 'Ingested' } } },
    },
  },
};

// Mount Swagger UI at /docs with persistAuthorization enabled
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, undefined, undefined, undefined, { swaggerOptions: { persistAuthorization: true } }));

// Mount API routers
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/backup', backupRoutes);

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
