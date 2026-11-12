import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { recommendationService, type RecommendationKind } from '../services/recommendation.service.js';

export const recommendationController = {
  async getTopics(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await recommendationService.topics();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getPreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await recommendationService.preferences(req.token!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async savePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await recommendationService.savePreferences(req.token!, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const data = await recommendationService.feed(req.user!.id, req.token!, limit);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async dismiss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { kind, id } = req.body;
      const data = await recommendationService.dismiss(req.user!.id, req.token!, kind, id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async restoreAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await recommendationService.restore(req.user!.id, req.token!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async restoreItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { kind, id } = req.params;
      const data = await recommendationService.restore(req.user!.id, req.token!, kind as RecommendationKind, id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
