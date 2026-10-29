import { Router } from 'express';
import { forumController } from '../controllers/forum.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createForumPostSchema,
  updateForumPostSchema,
  createForumReplySchema,
  updateForumReplySchema,
  toggleSolvedSchema,
} from '../schemas/forum.schema.js';

const router = Router();

// Consultar publicaciones en el foro (público con sesión opcional para saber votos propios)
router.get('/posts', optionalAuth, forumController.getPosts);

// Consultar detalle de publicación y sus respuestas
router.get('/posts/:id', optionalAuth, forumController.getPostById);

// Crear nueva publicación en el foro (requiere autenticación)
router.post(
  '/posts',
  requireAuth,
  validateRequest({ body: createForumPostSchema }),
  forumController.createPost
);

// Editar publicación propia (solo autor o admin)
router.put(
  '/posts/:id',
  requireAuth,
  validateRequest({ body: updateForumPostSchema }),
  forumController.updatePost
);

// Eliminar publicación propia (solo autor o admin)
router.delete('/posts/:id', requireAuth, forumController.deletePost);

// Votar o quitar voto de una publicación
router.post('/posts/:id/upvote', optionalAuth, forumController.upvotePost);

// Marcar pregunta como resuelta (solo autor o admin)
router.patch(
  '/posts/:id/solved',
  requireAuth,
  validateRequest({ body: toggleSolvedSchema }),
  forumController.toggleSolved
);

// Consultar respuestas de una publicación
router.get('/posts/:id/replies', optionalAuth, forumController.getReplies);

// Publicar respuesta en una publicación
router.post(
  '/posts/:id/replies',
  requireAuth,
  validateRequest({ body: createForumReplySchema }),
  forumController.createReply
);

// Editar respuesta propia
router.put(
  '/replies/:replyId',
  requireAuth,
  validateRequest({ body: updateForumReplySchema }),
  forumController.updateReply
);

// Eliminar respuesta propia
router.delete('/replies/:replyId', requireAuth, forumController.deleteReply);

// Marcar respuesta como solución aceptada (solo autor de la pregunta)
router.patch(
  '/posts/:id/replies/:replyId/solution',
  requireAuth,
  forumController.markReplyAsSolution
);

export default router;
