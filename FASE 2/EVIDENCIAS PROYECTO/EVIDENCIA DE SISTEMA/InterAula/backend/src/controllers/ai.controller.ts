import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { aiBackendService } from '../services/ai.service.js';

export const aiController = {
  async evaluateAnswer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await aiBackendService.evaluateAnswer(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
