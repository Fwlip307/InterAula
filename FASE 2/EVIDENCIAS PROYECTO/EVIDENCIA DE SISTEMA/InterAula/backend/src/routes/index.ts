import { Router } from 'express';
import profileRoutes from './profile.routes.js';
import tutoringRoutes from './tutoring.routes.js';
import workshopRoutes from './workshop.routes.js';
import verificationRoutes from './verification.routes.js';
import forumRoutes from './forum.routes.js';
import projectRoutes from './project.routes.js';
import aiRoutes from './ai.routes.js';

const apiRouter = Router();

apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/tutoring', tutoringRoutes);
apiRouter.use('/workshops', workshopRoutes);
apiRouter.use('/verification', verificationRoutes);
apiRouter.use('/forum', forumRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/ai', aiRoutes);

export default apiRouter;
