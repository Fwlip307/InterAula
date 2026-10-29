import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { forumBackendService } from '../services/forum.service.js';

export const forumController = {
  async getPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { category, search, post_type, status, subject_id, sort } = req.query;
      const posts = await forumBackendService.getPosts({
        category: category as string,
        search: search as string,
        postType: post_type as string,
        status: (status as any) || 'all',
        subjectId: subject_id as string,
        sort: (sort as any) || 'recent',
        currentUserId: req.user?.id,
      });
      res.json({ success: true, data: posts });
    } catch (err) {
      next(err);
    }
  },

  async getPostById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await forumBackendService.getPostById(id, req.user?.id);
      if (!post) {
        return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
      }
      res.json({ success: true, data: post });
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

  async updatePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await forumBackendService.updatePost(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await forumBackendService.deletePost(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async upvotePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await forumBackendService.upvotePost(id, req.user);
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

  async getReplies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const replies = await forumBackendService.getReplies(id);
      res.json({ success: true, data: replies });
    } catch (err) {
      next(err);
    }
  },

  async createReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const reply = await forumBackendService.createReply(req.user!, req.token!, id, content);
      res.status(201).json({ success: true, data: reply });
    } catch (err) {
      next(err);
    }
  },

  async updateReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { replyId } = req.params;
      const { content } = req.body;
      const reply = await forumBackendService.updateReply(req.user!, req.token!, replyId, content);
      res.json({ success: true, data: reply });
    } catch (err) {
      next(err);
    }
  },

  async deleteReply(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { replyId } = req.params;
      const result = await forumBackendService.deleteReply(req.user!, req.token!, replyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async markReplyAsSolution(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, replyId } = req.params;
      const result = await forumBackendService.markReplyAsSolution(req.user!, req.token!, id, replyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
