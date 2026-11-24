import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  contactsQuerySchema,
  conversationParamsSchema,
  createConversationSchema,
  sendMessageSchema,
} from '../schemas/messaging.schema.js';
import { messagingService } from '../services/messaging.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(requireAuth, createRateLimiter(120, 60_000));

router.get('/unread-count', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await messagingService.getUnreadCount(req.user!, req.token!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/contacts',
  validateRequest({ query: contactsQuerySchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await messagingService.searchContacts(req.user!, req.token!, req.query.q as string | undefined);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/conversations', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = await messagingService.listConversations(req.user!, req.token!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/conversations',
  createRateLimiter(30, 60_000),
  validateRequest({ body: createConversationSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await messagingService.createOrOpenConversation(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/conversations/:id/messages',
  validateRequest({ params: conversationParamsSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await messagingService.getMessages(req.user!, req.token!, req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/conversations/:id/messages',
  createRateLimiter(60, 60_000),
  validateRequest({ params: conversationParamsSchema, body: sendMessageSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await messagingService.sendMessage(req.user!, req.token!, req.params.id, req.body.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/conversations/:id/read',
  validateRequest({ params: conversationParamsSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const data = await messagingService.markAsRead(req.user!, req.token!, req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
