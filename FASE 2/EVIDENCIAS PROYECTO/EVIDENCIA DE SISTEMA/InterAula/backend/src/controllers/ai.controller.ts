import type { Request, Response, NextFunction } from 'express';
import { aiBackendService } from '../services/ai.service.js';

export const aiController = {
  getStatus(_req: Request, res: Response) {
    const status = aiBackendService.getStatus();
    res.json({ success: true, data: status });
  },

  async generateQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const questions = await aiBackendService.generateQuestions(req.body);
      res.json({ success: true, data: questions });
    } catch (err) {
      next(err);
    }
  },

  async generateQuiz(req: Request, res: Response, next: NextFunction) {
    try {
      const quiz = await aiBackendService.generateQuiz(req.body);
      res.json({ success: true, data: quiz });
    } catch (err) {
      next(err);
    }
  },

  async evaluateAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await aiBackendService.evaluateAnswer(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
