import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { forumBackendService } from '../services/forum.service.js';

export const forumController = {
  async getPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { category, search } = req.query;
      const posts = await forumBackendService.getPosts(category as string, search as string);
      res.json({ success: true, data: posts });
    } catch (err) {
      next(err);
    }
  },

  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const post = await forumBackendService.createPost(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },

  async upvotePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await forumBackendService.upvotePost(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async toggleSolved(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { is_solved } = req.body;
      const result = await forumBackendService.toggleSolved(req.user!, req.token!, id, is_solved);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
