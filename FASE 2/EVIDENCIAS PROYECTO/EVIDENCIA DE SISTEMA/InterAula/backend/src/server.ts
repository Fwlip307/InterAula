import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Servidor InterAula Backend en ejecución`);
  console.log(`📡 Puerto: ${env.port}`);
  console.log(`🌐 Ambiente: ${env.nodeEnv}`);
  console.log(`🛡️  CORS: ${env.corsOrigins.join(', ')}`);
  console.log(`🩺 Health: http://localhost:${env.port}/api/health`);
  console.log(`=========================================`);
});

// Manejo de apagado elegante (graceful shutdown)
function gracefulShutdown(signal: string) {
  console.log(`\n[Server] Señal recibida: ${signal}. Cerrando servidor limpiamente...`);
  server.close(() => {
    console.log('[Server] Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Server] Cierre forzado por timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
