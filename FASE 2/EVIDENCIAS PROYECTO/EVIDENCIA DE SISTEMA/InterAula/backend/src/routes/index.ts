import { Router } from 'express';
import profileRoutes from './profile.routes.js';
import tutoringRoutes from './tutoring.routes.js';
import workshopRoutes from './workshop.routes.js';
import verificationRoutes from './verification.routes.js';
import forumRoutes from './forum.routes.js';
import notesRoutes from './notes.routes.js';
import projectRoutes from './project.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

// Salud y estado del servidor API
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'InterAula Backend API',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de dominio
router.use('/profiles', profileRoutes);
router.use('/tutoring', tutoringRoutes);
router.use('/workshops', workshopRoutes);
router.use('/verification', verificationRoutes);
router.use('/forum', forumRoutes);
router.use('/notes', notesRoutes);
router.use('/projects', projectRoutes);
router.use('/ai', aiRoutes);

export default router;
