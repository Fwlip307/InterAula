import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { notesBackendService } from '../services/notes.service.js';

export const notesController = {
  async getNotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        search,
        subject_id,
        subject_name,
        career,
        category,
        folder,
        source_type,
        author_id,
        sort,
      } = req.query;

      const notes = await notesBackendService.getNotes({
        search: search as string,
        subjectId: subject_id as string,
        subjectName: subject_name as string,
        career: career as string,
        category: category as string,
        folder: folder as string,
        sourceType: source_type as string,
        authorId: author_id as string,
        sort: (sort as any) || 'recent',
        currentUserId: req.user?.id,
      });

      res.json({ success: true, data: notes });
    } catch (err) {
      next(err);
    }
  },

  async getMyNotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notes = await notesBackendService.getMyNotes(req.user!);
      res.json({ success: true, data: notes });
    } catch (err) {
      next(err);
    }
  },

  async getNoteById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const note = await notesBackendService.getNoteById(id, req.user?.id);
      if (!note) {
        return res.status(404).json({ success: false, error: 'Apunte no encontrado' });
      }
      res.json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },

  async createNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const note = await notesBackendService.createNote(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },

  async updateNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const note = await notesBackendService.updateNote(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },

  async deleteNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await notesBackendService.deleteNote(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async registerDownload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await notesBackendService.registerDownload(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

