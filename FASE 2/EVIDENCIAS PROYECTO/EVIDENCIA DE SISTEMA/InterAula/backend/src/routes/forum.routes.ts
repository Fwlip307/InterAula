import { Router } from 'express';
import { forumController } from '../controllers/forum.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createForumPostSchema,
  toggleSolvedSchema,
} from '../schemas/forum.schema.js';

const router = Router();

// Consultar publicaciones en el foro (público)
router.get('/posts', forumController.getPosts);

// Crear nueva publicación en el foro (requiere autenticación)
router.post(
  '/posts',
  requireAuth,
  validateRequest({ body: createForumPostSchema }),
  forumController.createPost
);

// Votar una publicación
router.post('/posts/:id/upvote', optionalAuth, forumController.upvotePost);

// Marcar pregunta como resuelta (solo autor o admin)
router.patch(
  '/posts/:id/solved',
  requireAuth,
  validateRequest({ body: toggleSolvedSchema }),
  forumController.toggleSolved
);

export default router;
