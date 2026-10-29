import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

export const app = express();

// 1. Cabeceras de seguridad HTTP
app.use(helmet());

// 2. Control de acceso CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin origin (como herramientas de test locales, curl, etc.)
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`Origen CORS no autorizado: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Procesamiento seguro de cuerpos JSON
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));

// 4. Registro no sensible de peticiones (sin credenciales ni tokens)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (env.nodeEnv !== 'test') {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 5. Endpoint de salud sin exposición de secretos ni trazas internas
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'InterAula Backend API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 6. Enrutamiento principal de la API
app.use('/api', apiRouter);

// 7. Manejo de rutas inexistentes (404)
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada en la API de InterAula',
  });
});

// 8. Middleware centralizado de errores
app.use(errorHandler);

export default app;
